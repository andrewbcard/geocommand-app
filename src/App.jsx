import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import {
  BarChart,
  Bar,
  Cell,
  CartesianGrid,
  LabelList,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import DailyChallengeTab from "./components/DailyChallengeTab.jsx"
import GeoHeatMap from "./components/GeoHeatMap.jsx"
import { PlayerAvatar, TeamLogo } from "./components/LeagueIdentity.jsx"
import { buildDailyPlayerStats, formatDistance, formatPercent, getDistanceTier } from "./data/stats.js"
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
function normalizeTeamName(teamName) {
  const normalized = String(teamName || "").trim().replace(/\s+/g, " ")
  const lower = normalized.toLowerCase()

  if (lower.includes("bontswana")) return "Bontswana"
  if (lower.includes("lats")) return "Lats"

  return normalized
}

function normalizePlayerName(playerName) {
  const normalized = String(playerName || "").normalize("NFKC").trim().replace(/\s+/g, " ")
  const canonicalNames = {
    "al harris": "Al Harris",
    "andrew card": "Andrew Card",
    "buddy hammon": "Buddy Hammon",
    "caleb heck": "Caleb Heck",
    "claleb heck": "Caleb Heck",
    "clark marshall": "Clark Marshall",
    "chris rossi": "Chris Rossi",
    "jarratt rouse": "Jarratt Rouse",
    "luke gasque": "Luke Gasque",
    "nick sant": "Nick Sant",
  }

  return canonicalNames[normalized.toLowerCase()] || normalized
}

function parseSheetDate(value) {
  const [month, day, year] = String(value || "").split("/").map(Number)

  if (!month || !day || !year) return 0

  const fullYear = year < 100 ? 2000 + year : year

  return new Date(fullYear, month - 1, day).getTime()
}

function getTeamBrand(teamName) {
  if (!teamName) return TEAM_BRANDING.Lats

  const normalized = normalizeTeamName(teamName).toLowerCase()

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
  const hasData = (row) => Object.values(row).some((value) => String(value || "").trim())
  const freshUrl = (url) => `${url}&cacheBust=${Date.now()}`

  const fetchSheets = () => {
    Papa.parse(freshUrl(RAW_DATA_URL), {
      download: true,
      header: true,
      complete: (results) => {
        setRawData(results.data.filter(hasData));
      },
      error: () => setRawData([]),
    });

    Papa.parse(freshUrl(DAILY_URL), {
      download: true,
      header: true,
      complete: (results) => {
        setDailyData(results.data.filter(hasData));
      },
      error: () => setDailyData([]),
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
      normalizeTeamName(row["CTP Team"]) === selectedTeam

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

const currentPlayerTeams = useMemo(() => {
  const latestTeams = {}

  rawData.forEach((row, index) => {
    const player = normalizePlayerName(row["CTP Player"])
    const team = normalizeTeamName(row["CTP Team"])
    const dateValue = parseSheetDate(row["Date"])

    if (!player || !team) return

    const existing = latestTeams[player]
    const sortValue = dateValue || index

    if (!existing || sortValue >= existing.sortValue) {
      latestTeams[player] = {
        team,
        sortValue,
      }
    }
  })

  return Object.fromEntries(
    Object.entries(latestTeams).map(([player, data]) => [player, data.team])
  )
}, [rawData])

const playerStats = useMemo(() => {
  const map = {};

  function ensurePlayer(player, team) {
    if (!map[player]) {
      map[player] = {
        name: player,
        team,
        ctps: 0,
        totalDistance: 0,
        kos: 0,
        defensivePins: 0,
        totalDefensiveDistance: 0,
        regions: {},
        recentRows: [],
      };
    }

    if (!map[player].team && team) {
      map[player].team = team
    }

    return map[player]
  }

  filteredRawData.forEach((row) => {
    const player = normalizePlayerName(row["CTP Player"]);
    const team = currentPlayerTeams[player] || normalizeTeamName(row["CTP Team"]);
    const region = row["Region"];
    const distance = parseFloat(row["CTP Distance (km)"]) || 0;
    const ko = row["Knockout Punch"];
    const defensivePlayer = normalizePlayerName(row["2nd CTP"]);
    const defensiveDistance = parseFloat(row["2nd CTP Distance"]) || 0;

    if (defensivePlayer) {
      const defender = ensurePlayer(defensivePlayer, currentPlayerTeams[defensivePlayer])

      defender.defensivePins += 1
      defender.totalDefensiveDistance += defensiveDistance
    }

    if (!player) return;

    const playerRecord = ensurePlayer(player, team)

    playerRecord.ctps += 1;
    playerRecord.totalDistance += distance;
    playerRecord.recentRows.push({
      region,
      distance,
      ko,
    });

    if (region) {
      if (!playerRecord.regions[region]) {
        playerRecord.regions[region] = {
          count: 0,
          totalDistance: 0,
        };
      }

      playerRecord.regions[region].count += 1;
      playerRecord.regions[region].totalDistance += distance;
    }

    if (ko && ko !== "-") {
      playerRecord.kos += 1;
    }
  });

  return Object.values(map)
    .filter((p) => p.ctps > 0)
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
        avgDistance: p.ctps > 0 ? p.totalDistance / p.ctps : 0,
        avgDefensiveDistance:
          p.defensivePins > 0 ? p.totalDefensiveDistance / p.defensivePins : 0,
        consistency:
          p.ctps > 0 && p.totalDistance / p.ctps < 50
            ? "Elite"
            : p.ctps > 0 && p.totalDistance / p.ctps < 150
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
}, [filteredRawData, currentPlayerTeams]);

const teamStats = useMemo(() => {
  const map = {};

  filteredRawData.forEach((row) => {
    const team = normalizeTeamName(row["CTP Team"]);
    const distance = parseFloat(row["CTP Distance (km)"]) || 0;
    const ko = row["Knockout Punch"];
    const defensivePlayer = normalizePlayerName(row["2nd CTP"]);
    const defensiveTeam = currentPlayerTeams[defensivePlayer];
    const defensiveDistance = parseFloat(row["2nd CTP Distance"]) || 0;

    if (!team) return;

    if (!map[team]) {
      map[team] = {
        name: team,
        ctps: 0,
        totalDistance: 0,
        kos: 0,
        defensivePins: 0,
        totalDefensiveDistance: 0,
      };
    }

    map[team].ctps += 1;
    map[team].totalDistance += distance;

    if (ko && ko !== "-") {
      map[team].kos += 1;
    }

    if (defensiveTeam) {
      if (!map[defensiveTeam]) {
        map[defensiveTeam] = {
          name: defensiveTeam,
          ctps: 0,
          totalDistance: 0,
          kos: 0,
          defensivePins: 0,
          totalDefensiveDistance: 0,
        }
      }

      map[defensiveTeam].defensivePins += 1
      map[defensiveTeam].totalDefensiveDistance += defensiveDistance
    }
  });

  return Object.values(map)
    .map((team) => ({
      ...team,
      avgDistance: team.ctps > 0 ? team.totalDistance / team.ctps : 0,
      avgDefensiveDistance:
        team.defensivePins > 0 ? team.totalDefensiveDistance / team.defensivePins : 0,
    }))
    .sort((a, b) => b.ctps - a.ctps);
}, [filteredRawData, currentPlayerTeams]);

const regionStats = useMemo(() => {
  const map = {};

  filteredRawData.forEach((row) => {
    const region = row["Region"];
    const player = normalizePlayerName(row["CTP Player"]);
    const distance = parseFloat(row["CTP Distance (km)"]) || 0;
    const defensivePlayer = normalizePlayerName(row["2nd CTP"]);
    const defensiveDistance = parseFloat(row["2nd CTP Distance"]) || 0;

    if (!region || !player) return;

    if (!map[region]) {
      map[region] = {
        name: region,
        appearances: 0,
        totalDistance: 0,
        defensivePins: 0,
        totalDefensiveDistance: 0,
        players: {},
        defensivePlayers: {},
      };
    }

    map[region].appearances += 1;
    map[region].totalDistance += distance;

    if (defensivePlayer) {
      map[region].defensivePins += 1
      map[region].totalDefensiveDistance += defensiveDistance

      if (!map[region].defensivePlayers[defensivePlayer]) {
        map[region].defensivePlayers[defensivePlayer] = {
          count: 0,
          totalDistance: 0,
        }
      }

      map[region].defensivePlayers[defensivePlayer].count += 1
      map[region].defensivePlayers[defensivePlayer].totalDistance += defensiveDistance
    }

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
      const bestDefensivePlayer =
        Object.entries(region.defensivePlayers)
          .map(([name, data]) => ({
            name,
            avgDistance: data.totalDistance / data.count,
          }))
          .sort((a, b) => a.avgDistance - b.avgDistance)[0];

      return {
        ...region,
        avgDistance: region.totalDistance / region.appearances,
        avgDefensiveDistance:
          region.defensivePins > 0 ? region.totalDefensiveDistance / region.defensivePins : 0,
        bestPlayer: bestPlayer?.name || "N/A",
        bestDefensivePlayer: bestDefensivePlayer?.name || "N/A",
      };
    })
    .sort((a, b) => a.avgDistance - b.avgDistance);
}, [filteredRawData]);

const countryStats = useMemo(() => {
  const map = {};

  filteredRawData.forEach((row) => {
    const country = row["Country/State"];
    const region = row["Region"];
    const player = normalizePlayerName(row["CTP Player"]);
    const distance = parseFloat(row["CTP Distance (km)"]) || 0;
    const defensivePlayer = normalizePlayerName(row["2nd CTP"]);
    const defensiveDistance = parseFloat(row["2nd CTP Distance"]) || 0;

    if (!country || !player) return;

    if (!map[country]) {
      map[country] = {
        name: country,
        region,
        appearances: 0,
        totalDistance: 0,
        defensivePins: 0,
        totalDefensiveDistance: 0,
        players: {},
        defensivePlayers: {},
      };
    }

    map[country].appearances += 1;
    map[country].totalDistance += distance;

    if (defensivePlayer) {
      map[country].defensivePins += 1
      map[country].totalDefensiveDistance += defensiveDistance

      if (!map[country].defensivePlayers[defensivePlayer]) {
        map[country].defensivePlayers[defensivePlayer] = {
          count: 0,
          totalDistance: 0,
        }
      }

      map[country].defensivePlayers[defensivePlayer].count += 1
      map[country].defensivePlayers[defensivePlayer].totalDistance += defensiveDistance
    }

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
      const bestDefensivePlayer =
        Object.entries(country.defensivePlayers)
          .map(([name, data]) => ({
            name,
            avgDistance: data.totalDistance / data.count,
          }))
          .sort((a, b) => a.avgDistance - b.avgDistance)[0];

      return {
        ...country,
        avgDistance: country.totalDistance / country.appearances,
        avgDefensiveDistance:
          country.defensivePins > 0 ? country.totalDefensiveDistance / country.defensivePins : 0,
        bestPlayer: bestPlayer?.name || "N/A",
        bestDefensivePlayer: bestDefensivePlayer?.name || "N/A",
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
      winner: normalizeTeamName(row["CTP Team"]) || "Unknown",
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

const leagueStats = useMemo(() => {
  const playerCount = playerStats.length
  const totalGuesses = filteredRawData.filter((row) => row["CTP Player"]).length
  const defensivePins = filteredRawData.filter((row) => row["2nd CTP"]).length
  const totalDistance = filteredRawData.reduce(
    (sum, row) => sum + (parseFloat(row["CTP Distance (km)"]) || 0),
    0
  )
  const bestTeam = [...teamStats].sort((a, b) => b.ctps - a.ctps || a.avgDistance - b.avgDistance)[0]

  return {
    totalGuesses,
    defensivePins,
    playerCount,
    avgDistance: totalGuesses > 0 ? totalDistance / totalGuesses : 0,
    bestTeam: bestTeam?.name || "N/A",
  }
}, [filteredRawData, playerStats, teamStats])

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
        {activeTab === "leaders" && <LeadersTab playerStats={playerStats} teamStats={teamStats} liveMatches={liveMatches} liveRegions={liveRegions} leagueStats={leagueStats} />}
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
          <span className="text-4xl sm:text-5xl font-black">01</span>
          <span className="text-cyan-400 font-semibold mb-1">Week 12</span>
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
    <div className={`premium-surface interactive-card relative overflow-hidden rounded-2xl sm:rounded-3xl border ${colors[accent]} bg-white/5 backdrop-blur-xl p-4 sm:p-6 shadow-2xl min-w-0`}>
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

function LeadersTab({ playerStats, teamStats, liveMatches, liveRegions, leagueStats }) {
  const ctpLeader = playerStats[0]
  const bestAvgPlayer = [...playerStats].sort((a, b) => a.avgDistance - b.avgDistance)[0]
  const koLeader = [...playerStats].sort((a, b) => b.kos - a.kos || a.avgDistance - b.avgDistance)[0]
  const defensiveLeader = [...playerStats].sort(
    (a, b) => b.defensivePins - a.defensivePins || a.avgDefensiveDistance - b.avgDefensiveDistance
  )[0]
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

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6 mb-8">
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
          label="Defensive Pins"
          value={defensiveLeader?.name || "Loading"}
          sub={`${defensiveLeader?.defensivePins || 0} pins`}
          accent="cyan"
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
          <PanelHeader eyebrow="Team Totals" title="CTPs, Defensive Pins, and KOs" right="Updated Live" />
          <StandingsTable teamStats={teamStats} />

          <div className="mt-8 border-t border-white/10 pt-6">
            <PanelHeader eyebrow="Team Comparison" title="CTP Share" right="Live" />
            <TeamComparisonChart teamStats={teamStats} />
          </div>
        </Panel>

        <MobileCollapsiblePanel eyebrow="Player Leaders" title="CTP Leaderboard" right="Season">
          <PlayerList playerStats={playerStats} />
        </MobileCollapsiblePanel>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-6">
        <MobileCollapsiblePanel className="xl:col-span-2" eyebrow="Recent Form" title="Last 20 Guesses" right="Lower is Better">
          <RecentFormTable playerStats={playerStats} />
        </MobileCollapsiblePanel>

        <MobileCollapsiblePanel eyebrow="Precision" title="Best Avg Distance" right="Season">
          <AverageDistanceList playerStats={playerStats} />
        </MobileCollapsiblePanel>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-6">
        <MobileCollapsiblePanel eyebrow="Defensive Specialists" title="Defensive Pins" right="Season">
          <DefensivePinsList playerStats={playerStats} />
        </MobileCollapsiblePanel>

        <MobileCollapsiblePanel eyebrow="Finishers" title="KOs Leaderboard" right="Season">
          <KoLeaderboard playerStats={playerStats} />
        </MobileCollapsiblePanel>
      </div>

      <BottomAnalytics liveMatches={liveMatches} liveRegions={liveRegions} leagueStats={leagueStats} />
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
        {activeGeoStats.map((region) => {
          const tier = getDistanceTier(region.avgDistance)

          return (
            <details
              key={region.name}
              className="interactive-card group bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl sm:rounded-[2rem] p-4 sm:p-6 shadow-2xl hover:bg-white/10 transition-all"
            >
              <summary className="list-none cursor-pointer">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-cyan-400 uppercase tracking-[0.2em] text-xs font-bold mb-2">
                    {geoLabel} Intelligence
                  </p>

                  <h3 className={`text-xl sm:text-2xl font-black break-words ${tier.text}`}>
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
              </summary>

              <div className="space-y-4 mt-5 sm:mt-6">
                <MiniStat
                  label="Top Specialist"
                  value={region.bestPlayer}
                  accent="text-cyan-400"
                />

                <MiniStat
                  label="CTPs"
                  value={region.appearances}
                  accent="text-cyan-400"
                />

                <MiniStat
                  label="Difficulty Tier"
                  value={tier.label}
                  accent={tier.text}
                />
              </div>
            </details>
          )
        })}
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
          sub={`${playerProfiles[0]?.ctps || 0} CTPs • ${playerProfiles[0]?.defensivePins || 0} Defensive Pins`}
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
          <details
            key={player.name}
            className={`interactive-card group relative overflow-hidden text-left bg-white/5 backdrop-blur-xl border rounded-2xl sm:rounded-[2rem] p-4 sm:p-6 shadow-2xl transition-all ${brand.border} ${brand.glow} ${
              isSelected ? "ring-2 ring-cyan-300/70" : ""
            }`}
>
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 blur-3xl" />

            <summary
              onClick={() => setSelectedPlayerName(player.name)}
              className="relative z-10 list-none cursor-pointer"
            >
              <div className="flex items-start justify-between gap-3 sm:gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <PlayerAvatar playerName={player.name} className="h-16 w-16 sm:h-20 sm:w-20" />

                  <div className="min-w-0">
                    <h3 className="text-xl sm:text-2xl font-black truncate">{player.name}</h3>
                    <p className="text-slate-400 text-sm">
                      {player.ctps} CTPs • {player.defensivePins} Defensive Pins
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 min-w-0">
                  <TeamLogo teamName={player.team} className="h-8 w-8 sm:h-9 sm:w-9" />
                  <span className={`hidden sm:inline text-xs font-black uppercase tracking-[0.2em] truncate ${brand.accent}`}>
                    {player.team}
                  </span>
                </div>
              </div>
            </summary>

            <div className="mt-5 space-y-3 sm:space-y-4">
              <MiniStat label="CTPs" value={player.ctps} accent="text-cyan-400" />
              <MiniStat label="Defensive Pins" value={player.defensivePins} accent="text-cyan-400" />
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
          </details>
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
                {player.consistency} season profile with {player.ctps} CTPs, {player.defensivePins} Defensive Pins, and {player.kos} KOs.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 w-full lg:w-auto lg:min-w-64">
            <MiniStat label="Season Avg" value={formatDistance(player.avgDistance)} accent="text-cyan-400" />
            <MiniStat label="Defensive Pins" value={player.defensivePins} accent="text-cyan-400" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <MiniStat label="Daily Avg" value={formatDistance(daily?.avgDistance)} accent="text-emerald-400" />
        <MiniStat label="Country Hit" value={formatPercent(daily?.countryHitRate)} accent="text-purple-400" />
        <MiniStat label="Region Hit" value={formatPercent(daily?.regionHitRate)} accent="text-pink-400" />
        <MiniStat label="Daily Strongest" value={daily?.strongestRegion || "N/A"} accent="text-emerald-400" />
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
    { label: "Defensive Pins", a: selectedPlayer?.defensivePins, b: comparisonPlayer?.defensivePins, format: (value) => value || 0 },
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
    <div className={`premium-surface bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl sm:rounded-[2rem] p-4 sm:p-6 shadow-2xl min-w-0 ${className}`}>
      {children}
    </div>
  )
}

function MobileCollapsiblePanel({ children, className = "", eyebrow, title, right }) {
  return (
    <>
      <details className={`premium-surface group bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl min-w-0 md:hidden ${className}`}>
        <summary className="list-none cursor-pointer">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-cyan-400 uppercase tracking-[0.2em] text-[0.65rem] font-bold mb-2">
                {eyebrow}
              </p>

              <h3 className="text-xl font-black break-words">
                {title}
              </h3>
            </div>

            <div className="flex shrink-0 items-center gap-3">
              <span className="hidden min-[420px]:inline text-slate-500 text-xs">
                {right}
              </span>

              <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 text-cyan-300 font-black transition-transform group-open:rotate-45">
                +
              </span>
            </div>
          </div>
        </summary>

        <div className="mt-5 border-t border-white/10 pt-5">
          {children}
        </div>
      </details>

      <Panel className={`hidden md:block ${className}`}>
        <PanelHeader eyebrow={eyebrow} title={title} right={right} />
        {children}
      </Panel>
    </>
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
      <div className="hidden sm:grid grid-cols-5 text-slate-500 text-sm border-b border-white/10 pb-3 px-4">
        <div>Team</div>
        <div>CTPs</div>
        <div>Defensive Pins</div>
        <div>Avg Distance</div>
        <div>KOs</div>
      </div>

      <div className="space-y-3 mt-4">
       {teamStats.map((team) => {
  const brand = getTeamBrand(team.name)

  return (
    <div
      key={team.name}
      className={`interactive-card grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4 items-center bg-white/5 hover:bg-white/10 transition-all rounded-2xl p-4 border ${brand.border} ${brand.glow}`}
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

      <div className="font-semibold text-cyan-300">
        <span className="sm:hidden text-slate-500 text-xs block">Defensive Pins</span>
        {team.defensivePins}
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

function DefensivePinsList({ playerStats = [] }) {
  const defensivePlayers = [...playerStats]
    .filter((player) => player.defensivePins > 0)
    .sort((a, b) => b.defensivePins - a.defensivePins || a.avgDefensiveDistance - b.avgDefensiveDistance)

  return (
    <div className="space-y-3">
      {defensivePlayers.slice(0, 6).map((player, index) => (
        <div key={player.name} className="flex items-center justify-between gap-3 bg-white/5 rounded-2xl p-4 border border-white/10">
          <div className="flex items-center gap-3 min-w-0">
            <PlayerAvatar playerName={player.name} className="h-12 w-12" />

            <div className="min-w-0">
              <p className="font-bold truncate">#{index + 1} {player.name}</p>
              <p className="text-slate-500 text-sm truncate">{player.team}</p>
            </div>
          </div>

          <div className="text-right shrink-0">
            <p className="text-cyan-300 font-black">{player.defensivePins}</p>
            <p className="text-slate-500 text-xs">pins</p>
            <p className="text-slate-300 text-xs mt-1">{formatDistance(player.avgDefensiveDistance)}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function KoLeaderboard({ playerStats = [] }) {
  const koPlayers = [...playerStats]
    .filter((player) => player.kos > 0)
    .sort((a, b) => b.kos - a.kos || a.avgDistance - b.avgDistance)

  return (
    <div className="space-y-3">
      {koPlayers.slice(0, 6).map((player, index) => (
        <div key={player.name} className="flex items-center justify-between gap-3 bg-white/5 rounded-2xl p-4 border border-white/10">
          <div className="flex items-center gap-3 min-w-0">
            <PlayerAvatar playerName={player.name} className="h-12 w-12" />

            <div className="min-w-0">
              <p className="font-bold truncate">#{index + 1} {player.name}</p>
              <p className="text-slate-500 text-sm truncate">{player.team}</p>
            </div>
          </div>

          <div className="text-right shrink-0">
            <p className="text-pink-300 font-black">{player.kos}</p>
            <p className="text-slate-500 text-xs">KOs</p>
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
              <span className="md:hidden block text-slate-500 text-xs">Guesses</span>
              Last {player.recentForm.sampleSize}
            </div>

            <div className="text-cyan-300 font-black">
              <span className="md:hidden block text-slate-500 text-xs">Avg Distance</span>
              {formatDistance(player.recentForm.avgDistance)}
            </div>

            <div className={
              player.recentForm.trend === "Heating Up"
                ? "text-emerald-300 font-bold"
                : player.recentForm.trend === "Cooling Off"
                ? "text-amber-300 font-bold"
                : "text-slate-300 font-bold"
            }>
              <span className="md:hidden block text-slate-500 text-xs">Trend</span>
              {player.recentForm.trend}
            </div>

            <div className="font-bold">
              <span className="md:hidden block text-slate-500 text-xs">Best Region</span>
              {player.recentForm.bestRegion}
            </div>

            <div className="text-pink-300 font-bold">
              <span className="md:hidden block text-slate-500 text-xs">KOs</span>
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
    <div className="premium-surface bg-white/5 rounded-2xl p-3 sm:p-4 border border-white/10 min-w-0">
      <p className="text-slate-500 text-xs sm:text-sm mb-2">
        {label}
      </p>

      <h4 className={`text-xl sm:text-2xl font-black break-words ${accent}`}>
        {value}
      </h4>
    </div>
  )
}

function BottomAnalytics({ liveMatches = [], liveRegions = [], leagueStats }) {
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
          <MiniStat label="CTP Entries" value={leagueStats?.totalGuesses || 0} />
          <MiniStat label="Defensive Pins" value={leagueStats?.defensivePins || 0} accent="text-cyan-400" />
          <MiniStat label="Avg Distance" value={formatDistance(leagueStats?.avgDistance)} accent="text-cyan-400" />
          <MiniStat label="Top Team" value={leagueStats?.bestTeam || "N/A"} />
          <MiniStat label="Players" value={leagueStats?.playerCount || 0} />
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
    .map((player) => ({
      ...player,
      fill: getDistanceTier(player.avgDistance).fill,
      shortName: player.name.split(" ").slice(-1)[0],
    }))

  return (
    <div className="h-[22rem] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 24, right: 12, left: 0, bottom: 10 }}
          barCategoryGap="24%"
        >
          <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" vertical={false} />
          <XAxis
            dataKey="shortName"
            stroke="#94a3b8"
            tick={{ fill: "#94a3b8", fontSize: 12, fontWeight: 700 }}
            tickLine={false}
            axisLine={{ stroke: "rgba(148, 163, 184, 0.35)" }}
            interval={0}
          />
          <YAxis
            stroke="#94a3b8"
            tick={{ fill: "#94a3b8", fontSize: 12, fontWeight: 700 }}
            tickLine={false}
            axisLine={false}
            width={42}
          />
          <Tooltip
            formatter={(value) => [formatDistance(value), "Avg Distance"]}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.name || ""}
            contentStyle={{
              background: "#0f172a",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "16px",
              color: "#fff",
            }}
          />
          <Bar dataKey="avgDistance" radius={[12, 12, 4, 4]} maxBarSize={88}>
            <LabelList
              dataKey="avgDistance"
              position="top"
              formatter={(value) => `${Math.round(value)} km`}
              fill="#e2e8f0"
              fontSize={12}
              fontWeight={800}
            />
            {chartData.map((entry, index) => (
              <Cell key={`player-distance-${index}`} fill={entry.fill} />
            ))}
          </Bar>
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
