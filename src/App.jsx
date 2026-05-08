import React, { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import * as d3 from "d3"
import { feature } from "topojson-client";

const WORLD_TOPO_JSON =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";
  const GEO_COORDS = {
      "North America": [-100, 45],
  "United States": [-98.5795, 39.8283],
  "Central America": [-84, 12],
  "South America": [-60, -20],
  "Scandinavia": [15, 62],
  "Western Europe": [2, 48],
  "Eastern Europe": [25, 49],
  "North Africa": [15, 25],
  "Asia": [95, 45],
  "Southeast Asia": [105, 12],
  "Oceania": [140, -25],
  Canada: [-106.3468, 56.1304],
  "United States": [-98.5795, 39.8283],
  Michigan: [-84.5555, 44.3148],
  Panama: [-80.7821, 8.538],
  Colombia: [-74.2973, 4.5709],
  Ecuador: [-78.1834, -1.8312],
  Chile: [-71.543, -35.6751],
  Argentina: [-63.6167, -38.4161],

  Norway: [8.4689, 60.472],
  Sweden: [18.6435, 60.1282],
  Belgium: [4.4699, 50.5039],
  Netherlands: [5.2913, 52.1326],
  France: [2.2137, 46.2276],
  Spain: [-3.7492, 40.4637],
  Greece: [21.8243, 39.0742],
  Slovakia: [19.699, 48.669],
  Russia: [105.3188, 61.524],

  Tunisia: [9.5375, 33.8869],
  Nigeria: [8.6753, 9.082],
  Ghana: [-1.0232, 7.9465],

  India: [78.9629, 20.5937],
  Thailand: [100.9925, 15.87],
  Vietnam: [108.2772, 14.0583],
  Cambodia: [104.991, 12.5657],
  Indonesia: [113.9213, -0.7893],
  "South Korea": [127.7669, 35.9078],
  Japan: [138.2529, 36.2048],

  "New Zealand": [174.886, -40.9006],
}
const TEAM_BRANDING = {
  Lats: {
    primary: "from-cyan-500 to-blue-500",
    glow: "shadow-cyan-500/20",
    border: "border-cyan-400/30",
    accent: "text-cyan-300",
    logo: "◈",
  },

  Bontswana: {
    primary: "from-purple-500 to-pink-500",
    glow: "shadow-purple-500/20",
    border: "border-purple-400/30",
    accent: "text-purple-300",
    logo: "▲",
  },
}
function getTeamBrand(teamName) {
  if (!teamName) return TEAM_BRANDING.Lats

  const normalized = teamName.toLowerCase()

  if (normalized.includes("bontswana")) {
    return TEAM_BRANDING.Bontswana
  }

  return TEAM_BRANDING.Lats
}
const teams = [
  { name: "Atlas", wins: 12, avgScore: "21,340", diff: "+4,122", color: "cyan" },
  { name: "Vanguard", wins: 10, avgScore: "20,910", diff: "+2,300", color: "purple" },
]

const players = [
  { name: "Andrew", team: "Atlas", accuracy: "92%", avgPlacement: "1.8", region: "Western Europe" },
  { name: "Matt", team: "Vanguard", accuracy: "89%", avgPlacement: "2.1", region: "Japan" },
  { name: "Chris", team: "Atlas", accuracy: "87%", avgPlacement: "2.4", region: "Brazil" },
  { name: "Sam", team: "Vanguard", accuracy: "84%", avgPlacement: "2.9", region: "North America" },
]

export default function App() {
  const [rawData, setRawData] = useState([]);
const [dailyData, setDailyData] = useState([]);

const RAW_DATA_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQeSSeiTso_obYVNbArRVNpz2PBW5LuQ24dEDMG0kdBH4axSCAajaP6_GTbBENbyRraoOrXUE4Bjitj/pub?gid=0&single=true&output=csv";

const DAILY_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQeSSeiTso_obYVNbArRVNpz2PBW5LuQ24dEDMG0kdBH4axSCAajaP6_GTbBENbyRraoOrXUE4Bjitj/pub?gid=1946076674&single=true&output=csv";

useEffect(() => {
  const fetchSheets = () => {
    Papa.parse(RAW_DATA_URL, {
      download: true,
      header: true,
      complete: (results) => {
        setRawData(results.data);
      },
    });

    Papa.parse(DAILY_URL, {
      download: true,
      header: true,
      complete: (results) => {
        setDailyData(results.data);
      },
    });
  };

  fetchSheets();

  const interval = setInterval(fetchSheets, 30000);

  return () => clearInterval(interval);
}, []);
  const [activeTab, setActiveTab] = useState("leaders")

  const [selectedTeam, setSelectedTeam] = useState("All")

const [selectedModes, setSelectedModes] = useState([
  "Move",
  "No Move",
  "NMPZ",
])
const filteredRawData = useMemo(() => {
  return rawData.filter((row) => {
    const teamMatches =
      selectedTeam === "All" ||
      row["CTP Team"] === selectedTeam

    const mode = row["Mode"]

    const modeMatches =
      !mode || selectedModes.includes(mode)

    return teamMatches && modeMatches
  })
}, [rawData, selectedTeam, selectedModes])

const filteredDailyData = useMemo(() => {
  return dailyData.filter((row) => {
    const mode = row["Mode"]

    return !mode || selectedModes.includes(mode)
  })
}, [dailyData, selectedModes])

const playerStats = useMemo(() => {
  const map = {};

  filteredRawData.forEach((row) => {
    const player = row["CTP Player"];
    const team = row["CTP Team"];
    const region = row["Region"];
    const distance = parseFloat(row["CTP Distance (km)"]) || 0;
    const ko = row["Knockout Punch"];

    if (!player) return;

    if (!map[player]) {
      map[player] = {
        name: player,
        team,
        ctps: 0,
        totalDistance: 0,
        kos: 0,
        regions: {},
      };
    }

    map[player].ctps += 1;
    map[player].totalDistance += distance;

    if (region) {
      if (!map[player].regions[region]) {
        map[player].regions[region] = {
          count: 0,
          totalDistance: 0,
        };
      }

      map[player].regions[region].count += 1;
      map[player].regions[region].totalDistance += distance;
    }

    if (ko && ko !== "-") {
      map[player].kos += 1;
    }
  });

  return Object.values(map)
    .map((p) => {
      const bestRegion =
        Object.entries(p.regions)
          .map(([name, data]) => ({
            name,
            avgDistance: data.totalDistance / data.count,
          }))
          .sort((a, b) => a.avgDistance - b.avgDistance)[0]?.name || "N/A";

      return {
        ...p,
        avgDistance: p.totalDistance / p.ctps,
        consistency:
          p.totalDistance / p.ctps < 50
            ? "Elite"
            : p.totalDistance / p.ctps < 150
            ? "Strong"
            : "Volatile",
        bestRegion,
      };
    })
    .sort((a, b) => b.ctps - a.ctps || a.avgDistance - b.avgDistance);
}, [filteredRawData]);

const teamStats = useMemo(() => {
  const map = {};

  filteredRawData.forEach((row) => {
    const team = row["CTP Team"];
    const distance = parseFloat(row["CTP Distance (km)"]) || 0;
    const ko = row["Knockout Punch"];

    if (!team) return;

    if (!map[team]) {
      map[team] = {
        name: team,
        ctps: 0,
        totalDistance: 0,
        kos: 0,
      };
    }

    map[team].ctps += 1;
    map[team].totalDistance += distance;

    if (ko && ko !== "-") {
      map[team].kos += 1;
    }
  });

  return Object.values(map)
    .map((team) => ({
      ...team,
      avgDistance: team.totalDistance / team.ctps,
    }))
    .sort((a, b) => b.ctps - a.ctps);
}, [filteredRawData]);

const regionStats = useMemo(() => {
  const map = {};

  filteredRawData.forEach((row) => {
    const region = row["Region"];
    const player = row["CTP Player"];
    const distance = parseFloat(row["CTP Distance (km)"]) || 0;

    if (!region || !player) return;

    if (!map[region]) {
      map[region] = {
        name: region,
        appearances: 0,
        totalDistance: 0,
        players: {},
      };
    }

    map[region].appearances += 1;
    map[region].totalDistance += distance;

    if (!map[region].players[player]) {
      map[region].players[player] = {
        count: 0,
        totalDistance: 0,
      };
    }

    map[region].players[player].count += 1;
    map[region].players[player].totalDistance += distance;
  });

  return Object.values(map)
    .map((region) => {
      const bestPlayer =
        Object.entries(region.players)
          .map(([name, data]) => ({
            name,
            avgDistance: data.totalDistance / data.count,
          }))
          .sort((a, b) => a.avgDistance - b.avgDistance)[0];

      return {
        ...region,
        avgDistance: region.totalDistance / region.appearances,
        bestPlayer: bestPlayer?.name || "N/A",
      };
    })
    .sort((a, b) => a.avgDistance - b.avgDistance);
}, [filteredRawData]);

const countryStats = useMemo(() => {
  const map = {};

  filteredRawData.forEach((row) => {
    const country = row["Country/State"];
    const region = row["Region"];
    const player = row["CTP Player"];
    const distance = parseFloat(row["CTP Distance (km)"]) || 0;

    if (!country || !player) return;

    if (!map[country]) {
      map[country] = {
        name: country,
        region,
        appearances: 0,
        totalDistance: 0,
        players: {},
      };
    }

    map[country].appearances += 1;
    map[country].totalDistance += distance;

    if (!map[country].players[player]) {
      map[country].players[player] = {
        count: 0,
        totalDistance: 0,
      };
    }

    map[country].players[player].count += 1;
    map[country].players[player].totalDistance += distance;
  });

  return Object.values(map)
    .map((country) => {
      const bestPlayer =
        Object.entries(country.players)
          .map(([name, data]) => ({
            name,
            avgDistance: data.totalDistance / data.count,
          }))
          .sort((a, b) => a.avgDistance - b.avgDistance)[0];

      return {
        ...country,
        avgDistance: country.totalDistance / country.appearances,
        bestPlayer: bestPlayer?.name || "N/A",
      };
    })
    .sort((a, b) => a.avgDistance - b.avgDistance);
}, [filteredRawData]);
const liveMatches = useMemo(() => {
  return filteredRawData
    .filter((row) => row["Match"] && row["Game"])
    .slice(-12)
    .reverse()
    .map((row) => ({
      winner: row["CTP Team"] || "Unknown",
      loser: "Field",
      score: `${row["CTP Player"] || "Unknown"} • ${row["CTP Distance (km)"] || "0"} km`,
      status: row["Knockout Punch"] && row["Knockout Punch"] !== "-" ? "KO" : "CTP",
    }));
}, [filteredRawData]);

const liveRegions = useMemo(() => {
  return regionStats.map((region, index) => ({
    name: region.name,
    rate: Math.max(8, Math.round(100 - Math.min(region.avgDistance, 500) / 5)),
    color: ["bg-cyan-400", "bg-purple-400", "bg-pink-400", "bg-emerald-400"][index % 4],
  }));
}, [regionStats]);
  return (
    <div className="min-h-screen bg-[#070b14] text-white overflow-hidden">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top_right,#1d4ed830,transparent_35%),radial-gradient(circle_at_bottom_left,#06b6d430,transparent_35%)] pointer-events-none" />

      <div className="relative z-10 p-6 md:p-10">
        <TopNav activeTab={activeTab} setActiveTab={setActiveTab} />

        <FilterBar
          selectedTeam={selectedTeam}
          setSelectedTeam={setSelectedTeam}
          selectedModes={selectedModes}
          setSelectedModes={setSelectedModes}
        />
<div className="mb-6 text-sm font-bold">
  <p className="text-green-400">
    Raw Entries: {rawData.length}
  </p>

  <p className="text-cyan-400">
    Daily Entries: {dailyData.length}
    <p className="text-pink-400">
  Players Loaded: {playerStats.length}
</p>
  </p>
</div>
        {activeTab === "feed" && <FeedTab liveMatches={liveMatches} />}
        {activeTab === "leaders" && <LeadersTab playerStats={playerStats} teamStats={teamStats} liveMatches={liveMatches} liveRegions={liveRegions} />}
        {activeTab === "regions" && (
          <RegionsTab
            regionStats={regionStats}
            countryStats={countryStats}
          />
        )}
        {activeTab === "players" && <PlayersTab playerStats={playerStats} />}
        {activeTab === "daily" && <DailyChallengeTab dailyData={filteredDailyData} />}
      </div>
    </div>
  )
}

function TopNav({ activeTab, setActiveTab }) {
    const tabs = [
      { id: "feed", label: "Feed" },
      { id: "leaders", label: "Leaders" },
      { id: "regions", label: "Regions" },
      { id: "players", label: "Players" },
      { id: "daily", label: "Daily Challenge" },
    ]

  return (
    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-10">
      <div>
        <p className="uppercase tracking-[0.3em] text-cyan-400 text-xs font-bold mb-2">
          GeoGuessr League
        </p>

        <h1 className="text-4xl md:text-5xl font-black tracking-tight">
          GEOCOMMAND
        </h1>
      </div>

      <div className="flex flex-wrap items-center gap-3 bg-white/5 border border-white/10 rounded-2xl p-2 backdrop-blur-xl">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2 rounded-xl font-semibold transition-all ${
              activeTab === tab.id
                ? "bg-cyan-500 text-black"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function PageHeader({ eyebrow, title, description }) {
  return (
    <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-8">
      <div>
        <p className="uppercase tracking-[0.3em] text-cyan-400 text-xs font-bold mb-3">
          {eyebrow}
        </p>

        <h2 className="text-4xl md:text-6xl font-black tracking-tight leading-none">
          {title}
        </h2>

        <p className="text-slate-400 mt-4 text-lg max-w-2xl">
          {description}
        </p>
      </div>

      <div className="mt-6 md:mt-0 bg-white/5 border border-white/10 backdrop-blur-xl rounded-3xl px-6 py-5 shadow-2xl">
        <p className="text-slate-400 text-xs uppercase tracking-widest">
          Current Season
        </p>

        <div className="flex items-end gap-3 mt-2">
          <span className="text-5xl font-black">03</span>
          <span className="text-cyan-400 font-semibold mb-1">Week 7</span>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, accent = "cyan" }) {
  const colors = {
    cyan: "border-cyan-500/20 text-cyan-400 bg-cyan-500/10",
    purple: "border-purple-500/20 text-purple-400 bg-purple-500/10",
    pink: "border-pink-500/20 text-pink-400 bg-pink-500/10",
    emerald: "border-emerald-500/20 text-emerald-400 bg-emerald-500/10",
  }

  return (
    <div className={`relative overflow-hidden rounded-3xl border ${colors[accent]} bg-white/5 backdrop-blur-xl p-6 shadow-2xl`}>
      <div className={`absolute top-0 right-0 w-32 h-32 blur-3xl ${colors[accent].split(" ")[2]}`} />

      <p className="text-slate-400 text-sm uppercase tracking-wider">
        {label}
      </p>

      <h3 className="text-4xl font-black mt-3">
        {value}
      </h3>

      <p className={`mt-6 font-semibold ${colors[accent].split(" ")[1]}`}>
        {sub}
      </p>
    </div>
  )
}

function LeadersTab({ playerStats, teamStats, liveMatches, liveRegions }) {
  return (
    <>
      <PageHeader
        eyebrow="Competitive Analytics"
        title="League Leaders"
        description="Season-long standings, team metrics, MVP race, match feed, and performance trends."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard
          label="Top Team"
          value={teamStats[0]?.name || "Loading"}
          sub={`${teamStats[0]?.ctps || 0} CTPs`}
          accent="cyan"
        />

        <StatCard
          label="Best Avg Distance"
          value={`${playerStats[0]?.avgDistance.toFixed(1) || "0.0"} km`}
          sub={playerStats[0]?.name || "Loading"}
          accent="purple"
        />

        <StatCard
          label="CTP Leader"
          value={playerStats[0]?.name || "Loading"}
          sub={`${playerStats[0]?.ctps || 0} CTPs`}
          accent="pink"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Panel className="xl:col-span-2">
          <PanelHeader eyebrow="Rankings" title="League Standings" right="Updated Live" />
          <StandingsTable teamStats={teamStats} />

          <div className="mt-8 border-t border-white/10 pt-6">
            <PanelHeader eyebrow="Team Comparison" title="CTP Share" right="Live" />
            <TeamComparisonChart teamStats={teamStats} />
          </div>
        </Panel>

        <Panel>
          <PanelHeader eyebrow="MVP Race" title="Top Players" right="Season" />
          <PlayerList playerStats={playerStats} />
        </Panel>
      </div>

      <BottomAnalytics liveMatches={liveMatches} liveRegions={liveRegions} />
    </>
  )
}

function FeedTab({ liveMatches = [] }) {
  return (
    <>
      <PageHeader
        eyebrow="Live Match Center"
        title="League Feed"
        description="A running log of match results, player performances, and weekly league activity."
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Panel className="xl:col-span-2">
          <PanelHeader eyebrow="Match Feed" title="Recent Results" right="Live" />

          <div className="space-y-4">
            {liveMatches.map((match, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center bg-white/5 rounded-2xl p-5 border border-white/10">
                <div>
                  <p className="text-slate-500 text-sm">Winner</p>
                  <p className="text-xl font-black">{match.winner}</p>
                </div>

                <div>
                  <p className="text-slate-500 text-sm">Scoreline</p>
                  <p className="font-bold">{match.score}</p>
                </div>

                <div>
                  <p className="text-slate-500 text-sm">Opponent</p>
                  <p className="font-bold">{match.loser}</p>
                </div>

                <div className="md:text-right">
                  <span className="inline-flex rounded-xl bg-emerald-400/10 border border-emerald-400/20 text-emerald-400 px-4 py-2 font-black text-sm">
                    {match.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <PanelHeader eyebrow="Activity" title="League Pulse" right="Week 7" />

          <div className="grid grid-cols-2 gap-4">
            <MiniStat label="Matches" value="24" />
            <MiniStat label="Players" value="12" />
            <MiniStat label="Avg Score" value="21.1K" accent="text-cyan-400" />
            <MiniStat label="Hot Team" value="Atlas" />
          </div>
        </Panel>
      </div>
    </>
  )
}

function RegionsTab({ regionStats, countryStats }) {
  const [viewMode, setViewMode] = useState("regions")
  const activeGeoStats =
  viewMode === "regions" ? regionStats : countryStats

  const geoLabel =
  viewMode === "regions" ? "Region" : "Country"
  const bestRegion = activeGeoStats[0]
  const hardestRegion = activeGeoStats[activeGeoStats.length - 1]
  const mostPlayed = [...activeGeoStats].sort(
    (a, b) => b.appearances - a.appearances
  )[0]

  return (
    <>
      <PageHeader
        eyebrow="Geo Analytics"
        title="Regions & Countries"
        description="Regional performance, strongest territories, map-read consistency, and location-specific dominance."
      />
<div className="mb-8 flex justify-end">
  <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-2xl p-2 backdrop-blur-xl">
    <button
      onClick={() => setViewMode("regions")}
      className={`px-5 py-2 rounded-xl font-bold transition-all ${
        viewMode === "regions"
          ? "bg-cyan-500 text-black"
          : "text-slate-400 hover:text-white hover:bg-white/5"
      }`}
    >
      Regions
    </button>

    <button
      onClick={() => setViewMode("countries")}
      className={`px-5 py-2 rounded-xl font-bold transition-all ${
        viewMode === "countries"
          ? "bg-cyan-500 text-black"
          : "text-slate-400 hover:text-white hover:bg-white/5"
      }`}
    >
      Countries
    </button>
  </div>
</div>
      <Panel className="mb-8">
        <PanelHeader
          eyebrow="Precision Map"
          title={`${geoLabel} Heatmap`}
          right="Avg Distance"
        />

        <GeoHeatMap regionStats={activeGeoStats} />
      </Panel>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard
          label={`Best ${geoLabel}`}
          value={bestRegion?.name || "N/A"}
          sub={`${bestRegion?.avgDistance.toFixed(1) || "0.0"} km avg`}
          accent="cyan"
        />

        <StatCard
          label={`Hardest ${geoLabel}`}
          value={hardestRegion?.name || "N/A"}
          sub={`${hardestRegion?.avgDistance.toFixed(1) || "0.0"} km avg`}
          accent="pink"
        />

        <StatCard
          label="Most Played"
          value={mostPlayed?.name || "N/A"}
          sub={`${mostPlayed?.appearances || 0} appearances`}
          accent="purple"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {activeGeoStats.map((region) => (
          <div
            key={region.name}
            className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-6 shadow-2xl hover:bg-white/10 transition-all"
          >
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="text-cyan-400 uppercase tracking-[0.2em] text-xs font-bold mb-2">
                  {geoLabel} Intelligence
                </p>

                <h3 className="text-2xl font-black">
                  {region.name}
                </h3>
              </div>

              <div className="text-right">
                <p className="text-cyan-400 font-black">
                  {region.avgDistance.toFixed(1)} km
                </p>

                <p className="text-slate-500 text-xs">
                  avg distance
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <MiniStat
                label="Top Specialist"
                value={region.bestPlayer}
                accent="text-cyan-400"
              />

              <MiniStat
                label="Appearances"
                value={region.appearances}
              />

              <MiniStat
                label="Difficulty Tier"
                value={
                  region.avgDistance < 50
                    ? "Controlled"
                    : region.avgDistance < 150
                    ? "Contested"
                    : "Danger Zone"
                }
                accent={
                  region.avgDistance < 50
                    ? "text-emerald-400"
                    : region.avgDistance < 150
                    ? "text-amber-400"
                    : "text-pink-400"
                }
              />
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

function PlayersTab({ playerStats }) {
  return (
    <>
      <PageHeader
        eyebrow="Player Database"
        title="Player Cards"
        description="Individual dossiers for each league player, including team, accuracy, placement, and best region."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {playerStats.map((player) => {
          const brand = getTeamBrand(player.team)

          return (
          <div
            key={player.name}
            className={`relative overflow-hidden bg-white/5 backdrop-blur-xl border rounded-[2rem] p-6 shadow-2xl transition-all hover:scale-[1.02] ${brand.border} ${brand.glow}`}
>
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 blur-3xl" />

            <p className="text-cyan-400 uppercase tracking-[0.2em] text-xs font-bold mb-2">
              <span className={brand.accent}>
              {brand.logo} {player.team}
            </span>
            </p>

            <h3 className="text-3xl font-black mb-6">
              {player.name}
            </h3>

            <div className="space-y-4">
              <MiniStat label="CTPs" value={player.ctps} accent="text-cyan-400" />
              <MiniStat label="Avg Distance" value={`${player.avgDistance.toFixed(1)} km`} />
              <MiniStat label="Best Region" value={player.bestRegion} accent="text-purple-400" />
              <MiniStat
                label="Consistency"
                value={player.consistency}
                accent="text-emerald-400"
              />
              <MiniStat label="KOs" value={player.kos} accent="text-pink-400" />
            </div>
          </div>
          )
        })}
      </div>
            <div className="mt-10">
        <Panel>
          <PanelHeader
            eyebrow="Precision Analytics"
            title="Average Distance"
            right="Lower is Better"
          />

          <PlayerDistanceChart playerStats={playerStats} />
        </Panel>
      </div>
    </>
  )
}

function Panel({ children, className = "" }) {
  return (
    <div className={`bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-6 shadow-2xl ${className}`}>
      {children}
    </div>
  )
}

function PanelHeader({ eyebrow, title, right }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <p className="text-cyan-400 uppercase tracking-[0.2em] text-xs font-bold mb-2">
          {eyebrow}
        </p>

        <h3 className="text-3xl font-black">
          {title}
        </h3>
      </div>

      <div className="text-slate-500 text-sm">
        {right}
      </div>
    </div>
  )
}

function StandingsTable({ teamStats = [] }) {
  return (
    <>
      <div className="grid grid-cols-4 text-slate-500 text-sm border-b border-white/10 pb-3 px-4">
        <div>Team</div>
        <div>Wins</div>
        <div>Avg Score</div>
        <div>Diff</div>
      </div>

      <div className="space-y-3 mt-4">
       {teamStats.map((team) => {
  const brand = getTeamBrand(team.name)

  return (
    <div
      key={team.name}
      className={`grid grid-cols-4 items-center bg-white/5 hover:bg-white/10 transition-all rounded-2xl p-4 border ${brand.border} ${brand.glow}`}
    >
      <div className="font-bold">
        <span className={brand.accent}>
          {brand.logo} {team.name}
        </span>
      </div>

      <div className="font-semibold">
        {team.ctps}
      </div>

      <div>
        {team.avgDistance.toFixed(1)} km
      </div>

      <div className="text-emerald-400 font-semibold">
        {team.kos} KOs
      </div>
    </div>
  )
})}
      </div>
    </>
  )
}

function PlayerList({ playerStats = [] }) {
  return (
    <div className="space-y-3">
      {playerStats.slice(0, 5).map((player) => (
        <div key={player.name} className="flex items-center justify-between bg-white/5 rounded-2xl p-4 border border-white/10">
          <div>
            <p className="font-bold">{player.name}</p>
            <p className="text-slate-500 text-sm">{player.team}</p>
          </div>

          <div className="text-right">
            <p className="text-cyan-400 font-bold">{player.ctps}</p>
            <p className="text-slate-500 text-xs">CTPs</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function MiniStat({ label, value, accent = "" }) {
  return (
    <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
      <p className="text-slate-500 text-sm mb-2">
        {label}
      </p>

      <h4 className={`text-2xl font-black ${accent}`}>
        {value}
      </h4>
    </div>
  )
}

function BottomAnalytics({ liveMatches = [], liveRegions = [] }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
      <Panel>
        <PanelHeader eyebrow="Match Feed" title="Recent Results" right="Live" />

        <div className="space-y-4">
          {liveMatches.slice(0, 2).map((match, index) => (
            <div key={index} className="bg-white/5 rounded-2xl p-4 border border-white/10">
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold">{match.winner}</span>
                <span className="text-emerald-400 font-bold">WIN</span>
              </div>

              <p className="text-slate-400 text-sm">
                {match.score} vs {match.loser}
              </p>
            </div>
          ))}
        </div>
      </Panel>

      <Panel>
        <PanelHeader eyebrow="Regional Meta" title="Strongest Regions" right="Index" />

        <div className="space-y-4">
          {liveRegions.slice(0, 3).map((region) => (
            <div key={region.name}>
              <div className="flex justify-between mb-2">
                <span>{region.name}</span>
                <span className="text-cyan-400">{region.rate}%</span>
              </div>

              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div className={`h-full ${region.color} rounded-full`} style={{ width: `${region.rate}%` }} />
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel>
        <PanelHeader eyebrow="Activity" title="League Stats" right="Season" />

        <div className="grid grid-cols-2 gap-4">
          <MiniStat label="Matches" value="84" />
          <MiniStat label="Avg Accuracy" value="87%" accent="text-cyan-400" />
          <MiniStat label="Best Team" value="Atlas" />
          <MiniStat label="Players" value="12" />
        </div>
      </Panel>
    </div>
  )
}
function DailyChallengeTab({ dailyData = [] }) {
  return (
    <>
      <PageHeader
        eyebrow="Daily Challenge"
        title="Daily Challenge"
        description="Live stats from the Daily Challenges sheet: country hits, region hits, distance, timing, date, and mode."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard
          label="Total Guesses"
          value={dailyData.length}
          sub="All daily entries"
          accent="cyan"
        />

        <StatCard
          label="Country Hits"
          value={dailyData.filter((row) => row["Country Hit"] === "Yes").length}
          sub="Exact country guesses"
          accent="purple"
        />

        <StatCard
          label="Region Hits"
          value={dailyData.filter((row) => row["Region Hit"] === "Yes").length}
          sub="Correct region guesses"
          accent="pink"
        />
      </div>

      <Panel>
        <PanelHeader eyebrow="Daily Feed" title="Recent Daily Results" right="Live" />

        <div className="space-y-3">
          {dailyData.slice(0, 12).map((row, index) => (
            <div
              key={index}
              className="grid grid-cols-1 md:grid-cols-6 gap-4 items-center bg-white/5 rounded-2xl p-4 border border-white/10"
            >
              <div>
                <p className="text-slate-500 text-xs">Player</p>
                <p className="font-bold">{row.Player}</p>
              </div>

              <div>
                <p className="text-slate-500 text-xs">Country</p>
                <p className="font-bold">{row.Country}</p>
              </div>

              <div>
                <p className="text-slate-500 text-xs">Region</p>
                <p className="font-bold">{row.Region}</p>
              </div>

              <div>
                <p className="text-slate-500 text-xs">Distance</p>
                <p className="font-bold text-cyan-400">{row["Distance (km)"]} km</p>
              </div>

              <div>
                <p className="text-slate-500 text-xs">Time</p>
                <p className="font-bold">{row["Time/Guess"]}</p>
              </div>

              <div>
                <p className="text-slate-500 text-xs">Mode</p>
                <p className="font-bold">{row.Mode}</p>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </>
  )
}
function TeamComparisonChart({ teamStats = [] }) {

  const chartData = teamStats.map((team) => {
  const brand = getTeamBrand(team.name)

  return {
    ...team,
    fill:
      team.name.toLowerCase().includes("bontswana")
        ? "#c084fc"
        : "#22d3ee",
  }
})
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData}>
          <XAxis dataKey="name" stroke="#94a3b8" />
          <YAxis stroke="#94a3b8" />
          <Tooltip
            contentStyle={{
              background: "#0f172a",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "16px",
              color: "#fff",
            }}
          />
          <Bar
            dataKey="ctps"
            radius={[14, 14, 0, 0]}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
function PlayerDistanceChart({ playerStats = [] }) {
  const chartData = [...playerStats]
    .sort((a, b) => a.avgDistance - b.avgDistance)
    .slice(0, 10)

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData}>
          <XAxis dataKey="name" stroke="#94a3b8" />
          <YAxis stroke="#94a3b8" />
          <Tooltip
            contentStyle={{
              background: "#0f172a",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "16px",
              color: "#fff",
            }}
          />
          <Bar dataKey="avgDistance" radius={[10, 10, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
function FilterBar({
  selectedTeam,
  setSelectedTeam,
  selectedModes,
  setSelectedModes,
}) {
  const modes = ["Move", "No Move", "NMPZ"]

  function toggleMode(mode) {
    if (selectedModes.includes(mode)) {
      setSelectedModes(selectedModes.filter((item) => item !== mode))
    } else {
      setSelectedModes([...selectedModes, mode])
    }
  }

  return (
    <div className="mb-8 bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-xl flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
      <div>
        <p className="text-slate-500 text-xs uppercase tracking-[0.2em] font-bold mb-1">
          Global Filters
        </p>

        <p className="text-slate-300 text-sm">
          Filter every tab by team and game mode.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <select
          value={selectedTeam}
          onChange={(event) => setSelectedTeam(event.target.value)}
          className="bg-[#0f172a] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white"
        >
          <option value="All">All Teams</option>
          <option value="Lats">Lats</option>
          <option value="Bontswana">Bontswana</option>
        </select>

        <div className="flex flex-wrap gap-2">
          {modes.map((mode) => (
            <button
              key={mode}
              onClick={() => toggleMode(mode)}
              className={`px-4 py-3 rounded-xl text-sm font-bold border transition-all ${
                selectedModes.includes(mode)
                  ? "bg-cyan-500 text-black border-cyan-400"
                  : "bg-white/5 text-slate-400 border-white/10 hover:text-white"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
function GeoHeatMap({ regionStats = [] }) {
  const [worldData, setWorldData] = useState(null)

  useEffect(() => {
    fetch(WORLD_TOPO_JSON)
      .then((res) => res.json())
      .then((topology) => {
        const geojson = feature(
          topology,
          topology.objects.countries
        )

        setWorldData(geojson)
      })
  }, [])

  const projection = d3
    .geoMercator()
    .scale(150)
    .translate([500, 300])

  const path = d3.geoPath(projection)

  return (
    <div className="relative h-[460px] rounded-[2rem] bg-[#060b14] border border-white/10 overflow-hidden">
      <svg viewBox="0 0 1000 520" className="w-full h-full">
        {worldData &&
          worldData.features.map((country, index) => (
            <path
              key={index}
              d={path(country)}
              fill="rgba(148,163,184,0.16)"
              stroke="rgba(148,163,184,0.18)"
              strokeWidth="0.5"
            />
          ))}

        {regionStats.map((item) => {
          const coords = GEO_COORDS[item.name]

          if (!coords) return null

          const projected = projection(coords)

          if (!projected) return null

          const [x, y] = projected

          const size = Math.min(
            34,
            Math.max(8, item.avgDistance / 18)
          )

          const fill =
            item.avgDistance < 50
              ? "#34d399"
              : item.avgDistance < 150
              ? "#fbbf24"
              : "#fb2c5f"

          return (
            <g
              key={item.name}
              transform={`translate(${x}, ${y})`}
            >
              <circle
                r={size}
                fill={fill}
                stroke="rgba(255,255,255,0.8)"
                strokeWidth="1.5"
                opacity="0.92"
              />

              <text
                textAnchor="middle"
                y={size + 14}
                fill="#cbd5e1"
                fontSize="10"
                fontWeight="900"
              >
                {item.name}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}