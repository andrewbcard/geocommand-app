import { useEffect, useMemo, useState } from "react";
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
import DailyChallengeTab from "./components/DailyChallengeTab.jsx"
import { PlayerAvatar, TeamLogo } from "./components/LeagueIdentity.jsx"
import { buildDailyPlayerStats, formatDistance, formatPercent, getDistanceTier } from "./data/stats.js"

const WORLD_TOPO_JSON =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";
  const GEO_COORDS = {
      "North America": [-100, 45],
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
  },

  Bontswana: {
    primary: "from-purple-500 to-pink-500",
    glow: "shadow-purple-500/20",
    border: "border-purple-400/30",
    accent: "text-purple-300",
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
        recentRows: [],
      };
    }

    map[player].ctps += 1;
    map[player].totalDistance += distance;
    map[player].recentRows.push({
      region,
      distance,
      ko,
    });

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
      const regionAverages = Object.entries(p.regions)
        .map(([name, data]) => ({
          name,
          avgDistance: data.totalDistance / data.count,
        }))
        .sort((a, b) => a.avgDistance - b.avgDistance)
      const recentRows = p.recentRows.slice(-20)
      const recentRegions = {}

      recentRows.forEach((row) => {
        if (!row.region) return

        if (!recentRegions[row.region]) {
          recentRegions[row.region] = {
            count: 0,
            totalDistance: 0,
          }
        }

        recentRegions[row.region].count += 1
        recentRegions[row.region].totalDistance += row.distance
      })

      const recentRegionAverages = Object.entries(recentRegions)
        .map(([name, data]) => ({
          name,
          avgDistance: data.totalDistance / data.count,
        }))
        .sort((a, b) => a.avgDistance - b.avgDistance)
      const recentTotalDistance = recentRows.reduce((sum, row) => sum + row.distance, 0)
      const last10 = recentRows.slice(-10)
      const previous10 = recentRows.slice(-20, -10)
      const last10Avg =
        last10.length > 0
          ? last10.reduce((sum, row) => sum + row.distance, 0) / last10.length
          : null
      const previous10Avg =
        previous10.length > 0
          ? previous10.reduce((sum, row) => sum + row.distance, 0) / previous10.length
          : null
      const trend =
        last10Avg === null || previous10Avg === null
          ? "Building Sample"
          : last10Avg < previous10Avg
          ? "Heating Up"
          : last10Avg > previous10Avg
          ? "Cooling Off"
          : "Holding Steady"

      return {
        ...p,
        avgDistance: p.totalDistance / p.ctps,
        consistency:
          p.totalDistance / p.ctps < 50
            ? "Elite"
            : p.totalDistance / p.ctps < 150
            ? "Strong"
            : "Volatile",
        bestRegion: regionAverages[0]?.name || "N/A",
        recentForm: {
          sampleSize: recentRows.length,
          avgDistance: recentRows.length > 0 ? recentTotalDistance / recentRows.length : 0,
          kos: recentRows.filter((row) => row.ko && row.ko !== "-").length,
          bestRegion: recentRegionAverages[0]?.name || "N/A",
          weakestRegion: recentRegionAverages[recentRegionAverages.length - 1]?.name || "N/A",
          trend,
        },
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
    <div className="min-h-screen bg-[#070b14] text-white overflow-x-hidden">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top_right,#1d4ed830,transparent_35%),radial-gradient(circle_at_bottom_left,#06b6d430,transparent_35%)] pointer-events-none" />

      <div className="relative z-10 p-4 sm:p-6 md:p-10">
        <TopNav activeTab={activeTab} setActiveTab={setActiveTab} />

        <FilterBar
          selectedTeam={selectedTeam}
          setSelectedTeam={setSelectedTeam}
          selectedModes={selectedModes}
          setSelectedModes={setSelectedModes}
        />
<div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs sm:text-sm font-bold">
  <p className="text-green-400">
    Raw Entries: {rawData.length}
  </p>

  <p className="text-cyan-400">
    Daily Entries: {dailyData.length}
  </p>

  <p className="text-pink-400">
    Players Loaded: {playerStats.length}
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
        {activeTab === "players" && <PlayersTab playerStats={playerStats} dailyData={filteredDailyData} />}
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
    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 sm:gap-6 mb-6 sm:mb-10">
      <div>
        <p className="uppercase tracking-[0.24em] sm:tracking-[0.3em] text-cyan-400 text-[0.65rem] sm:text-xs font-bold mb-2">
          GeoGuessr League
        </p>

        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight">
          GEOCOMMAND
        </h1>
      </div>

      <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-2xl p-2 backdrop-blur-xl overflow-x-auto max-w-full">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`shrink-0 px-3 sm:px-5 py-2 rounded-xl text-sm sm:text-base font-semibold transition-all ${
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
    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5 mb-6 sm:mb-8">
      <div>
        <p className="uppercase tracking-[0.24em] sm:tracking-[0.3em] text-cyan-400 text-[0.65rem] sm:text-xs font-bold mb-3">
          {eyebrow}
        </p>

        <h2 className="text-3xl sm:text-4xl md:text-6xl font-black tracking-tight leading-tight md:leading-none break-words">
          {title}
        </h2>

        <p className="text-slate-400 mt-3 sm:mt-4 text-sm sm:text-lg max-w-2xl">
          {description}
        </p>
      </div>

      <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl sm:rounded-3xl px-4 sm:px-6 py-4 sm:py-5 shadow-2xl">
        <p className="text-slate-400 text-xs uppercase tracking-widest">
          Current Season
        </p>

        <div className="flex items-end gap-3 mt-2">
          <span className="text-4xl sm:text-5xl font-black">03</span>
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
    <div className={`relative overflow-hidden rounded-2xl sm:rounded-3xl border ${colors[accent]} bg-white/5 backdrop-blur-xl p-4 sm:p-6 shadow-2xl min-w-0`}>
      <div className={`absolute top-0 right-0 w-32 h-32 blur-3xl ${colors[accent].split(" ")[2]}`} />

      <p className="text-slate-400 text-xs sm:text-sm uppercase tracking-wider">
        {label}
      </p>

      <h3 className="text-2xl sm:text-4xl font-black mt-3 break-words">
        {value}
      </h3>

      <p className={`mt-4 sm:mt-6 text-sm sm:text-base font-semibold ${colors[accent].split(" ")[1]}`}>
        {sub}
      </p>
    </div>
  )
}

function LeadersTab({ playerStats, teamStats, liveMatches, liveRegions }) {
  const ctpLeader = playerStats[0]
  const bestAvgPlayer = [...playerStats].sort((a, b) => a.avgDistance - b.avgDistance)[0]
  const koLeader = [...playerStats].sort((a, b) => b.kos - a.kos || a.avgDistance - b.avgDistance)[0]
  const bestRecentPlayer = [...playerStats]
    .filter((player) => player.recentForm?.sampleSize > 0)
    .sort((a, b) => a.recentForm.avgDistance - b.recentForm.avgDistance)[0]

  return (
    <>
      <PageHeader
        eyebrow="Competitive Analytics"
        title="League Leaders"
        description="Real league leaderboards for CTPs, average distance, knockouts, team totals, recent results, and last-20-guess form."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
        <StatCard
          label="CTP Leader"
          value={ctpLeader?.name || "Loading"}
          sub={`${ctpLeader?.ctps || 0} CTPs`}
          accent="cyan"
        />

        <StatCard
          label="Best Avg Distance"
          value={formatDistance(bestAvgPlayer?.avgDistance)}
          sub={bestAvgPlayer?.name || "Loading"}
          accent="purple"
        />

        <StatCard
          label="KO Leader"
          value={koLeader?.name || "Loading"}
          sub={`${koLeader?.kos || 0} KOs`}
          accent="pink"
        />

        <StatCard
          label="Best Recent Form"
          value={formatDistance(bestRecentPlayer?.recentForm?.avgDistance)}
          sub={`${bestRecentPlayer?.name || "Loading"} • Last 20 guesses`}
          accent="emerald"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Panel className="xl:col-span-2">
          <PanelHeader eyebrow="Team Totals" title="CTPs, KOs, and Avg Distance" right="Updated Live" />
          <StandingsTable teamStats={teamStats} />

          <div className="mt-8 border-t border-white/10 pt-6">
            <PanelHeader eyebrow="Team Comparison" title="CTP Share" right="Live" />
            <TeamComparisonChart teamStats={teamStats} />
          </div>
        </Panel>

        <Panel>
          <PanelHeader eyebrow="Player Leaders" title="CTP Leaderboard" right="Season" />
          <PlayerList playerStats={playerStats} />
        </Panel>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-6">
        <Panel className="xl:col-span-2">
          <PanelHeader eyebrow="Recent Form" title="Last 20 Guesses" right="Lower is Better" />
          <RecentFormTable playerStats={playerStats} />
        </Panel>

        <Panel>
          <PanelHeader eyebrow="Precision" title="Best Avg Distance" right="Season" />
          <AverageDistanceList playerStats={playerStats} />
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
  const [mapMetric, setMapMetric] = useState("distance")
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
<div className="mb-6 sm:mb-8 flex flex-col md:flex-row md:items-center md:justify-end gap-3">
  <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-2xl p-2 backdrop-blur-xl overflow-x-auto">
    <button
      onClick={() => setViewMode("regions")}
      className={`shrink-0 px-4 sm:px-5 py-2 rounded-xl text-sm sm:text-base font-bold transition-all ${
        viewMode === "regions"
          ? "bg-cyan-500 text-black"
          : "text-slate-400 hover:text-white hover:bg-white/5"
      }`}
    >
      Regions
    </button>

    <button
      onClick={() => setViewMode("countries")}
      className={`shrink-0 px-4 sm:px-5 py-2 rounded-xl text-sm sm:text-base font-bold transition-all ${
        viewMode === "countries"
          ? "bg-cyan-500 text-black"
          : "text-slate-400 hover:text-white hover:bg-white/5"
      }`}
    >
      Countries
    </button>
  </div>

  <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-2xl p-2 backdrop-blur-xl overflow-x-auto">
    <button
      onClick={() => setMapMetric("distance")}
      className={`shrink-0 px-4 sm:px-5 py-2 rounded-xl text-sm sm:text-base font-bold transition-all ${
        mapMetric === "distance"
          ? "bg-cyan-500 text-black"
          : "text-slate-400 hover:text-white hover:bg-white/5"
      }`}
    >
      Distance
    </button>

    <button
      onClick={() => setMapMetric("volume")}
      className={`shrink-0 px-4 sm:px-5 py-2 rounded-xl text-sm sm:text-base font-bold transition-all ${
        mapMetric === "volume"
          ? "bg-cyan-500 text-black"
          : "text-slate-400 hover:text-white hover:bg-white/5"
      }`}
    >
      Volume
    </button>
  </div>
</div>
      <Panel className="mb-8">
        <PanelHeader
          eyebrow="Precision Map"
          title={`${geoLabel} Map`}
          right={mapMetric === "distance" ? "Avg Distance" : "Appearances"}
        />

        <GeoHeatMap regionStats={activeGeoStats} metric={mapMetric} />
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
            className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl sm:rounded-[2rem] p-4 sm:p-6 shadow-2xl hover:bg-white/10 transition-all"
          >
            <div className="flex items-start justify-between gap-4 mb-5 sm:mb-6">
              <div>
                <p className="text-cyan-400 uppercase tracking-[0.2em] text-xs font-bold mb-2">
                  {geoLabel} Intelligence
                </p>

                <h3 className="text-xl sm:text-2xl font-black break-words">
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

function PlayersTab({ playerStats = [], dailyData = [] }) {
  const dailyPlayerStats = useMemo(() => buildDailyPlayerStats(dailyData), [dailyData])
  const playerProfiles = useMemo(() => {
    return playerStats.map((player) => ({
      ...player,
      daily: dailyPlayerStats.find((dailyPlayer) => dailyPlayer.name === player.name),
    }))
  }, [playerStats, dailyPlayerStats])

  const [selectedPlayerName, setSelectedPlayerName] = useState("")
  const [comparePlayerName, setComparePlayerName] = useState("")
  const selectedPlayer =
    playerProfiles.find((player) => player.name === selectedPlayerName) || playerProfiles[0]
  const comparisonPlayer =
    playerProfiles.find((player) => player.name === comparePlayerName) ||
    playerProfiles.find((player) => player.name !== selectedPlayer?.name)
  const bestDailyPlayer = [...playerProfiles]
    .filter((player) => player.daily)
    .sort((a, b) => a.daily.avgDistance - b.daily.avgDistance)[0]

  return (
    <>
      <PageHeader
        eyebrow="Player Database"
        title="Player Profiles"
        description="Individual dossiers for each league player, combining season performance, Daily Challenge form, and head-to-head comparison."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard
          label="Most CTPs"
          value={playerProfiles[0]?.name || "Loading"}
          sub={`${playerProfiles[0]?.ctps || 0} CTPs`}
          accent="cyan"
        />

        <StatCard
          label="Best Season Avg"
          value={formatDistance([...playerProfiles].sort((a, b) => a.avgDistance - b.avgDistance)[0]?.avgDistance)}
          sub={[...playerProfiles].sort((a, b) => a.avgDistance - b.avgDistance)[0]?.name || "Loading"}
          accent="purple"
        />

        <StatCard
          label="Best Daily Avg"
          value={formatDistance(bestDailyPlayer?.daily?.avgDistance)}
          sub={bestDailyPlayer?.name || "Waiting for daily data"}
          accent="emerald"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
        <Panel className="xl:col-span-2">
          <PanelHeader eyebrow="Profile Focus" title={selectedPlayer?.name || "Choose a Player"} right={selectedPlayer?.team || "Season"} />
          <PlayerProfileDetail player={selectedPlayer} />
        </Panel>

        <Panel>
          <PanelHeader eyebrow="Head-to-Head" title="Compare Players" right="Season + Daily" />
          <PlayerHeadToHead
            players={playerProfiles}
            selectedPlayer={selectedPlayer}
            comparisonPlayer={comparisonPlayer}
            selectedPlayerName={selectedPlayer?.name || ""}
            comparePlayerName={comparisonPlayer?.name || ""}
            setSelectedPlayerName={setSelectedPlayerName}
            setComparePlayerName={setComparePlayerName}
          />
        </Panel>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {playerProfiles.map((player) => {
          const brand = getTeamBrand(player.team)
          const isSelected = selectedPlayer?.name === player.name

          return (
          <button
            key={player.name}
            onClick={() => setSelectedPlayerName(player.name)}
            className={`relative overflow-hidden text-left bg-white/5 backdrop-blur-xl border rounded-2xl sm:rounded-[2rem] p-4 sm:p-6 shadow-2xl transition-all hover:scale-[1.02] ${brand.border} ${brand.glow} ${
              isSelected ? "ring-2 ring-cyan-300/70" : ""
            }`}
>
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 blur-3xl" />

            <div className="relative z-10 flex items-start justify-between gap-3 sm:gap-4 mb-5">
              <PlayerAvatar playerName={player.name} className="h-20 w-20 sm:h-24 sm:w-24" />

              <div className="flex items-center gap-2 min-w-0">
                <TeamLogo teamName={player.team} className="h-8 w-8 sm:h-9 sm:w-9" />
                <span className={`text-[0.65rem] sm:text-xs font-black uppercase tracking-[0.16em] sm:tracking-[0.2em] truncate ${brand.accent}`}>
                  {player.team}
                </span>
              </div>
            </div>

            <h3 className="text-2xl sm:text-3xl font-black mb-5 sm:mb-6 break-words">
              {player.name}
            </h3>

            <div className="space-y-3 sm:space-y-4">
              <MiniStat label="CTPs" value={player.ctps} accent="text-cyan-400" />
              <MiniStat label="Avg Distance" value={formatDistance(player.avgDistance)} />
              <MiniStat label="Best Region" value={player.bestRegion} accent="text-purple-400" />
              <MiniStat label="Daily Hit Rate" value={formatPercent(player.daily?.countryHitRate)} accent="text-emerald-400" />
              <MiniStat
                label="Consistency"
                value={player.consistency}
                accent="text-emerald-400"
              />
              <MiniStat label="KOs" value={player.kos} accent="text-pink-400" />
            </div>
          </button>
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

function PlayerProfileDetail({ player }) {
  if (!player) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-slate-400">
        Player data will appear here once the sheet loads.
      </div>
    )
  }

  const brand = getTeamBrand(player.team)
  const daily = player.daily
  const regionRanks = Object.entries(player.regions || {})
    .map(([name, data]) => ({
      name,
      appearances: data.count,
      avgDistance: data.totalDistance / data.count,
    }))
    .sort((a, b) => a.avgDistance - b.avgDistance)

  return (
    <div className="space-y-6">
      <div className={`rounded-2xl sm:rounded-[2rem] border ${brand.border} bg-white/5 p-4 sm:p-6`}>
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div className="flex flex-col sm:flex-row sm:items-end gap-5">
            <PlayerAvatar playerName={player.name} className="h-32 w-32 sm:h-40 sm:w-40" />

            <div>
              <div className="flex items-center gap-3 mb-3">
                <TeamLogo teamName={player.team} className="h-10 w-10" />
                <p className={`uppercase tracking-[0.2em] text-xs font-bold ${brand.accent}`}>
                  {player.team || "Free Agent"}
                </p>
              </div>

              <h3 className="text-3xl sm:text-5xl font-black break-words">{player.name}</h3>
              <p className="text-slate-400 mt-3 text-sm sm:text-base">
                {player.consistency} season profile with {player.ctps} CTPs and {player.kos} KOs.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 w-full lg:w-auto lg:min-w-64">
            <MiniStat label="Season Avg" value={formatDistance(player.avgDistance)} accent="text-cyan-400" />
            <MiniStat label="Daily Avg" value={formatDistance(daily?.avgDistance)} accent="text-emerald-400" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <MiniStat label="Country Hit" value={formatPercent(daily?.countryHitRate)} accent="text-purple-400" />
        <MiniStat label="Region Hit" value={formatPercent(daily?.regionHitRate)} accent="text-pink-400" />
        <MiniStat label="Daily Strongest" value={daily?.strongestRegion || "N/A"} accent="text-emerald-400" />
        <MiniStat label="Daily Weakest" value={daily?.weakestRegion || "N/A"} accent="text-amber-400" />
      </div>

      <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <div>
            <p className="text-emerald-400 uppercase tracking-[0.2em] text-xs font-bold mb-2">
              Recent Form
            </p>
            <h4 className="text-2xl font-black">Last 20 Guesses</h4>
          </div>

          <p className="text-slate-500 text-sm">
            Based on the most recent {player.recentForm?.sampleSize || 0} recorded CTP guesses.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <MiniStat label="Recent Avg" value={formatDistance(player.recentForm?.avgDistance)} accent="text-cyan-400" />
          <MiniStat label="Trend" value={player.recentForm?.trend || "N/A"} accent="text-emerald-400" />
          <MiniStat label="Best Recent Region" value={player.recentForm?.bestRegion || "N/A"} accent="text-purple-400" />
          <MiniStat label="Recent KOs" value={player.recentForm?.kos || 0} accent="text-pink-400" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
          <p className="text-cyan-400 uppercase tracking-[0.2em] text-xs font-bold mb-4">
            Best Season Regions
          </p>
          <div className="space-y-3">
            {regionRanks.slice(0, 4).map((region) => (
              <div key={region.name} className="flex items-center justify-between gap-4">
                <span className="font-bold">{region.name}</span>
                <span className="text-cyan-300 font-black">{formatDistance(region.avgDistance)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
          <p className="text-pink-400 uppercase tracking-[0.2em] text-xs font-bold mb-4">
            Watch List
          </p>
          <div className="space-y-3">
            {[...regionRanks].reverse().slice(0, 4).map((region) => (
              <div key={region.name} className="flex items-center justify-between gap-4">
                <span className="font-bold">{region.name}</span>
                <span className="text-pink-300 font-black">{formatDistance(region.avgDistance)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function PlayerHeadToHead({
  players,
  selectedPlayer,
  comparisonPlayer,
  selectedPlayerName,
  comparePlayerName,
  setSelectedPlayerName,
  setComparePlayerName,
}) {
  const metrics = [
    { label: "Season Avg", a: selectedPlayer?.avgDistance, b: comparisonPlayer?.avgDistance, format: formatDistance, lowerWins: true },
    { label: "CTPs", a: selectedPlayer?.ctps, b: comparisonPlayer?.ctps, format: (value) => value || 0 },
    { label: "KOs", a: selectedPlayer?.kos, b: comparisonPlayer?.kos, format: (value) => value || 0 },
    { label: "Daily Avg", a: selectedPlayer?.daily?.avgDistance, b: comparisonPlayer?.daily?.avgDistance, format: formatDistance, lowerWins: true },
    { label: "Country Hit", a: selectedPlayer?.daily?.countryHitRate, b: comparisonPlayer?.daily?.countryHitRate, format: formatPercent },
    { label: "Region Hit", a: selectedPlayer?.daily?.regionHitRate, b: comparisonPlayer?.daily?.regionHitRate, format: formatPercent },
  ]

  function winnerClass(metric, side) {
    if (!Number.isFinite(metric.a) || !Number.isFinite(metric.b) || metric.a === metric.b) {
      return "text-slate-300"
    }

    const aWins = metric.lowerWins ? metric.a < metric.b : metric.a > metric.b
    return (side === "a" && aWins) || (side === "b" && !aWins)
      ? "text-emerald-300"
      : "text-slate-300"
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3">
        <select
          value={selectedPlayerName}
          onChange={(event) => setSelectedPlayerName(event.target.value)}
          className="bg-[#0f172a] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white"
        >
          {players.map((player) => (
            <option key={player.name} value={player.name}>
              {player.name}
            </option>
          ))}
        </select>

        <select
          value={comparePlayerName}
          onChange={(event) => setComparePlayerName(event.target.value)}
          className="bg-[#0f172a] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white"
        >
          {players.map((player) => (
            <option key={player.name} value={player.name}>
              {player.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        {metrics.map((metric) => (
          <div key={metric.label} className="bg-white/5 rounded-2xl p-4 border border-white/10">
            <p className="text-slate-500 text-sm mb-2">{metric.label}</p>
            <div className="grid grid-cols-2 gap-3">
              <p className={`text-xl font-black ${winnerClass(metric, "a")}`}>
                {metric.format(metric.a)}
              </p>
              <p className={`text-xl font-black ${winnerClass(metric, "b")}`}>
                {metric.format(metric.b)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Panel({ children, className = "" }) {
  return (
    <div className={`bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl sm:rounded-[2rem] p-4 sm:p-6 shadow-2xl min-w-0 ${className}`}>
      {children}
    </div>
  )
}

function PanelHeader({ eyebrow, title, right }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-5 sm:mb-6">
      <div>
        <p className="text-cyan-400 uppercase tracking-[0.2em] text-[0.65rem] sm:text-xs font-bold mb-2">
          {eyebrow}
        </p>

        <h3 className="text-2xl sm:text-3xl font-black break-words">
          {title}
        </h3>
      </div>

      <div className="text-slate-500 text-xs sm:text-sm">
        {right}
      </div>
    </div>
  )
}

function StandingsTable({ teamStats = [] }) {
  return (
    <>
      <div className="hidden sm:grid grid-cols-4 text-slate-500 text-sm border-b border-white/10 pb-3 px-4">
        <div>Team</div>
        <div>CTPs</div>
        <div>Avg Distance</div>
        <div>KOs</div>
      </div>

      <div className="space-y-3 mt-4">
       {teamStats.map((team) => {
  const brand = getTeamBrand(team.name)

  return (
    <div
      key={team.name}
      className={`grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 items-center bg-white/5 hover:bg-white/10 transition-all rounded-2xl p-4 border ${brand.border} ${brand.glow}`}
    >
      <div className="font-bold col-span-2 sm:col-span-1">
        <span className={`flex items-center gap-3 ${brand.accent}`}>
          <TeamLogo teamName={team.name} className="h-8 w-8" />
          {team.name}
        </span>
      </div>

      <div className="font-semibold">
        <span className="sm:hidden text-slate-500 text-xs block">CTPs</span>
        {team.ctps}
      </div>

      <div>
        <span className="sm:hidden text-slate-500 text-xs block">Avg Distance</span>
        {team.avgDistance.toFixed(1)} km
      </div>

      <div className="text-emerald-400 font-semibold">
        <span className="sm:hidden text-slate-500 text-xs block">KOs</span>
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
        <div key={player.name} className="flex items-center justify-between gap-3 bg-white/5 rounded-2xl p-4 border border-white/10">
          <div className="flex items-center gap-3">
            <PlayerAvatar playerName={player.name} className="h-12 w-12" />

            <div className="min-w-0">
              <p className="font-bold truncate">{player.name}</p>
              <p className="text-slate-500 text-sm">{player.team}</p>
            </div>
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

function AverageDistanceList({ playerStats = [] }) {
  return (
    <div className="space-y-3">
      {[...playerStats]
        .sort((a, b) => a.avgDistance - b.avgDistance)
        .slice(0, 6)
        .map((player, index) => (
          <div key={player.name} className="flex items-center justify-between gap-3 bg-white/5 rounded-2xl p-4 border border-white/10">
            <div className="flex items-center gap-3">
              <PlayerAvatar playerName={player.name} className="h-12 w-12" />

              <div className="min-w-0">
                <p className="font-bold truncate">#{index + 1} {player.name}</p>
                <p className="text-slate-500 text-sm">{player.bestRegion}</p>
              </div>
            </div>

            <div className="text-right">
              <p className="text-cyan-400 font-black">{formatDistance(player.avgDistance)}</p>
              <p className="text-slate-500 text-xs">avg distance</p>
            </div>
          </div>
        ))}
    </div>
  )
}

function RecentFormTable({ playerStats = [] }) {
  const recentPlayers = [...playerStats]
    .filter((player) => player.recentForm?.sampleSize > 0)
    .sort((a, b) => a.recentForm.avgDistance - b.recentForm.avgDistance)

  return (
    <>
      <p className="text-slate-400 mb-5">
        Recent form uses each player&apos;s last 20 recorded CTP guesses, or fewer if they have not reached 20 yet.
      </p>

      <div className="hidden md:grid grid-cols-6 text-slate-500 text-sm border-b border-white/10 pb-3 px-4">
        <div>Player</div>
        <div>Guesses</div>
        <div>Avg Distance</div>
        <div>Trend</div>
        <div>Best Region</div>
        <div>KOs</div>
      </div>

      <div className="space-y-3 mt-4">
        {recentPlayers.map((player, index) => (
          <div
            key={player.name}
            className="grid grid-cols-1 md:grid-cols-6 gap-3 md:gap-4 items-center bg-white/5 hover:bg-white/10 transition-all rounded-2xl p-4 border border-white/10"
          >
            <div className="flex items-center gap-3">
              <PlayerAvatar playerName={player.name} className="h-12 w-12" />

              <div>
                <p className="font-black">#{index + 1} {player.name}</p>
                <p className="text-slate-500 text-xs md:hidden">Last {player.recentForm.sampleSize} guesses</p>
              </div>
            </div>

            <div className="font-semibold">
              Last {player.recentForm.sampleSize}
            </div>

            <div className="text-cyan-300 font-black">
              {formatDistance(player.recentForm.avgDistance)}
            </div>

            <div className={
              player.recentForm.trend === "Heating Up"
                ? "text-emerald-300 font-bold"
                : player.recentForm.trend === "Cooling Off"
                ? "text-amber-300 font-bold"
                : "text-slate-300 font-bold"
            }>
              {player.recentForm.trend}
            </div>

            <div className="font-bold">
              {player.recentForm.bestRegion}
            </div>

            <div className="text-pink-300 font-bold">
              {player.recentForm.kos}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

function MiniStat({ label, value, accent = "" }) {
  return (
    <div className="bg-white/5 rounded-2xl p-3 sm:p-4 border border-white/10 min-w-0">
      <p className="text-slate-500 text-xs sm:text-sm mb-2">
        {label}
      </p>

      <h4 className={`text-xl sm:text-2xl font-black break-words ${accent}`}>
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
function TeamComparisonChart({ teamStats = [] }) {

  const chartData = teamStats.map((team) => {
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
    <div className="mb-6 sm:mb-8 bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-xl flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
      <div>
        <p className="text-slate-500 text-xs uppercase tracking-[0.2em] font-bold mb-1">
          Global Filters
        </p>

        <p className="text-slate-300 text-sm">
          Filter every tab by team and game mode.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-3 sm:gap-4">
        <select
          value={selectedTeam}
          onChange={(event) => setSelectedTeam(event.target.value)}
          className="bg-[#0f172a] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white w-full md:w-auto"
        >
          <option value="All">All Teams</option>
          <option value="Lats">Lats</option>
          <option value="Bontswana">Bontswana</option>
        </select>

        <div className="flex gap-2 overflow-x-auto md:flex-wrap">
          {modes.map((mode) => (
            <button
              key={mode}
              onClick={() => toggleMode(mode)}
              className={`shrink-0 px-4 py-3 rounded-xl text-sm font-bold border transition-all ${
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
function GeoHeatMap({ regionStats = [], metric = "distance" }) {
  const [worldData, setWorldData] = useState(null)
  const [hoveredRegion, setHoveredRegion] = useState(null)
  const [selectedRegion, setSelectedRegion] = useState(null)

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
  const maxAppearances = Math.max(
    1,
    ...regionStats.map((item) => item.appearances || item.guesses || 0)
  )
  const mappedRegions = regionStats
    .map((item) => {
      const coords = GEO_COORDS[item.name]
      if (!coords) return null

      const projected = projection(coords)
      if (!projected) return null

      const tier = getDistanceTier(item.avgDistance)
      const appearances = item.appearances || item.guesses || 0
      const size = Math.min(
        metric === "volume" ? 34 : 28,
        Math.max(
          8,
          metric === "volume"
            ? 8 + (appearances / maxAppearances) * 24
            : Math.sqrt(Math.max(item.avgDistance, 1)) * 1.3
        )
      )

      return {
        ...item,
        x: projected[0],
        y: projected[1],
        size,
        tier,
        appearances,
      }
    })
    .filter(Boolean)
  const activeRegion = hoveredRegion || selectedRegion
  const unmappedCount = regionStats.length - mappedRegions.length

  return (
    <div className="relative h-[340px] sm:h-[420px] md:h-[520px] rounded-2xl sm:rounded-[2rem] bg-[#060b14] border border-white/10 overflow-hidden">
      <div className="absolute left-3 sm:left-4 top-3 sm:top-4 z-10 flex max-w-[calc(100%-1.5rem)] sm:max-w-none overflow-x-auto gap-2 pb-1">
        {[
          ["Strong", "#34d399", "< 50 km"],
          ["Mixed", "#fbbf24", "50-149 km"],
          ["Weak", "#fb7185", "150+ km"],
        ].map(([label, color, range]) => (
          <div key={label} className="shrink-0 flex items-center gap-2 rounded-xl bg-slate-950/80 border border-white/10 px-3 py-2 text-xs font-bold">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
            <span>{label}</span>
            <span className="hidden sm:inline text-slate-500">{range}</span>
          </div>
        ))}
      </div>

      {activeRegion && (
        <div className="absolute left-3 right-3 bottom-14 sm:left-auto sm:right-4 sm:top-4 sm:bottom-auto z-10 rounded-2xl bg-slate-950/90 border border-white/10 p-3 sm:p-4 shadow-2xl sm:min-w-52">
          <p className="text-cyan-400 uppercase tracking-[0.2em] text-xs font-bold mb-2">
            Map Readout
          </p>
          <p className="text-lg sm:text-xl font-black">{activeRegion.name}</p>
          <p className={`font-bold ${activeRegion.tier.text}`}>
            {activeRegion.tier.label} • {formatDistance(activeRegion.avgDistance)}
          </p>
          <p className="text-slate-500 text-xs mt-1">
            {activeRegion.appearances} entries
          </p>
        </div>
      )}

      <div className="absolute bottom-3 left-3 right-3 sm:right-auto sm:bottom-4 sm:left-4 z-10 rounded-2xl bg-slate-950/80 border border-white/10 px-3 sm:px-4 py-2 sm:py-3 text-xs text-slate-400">
        Marker size shows {metric === "volume" ? "how often a place appears" : "average miss distance"}.
        {unmappedCount > 0 && <span> {unmappedCount} item(s) need coordinates.</span>}
      </div>

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

        {mappedRegions.map((item) => {
          return (
            <g
              key={item.name}
              transform={`translate(${item.x}, ${item.y})`}
              onMouseEnter={() => setHoveredRegion(item)}
              onMouseLeave={() => setHoveredRegion(null)}
              onClick={() => setSelectedRegion(item)}
              className="cursor-pointer"
            >
              <circle
                r={item.size + 5}
                fill={item.tier.fill}
                opacity="0.14"
              />

              <circle
                r={item.size}
                fill={item.tier.fill}
                stroke="rgba(255,255,255,0.8)"
                strokeWidth="1.5"
                opacity="0.92"
              />

              <text
                textAnchor="middle"
                y={item.size + 14}
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
