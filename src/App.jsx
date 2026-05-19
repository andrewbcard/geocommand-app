import { useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { Check, Download, Share2 } from "lucide-react"
import { toPng } from "html-to-image"
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
import { buildDailyPlayerStats, formatDistance, formatPercent, getDistanceTier, parseNumber } from "./data/stats.js"
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

  "Latitude Longorias": {
    primary: "from-emerald-500 to-cyan-500",
    glow: "shadow-emerald-500/20",
    border: "border-emerald-400/30",
    accent: "text-emerald-300",
  },
}

const SEASON_OPTIONS = [
  { id: "2", label: "Season 2", badge: "02" },
  { id: "1", label: "Season 1", badge: "01" },
  { id: "all", label: "All-Time", badge: "All" },
]

function normalizeTeamName(teamName) {
  const normalized = String(teamName || "").trim().replace(/\s+/g, " ")
  const lower = normalized.toLowerCase()

  if (lower.includes("bontswana")) return "Bontswana"
  if (lower.includes("latitude longorias")) return "Latitude Longorias"
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

function getSheetValue(row, labels) {
  const normalizedLabels = labels.map((label) => label.toLowerCase())
  const entry = Object.entries(row).find(([key]) =>
    normalizedLabels.includes(String(key || "").trim().toLowerCase())
  )

  return entry?.[1] || ""
}

function getNumericSheetValue(row, labels) {
  return parseNumber(getSheetValue(row, labels))
}

function normalizeSeasonId(value) {
  const normalized = String(value || "").trim().toLowerCase()

  if (!normalized) return ""
  if (normalized === "1" || normalized === "s1" || normalized === "season 1") return "1"
  if (normalized === "2" || normalized === "s2" || normalized === "season 2") return "2"

  return normalized.replace(/^season\s+/i, "")
}

function getSeasonLabel(seasonId) {
  return SEASON_OPTIONS.find((season) => season.id === seasonId)?.label || `Season ${seasonId}`
}

function getSeasonBadge(seasonId) {
  return SEASON_OPTIONS.find((season) => season.id === seasonId)?.badge || seasonId
}

function rowMatchesSeason(row, selectedSeason, fallbackSeason = "1") {
  if (selectedSeason === "all") return true

  const season = normalizeSeasonId(getSheetValue(row, ["Season", "League Season"]))

  return (season || fallbackSeason) === selectedSeason
}

function getModeValue(row) {
  return getSheetValue(row, ["Mode", "Game Mode"])
}

function getTeamBrand(teamName) {
  if (!teamName) return TEAM_BRANDING.Lats

  const normalized = normalizeTeamName(teamName).toLowerCase()

  if (normalized.includes("bontswana")) {
    return TEAM_BRANDING.Bontswana
  }

  if (normalized.includes("latitude longorias")) {
    return TEAM_BRANDING["Latitude Longorias"]
  }

  return TEAM_BRANDING.Lats
}

function cleanScoreboardText(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ")
}

function cleanScoreboardMetric(value) {
  return cleanScoreboardText(value).replace(/^Mutliplier$/i, "Multiplier")
}

function stripTeamHeader(value) {
  return cleanScoreboardText(value).replace(/^Teams\s+/i, "")
}

function looksNumeric(value) {
  return /^-?[\d,.]+$/.test(cleanScoreboardText(value))
}

function formatScoreboardValue(value) {
  const cleanValue = cleanScoreboardText(value)

  if (!cleanValue) return "-"
  if (!looksNumeric(cleanValue)) return cleanValue

  const number = parseNumber(cleanValue)

  return number.toLocaleString("en-US", {
    maximumFractionDigits: 2,
  })
}

function parseTeamScoreboardRows(rows = []) {
  const rowArrays = rows
    .map((row) => (Array.isArray(row) ? row : Object.values(row)))
    .filter((row) => row.some((cell) => cleanScoreboardText(cell)))

  if (rowArrays.length === 0) return []

  const header = rowArrays[0].map(cleanScoreboardText)
  const seasonStarts = header
    .map((cell, index) => {
      const match = cell.match(/^Season\s*(\d+)/i)
      return match ? { id: match[1], label: `Season ${match[1]}`, start: index } : null
    })
    .filter(Boolean)

  return seasonStarts
    .map((season, index) => {
      const end = seasonStarts[index + 1]?.start ?? header.length
      const teamStart = header.findIndex((cell, columnIndex) =>
        columnIndex >= season.start &&
        columnIndex < end &&
        /^Teams\b/i.test(cell)
      )

      if (teamStart === -1) return null

      const teams = []

      for (let columnIndex = teamStart; columnIndex < end; columnIndex += 1) {
        const teamName = normalizeTeamName(stripTeamHeader(header[columnIndex]))

        if (teamName) {
          teams.push({
            name: teamName,
            columnIndex,
          })
        }
      }

      let currentLabel = ""
      const entries = rowArrays.slice(1)
        .map((row, rowIndex) => {
          const label = cleanScoreboardMetric(row[season.start])
          const detailCells = []

          for (let columnIndex = season.start + 1; columnIndex < teamStart; columnIndex += 1) {
            const cell = cleanScoreboardMetric(row[columnIndex])

            if (cell) {
              detailCells.push(cell)
            }
          }

          const hasTeamValues = teams.some((team) => cleanScoreboardText(row[team.columnIndex]))

          if (!label && detailCells.length === 0 && !hasTeamValues) {
            return null
          }

          if (label) {
            currentLabel = label
          }

          if (!currentLabel) {
            return null
          }

          const metric = detailCells.at(-1) || (label ? "Total" : "")
          const category = detailCells.length > 1 ? detailCells.slice(0, -1).join(" ") : ""

          return {
            id: `${season.id}-${rowIndex}`,
            label: label || currentLabel,
            category,
            metric,
            values: teams.map((team) => ({
              team: team.name,
              value: formatScoreboardValue(row[team.columnIndex]),
            })),
            isTotal:
              /total/i.test(label || currentLabel) ||
              /total/i.test(metric) ||
              /grand total/i.test(metric),
          }
        })
        .filter(Boolean)

      return {
        ...season,
        teams,
        entries,
      }
    })
    .filter(Boolean)
}
export default function App() {
  const [rawData, setRawData] = useState([]);
const [dailyData, setDailyData] = useState([]);
const [playerInfoData, setPlayerInfoData] = useState([]);
const [teamScoreboardData, setTeamScoreboardData] = useState([]);
const [awardsData, setAwardsData] = useState([]);
const [geoguessrActivity, setGeoguessrActivity] = useState({
  players: [],
  checkedAt: null,
  loading: true,
  error: null,
});

const RAW_DATA_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQeSSeiTso_obYVNbArRVNpz2PBW5LuQ24dEDMG0kdBH4axSCAajaP6_GTbBENbyRraoOrXUE4Bjitj/pub?gid=0&single=true&output=csv";

const DAILY_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQeSSeiTso_obYVNbArRVNpz2PBW5LuQ24dEDMG0kdBH4axSCAajaP6_GTbBENbyRraoOrXUE4Bjitj/pub?gid=1946076674&single=true&output=csv";

const PLAYER_INFO_URL =
  "https://docs.google.com/spreadsheets/d/1ev1Gw72evcdMUp-M1xSOEuZJiarnOK4NKxscPVQiXeY/gviz/tq?tqx=out:csv&sheet=Player%20Info";

const TEAM_SCOREBOARD_URL =
  "https://docs.google.com/spreadsheets/d/1ev1Gw72evcdMUp-M1xSOEuZJiarnOK4NKxscPVQiXeY/gviz/tq?tqx=out:csv&sheet=team%20scoreboard";

const AWARDS_URL =
  "https://docs.google.com/spreadsheets/d/1ev1Gw72evcdMUp-M1xSOEuZJiarnOK4NKxscPVQiXeY/gviz/tq?tqx=out:csv&sheet=awards%20%26%20accolades";

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

    Papa.parse(freshUrl(PLAYER_INFO_URL), {
      download: true,
      header: true,
      complete: (results) => {
        setPlayerInfoData(results.data.filter(hasData));
      },
      error: () => setPlayerInfoData([]),
    });

    Papa.parse(freshUrl(TEAM_SCOREBOARD_URL), {
      download: true,
      header: false,
      complete: (results) => {
        setTeamScoreboardData(results.data.filter(hasData));
      },
      error: () => setTeamScoreboardData([]),
    });

    Papa.parse(freshUrl(AWARDS_URL), {
      download: true,
      header: true,
      complete: (results) => {
        setAwardsData(results.data.filter(hasData));
      },
      error: () => setAwardsData([]),
    });
  };

  fetchSheets();

  const interval = setInterval(fetchSheets, 30000);

  return () => clearInterval(interval);
}, []);

useEffect(() => {
  let isMounted = true

  async function fetchActivity() {
    try {
      const response = await fetch("/api/geoguessr-activity")

      if (!response.ok) {
        throw new Error("GeoGuessr activity feed unavailable")
      }

      const activity = await response.json()

      if (isMounted) {
        setGeoguessrActivity({
          ...activity,
          loading: false,
          error: null,
        })
      }
    } catch (error) {
      if (isMounted) {
        setGeoguessrActivity((current) => ({
          ...current,
          loading: false,
          error: error.message,
        }))
      }
    }
  }

  fetchActivity()

  const interval = window.setInterval(fetchActivity, 60 * 1000)

  return () => {
    isMounted = false
    window.clearInterval(interval)
  }
}, [])
  const [activeTab, setActiveTab] = useState("leaders")
  const [selectedSeason, setSelectedSeason] = useState("all")

  const [selectedTeam, setSelectedTeam] = useState("All")

const [selectedModes, setSelectedModes] = useState([
  "Move",
  "No Move",
  "NMPZ",
])

const selectedSeasonLabel = getSeasonLabel(selectedSeason)
const teamScoreboardSeasons = useMemo(
  () => parseTeamScoreboardRows(teamScoreboardData),
  [teamScoreboardData]
)

const currentPlayerTeams = useMemo(() => {
  const infoTeams = {}

  playerInfoData.forEach((row) => {
    const player = normalizePlayerName(getSheetValue(row, ["Player", "Player Name", "Name"]))
    const team = normalizeTeamName(getSheetValue(row, ["Current team", "Current Team"]))

    if (player && team) {
      infoTeams[player] = team
    }
  })

  if (Object.keys(infoTeams).length > 0) {
    return infoTeams
  }

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
}, [playerInfoData, rawData])

const filteredRawData = useMemo(() => {
  return rawData.filter((row) => {
    const seasonMatches = rowMatchesSeason(row, selectedSeason)
    const player = normalizePlayerName(row["CTP Player"])
    const currentTeam = currentPlayerTeams[player] || normalizeTeamName(row["CTP Team"])
    const teamMatches =
      selectedTeam === "All" ||
      currentTeam === selectedTeam

    const mode = getModeValue(row)

    const modeMatches =
      !mode || selectedModes.includes(mode)

    return seasonMatches && teamMatches && modeMatches
  })
}, [currentPlayerTeams, rawData, selectedSeason, selectedTeam, selectedModes])

const filteredDailyData = useMemo(() => {
  return dailyData.filter((row) => {
    const seasonMatches = rowMatchesSeason(row, selectedSeason)
    const mode = getModeValue(row)

    return seasonMatches && (!mode || selectedModes.includes(mode))
  })
}, [dailyData, selectedSeason, selectedModes])

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
    const distance = getNumericSheetValue(row, ["CTP Distance (km)", "CTP Distance"]);
    const ko = row["Knockout Punch"];
    const defensivePlayer = normalizePlayerName(row["2nd CTP"]);
    const defensiveDistance = getNumericSheetValue(row, ["2nd CTP Distance (km)", "2nd CTP Distance"]);

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
    const distance = getNumericSheetValue(row, ["CTP Distance (km)", "CTP Distance"]);
    const ko = row["Knockout Punch"];
    const defensivePlayer = normalizePlayerName(row["2nd CTP"]);
    const defensiveTeam =
      normalizeTeamName(getSheetValue(row, ["2nd CTP Team", "Second CTP Team", "Defensive Team"])) ||
      currentPlayerTeams[defensivePlayer];
    const defensiveDistance = getNumericSheetValue(row, ["2nd CTP Distance (km)", "2nd CTP Distance"]);

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

    if (defensiveTeam && (selectedTeam === "All" || defensiveTeam === selectedTeam)) {
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
}, [currentPlayerTeams, filteredRawData, selectedTeam]);

const regionStats = useMemo(() => {
  const map = {};

  filteredRawData.forEach((row) => {
    const region = row["Region"];
    const player = normalizePlayerName(row["CTP Player"]);
    const distance = getNumericSheetValue(row, ["CTP Distance (km)", "CTP Distance"]);
    const defensivePlayer = normalizePlayerName(row["2nd CTP"]);
    const defensiveDistance = getNumericSheetValue(row, ["2nd CTP Distance (km)", "2nd CTP Distance"]);

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
    const distance = getNumericSheetValue(row, ["CTP Distance (km)", "CTP Distance"]);
    const defensivePlayer = normalizePlayerName(row["2nd CTP"]);
    const defensiveDistance = getNumericSheetValue(row, ["2nd CTP Distance (km)", "2nd CTP Distance"]);

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
      score: `${row["CTP Player"] || "Unknown"} • ${formatDistance(getNumericSheetValue(row, ["CTP Distance (km)", "CTP Distance"]))}`,
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
    (sum, row) => sum + getNumericSheetValue(row, ["CTP Distance (km)", "CTP Distance"]),
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
    <div className="min-h-screen bg-[#070b14] text-white overflow-x-hidden pb-24">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top_right,#1d4ed830,transparent_35%),radial-gradient(circle_at_bottom_left,#06b6d430,transparent_35%)] pointer-events-none" />

      <div className="relative z-10 p-4 sm:p-6 md:p-10">
        <TopNav activeTab={activeTab} setActiveTab={setActiveTab} />

        <FilterBar
          selectedSeason={selectedSeason}
          setSelectedSeason={setSelectedSeason}
          selectedTeam={selectedTeam}
          setSelectedTeam={setSelectedTeam}
          selectedModes={selectedModes}
          setSelectedModes={setSelectedModes}
        />
<div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs sm:text-sm font-bold">
  <p className="text-green-400">
    Raw Entries in View: {filteredRawData.length}
  </p>

  <p className="text-cyan-400">
    Daily Entries in View: {filteredDailyData.length}
  </p>

  <p className="text-pink-400">
    Season View: {selectedSeasonLabel}
  </p>
</div>
        {activeTab === "leaders" && (
          <LeadersTab
            playerStats={playerStats}
            teamStats={teamStats}
            liveMatches={liveMatches}
            liveRegions={liveRegions}
            leagueStats={leagueStats}
            selectedSeason={selectedSeason}
            selectedSeasonLabel={selectedSeasonLabel}
            awardsData={awardsData}
          />
        )}
        {activeTab === "scoreboard" && (
          <ScoreboardTab
            seasons={teamScoreboardSeasons}
            selectedSeason={selectedSeason}
            selectedSeasonLabel={selectedSeasonLabel}
          />
        )}
        {activeTab === "regions" && (
          <RegionsTab
            regionStats={regionStats}
            countryStats={countryStats}
            selectedSeasonLabel={selectedSeasonLabel}
          />
        )}
        {activeTab === "players" && <PlayersTab playerStats={playerStats} dailyData={filteredDailyData} selectedSeasonLabel={selectedSeasonLabel} />}
        {activeTab === "daily" && <DailyChallengeTab dailyData={filteredDailyData} selectedSeasonLabel={selectedSeasonLabel} />}
      </div>

      <GeoGuessrActivityTicker activity={geoguessrActivity} />
    </div>
  )
}

function formatActivityTime(minutesAgo) {
  if (!Number.isFinite(minutesAgo)) return "status unknown"
  if (minutesAgo <= 1) return "just now"
  if (minutesAgo < 60) return `${minutesAgo} min ago`

  const hoursAgo = Math.round(minutesAgo / 60)
  if (hoursAgo < 24) return `${hoursAgo} hr ago`

  return `${Math.round(hoursAgo / 24)} d ago`
}

function GeoGuessrActivityTicker({ activity }) {
  const activePlayers = activity.players.filter((player) =>
    ["active", "likely-active"].includes(player.status)
  )
  const hasActivePlayers = activePlayers.length > 0

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-red-400/20 bg-[#050812]/95 px-3 py-3 text-white shadow-[0_-18px_50px_rgba(0,0,0,0.45)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center gap-3 overflow-hidden">
        <span className={`activity-light h-3 w-3 shrink-0 rounded-full ${hasActivePlayers ? "bg-red-500" : "bg-slate-500"}`} />

        <p className="shrink-0 text-xs font-black uppercase tracking-[0.2em] text-red-200">
          Playing Now:
        </p>

        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="activity-marquee flex w-max items-center gap-5">
            {activity.loading && (
              <span className="text-sm font-bold text-slate-400">Checking GeoGuessr activity...</span>
            )}

            {!activity.loading && activity.error && (
              <span className="text-sm font-bold text-slate-400">Activity feed unavailable</span>
            )}

            {!activity.loading && !activity.error && !hasActivePlayers && (
              <span className="text-sm font-bold text-slate-400">No players active recently</span>
            )}

            {!activity.loading && !activity.error &&
              activePlayers.map((player) => (
                <a
                  key={player.id}
                  href={player.url}
                  target="_blank"
                  rel="noreferrer"
                  className="whitespace-nowrap text-sm font-black text-white transition-colors hover:text-cyan-300"
                >
                  {player.name}
                  <span className="ml-2 text-xs font-bold text-slate-400">
                    {player.status === "active" ? "active" : "active recently"} {formatActivityTime(player.minutesAgo)}
                  </span>
                </a>
              ))}

            {!activity.loading && !activity.error &&
              activePlayers.map((player) => (
                <a
                  key={`${player.id}-mobile-repeat`}
                  href={player.url}
                  target="_blank"
                  rel="noreferrer"
                  className="whitespace-nowrap text-sm font-black text-white transition-colors hover:text-cyan-300 md:hidden"
                >
                  {player.name}
                  <span className="ml-2 text-xs font-bold text-slate-400">
                    {player.status === "active" ? "active" : "active recently"} {formatActivityTime(player.minutesAgo)}
                  </span>
                </a>
              ))}
          </div>
        </div>

        {activity.checkedAt && (
          <p className="hidden shrink-0 text-xs font-bold text-slate-500 sm:block">
            Checks every minute
          </p>
        )}
      </div>
    </div>
  )
}

function TopNav({ activeTab, setActiveTab }) {
    const tabs = [
      { id: "leaders", label: "Leaders" },
      { id: "scoreboard", label: "Scoreboard" },
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

function PageHeader({ eyebrow, title, description, seasonLabel = "All-Time" }) {
  const seasonId = SEASON_OPTIONS.find((season) => season.label === seasonLabel)?.id || "all"

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
          Stats View
        </p>

        <div className="flex items-end gap-3 mt-2">
          <span className="text-4xl sm:text-5xl font-black">{getSeasonBadge(seasonId)}</span>
          <span className="text-cyan-400 font-semibold mb-1">{seasonLabel}</span>
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

function LeadersTab({
  playerStats,
  teamStats,
  liveMatches,
  liveRegions,
  leagueStats,
  selectedSeason,
  selectedSeasonLabel,
  awardsData,
}) {
  const ctpLeader = playerStats[0]
  const bestAvgPlayer = [...playerStats].sort((a, b) => a.avgDistance - b.avgDistance)[0]
  const koLeader = [...playerStats].sort((a, b) => b.kos - a.kos || a.avgDistance - b.avgDistance)[0]
  const defensiveLeader = [...playerStats].sort(
    (a, b) => b.defensivePins - a.defensivePins || a.avgDefensiveDistance - b.avgDefensiveDistance
  )[0]
  const bestRecentPlayer = [...playerStats]
    .filter((player) => player.recentForm?.sampleSize > 0)
    .sort((a, b) => a.recentForm.avgDistance - b.recentForm.avgDistance)[0]
  const emptyLeaderLabel = "No Data Yet"

  return (
    <>
      <PageHeader
        eyebrow="Competitive Analytics"
        title="League Leaders"
        description="Real league leaderboards for CTPs, average distance, knockouts, team totals, recent results, and last-20-guess form."
        seasonLabel={selectedSeasonLabel}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6 mb-8">
        <StatCard
          label="CTP Leader"
          value={ctpLeader?.name || emptyLeaderLabel}
          sub={`${ctpLeader?.ctps || 0} CTPs`}
          accent="cyan"
        />

        <StatCard
          label="Best Avg Distance"
          value={formatDistance(bestAvgPlayer?.avgDistance)}
          sub={bestAvgPlayer?.name || emptyLeaderLabel}
          accent="purple"
        />

        <StatCard
          label="KO Leader"
          value={koLeader?.name || emptyLeaderLabel}
          sub={`${koLeader?.kos || 0} KOs`}
          accent="pink"
        />

        <StatCard
          label="Defensive Pins"
          value={defensiveLeader?.name || emptyLeaderLabel}
          sub={`${defensiveLeader?.defensivePins || 0} pins`}
          accent="cyan"
        />

        <StatCard
          label="Best Recent Form"
          value={formatDistance(bestRecentPlayer?.recentForm?.avgDistance)}
          sub={`${bestRecentPlayer?.name || emptyLeaderLabel} • Last 20 guesses`}
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

      <BottomAnalytics
        liveMatches={liveMatches}
        liveRegions={liveRegions}
        leagueStats={leagueStats}
        selectedSeasonLabel={selectedSeasonLabel}
      />

      <AwardsAccoladesCard
        awardsData={awardsData}
        selectedSeason={selectedSeason}
        selectedSeasonLabel={selectedSeasonLabel}
      />
    </>
  )
}

function ScoreboardTab({ seasons = [], selectedSeason, selectedSeasonLabel }) {
  return (
    <>
      <PageHeader
        eyebrow="Team Scoreboard"
        title="Team Scoreboard"
        description="Weekly team scoring from the Team Scoreboard sheet, with expandable details for battle wins, modes, Tuesdaily points, and totals."
        seasonLabel={selectedSeasonLabel}
      />

      <TeamScoreboardSection
        seasons={seasons}
        selectedSeason={selectedSeason}
        selectedSeasonLabel={selectedSeasonLabel}
      />
    </>
  )
}

function TeamScoreboardSection({ seasons = [], selectedSeason, selectedSeasonLabel }) {
  const visibleSeasons =
    selectedSeason === "all"
      ? seasons
      : seasons.filter((season) => season.id === selectedSeason)

  return (
    <Panel className="mb-6">
      <PanelHeader
        eyebrow="Team Scoreboard"
        title="Team Scoreboard"
        right={selectedSeason === "all" ? "All Seasons" : selectedSeasonLabel}
      />

      {visibleSeasons.length > 0 ? (
        <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4 sm:gap-6">
          {visibleSeasons.map((season) => (
            <ScoreboardSeasonTable key={season.id} season={season} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm font-bold text-slate-400">
          {selectedSeasonLabel} scoreboard data will appear here once the Google Sheet has entries.
        </div>
      )}
    </Panel>
  )
}

function formatScoreboardLineLabel(entry) {
  if (entry.category) {
    return `${entry.category}: ${entry.metric || "Score"}`
  }

  if (/^(no move|nmpz)$/i.test(entry.metric || "")) {
    return `Battle Wins: ${entry.metric}`
  }

  return entry.metric || "Score"
}

function buildScoreboardGroups(entries = []) {
  const weekGroups = []
  const seasonTotals = []
  const weekPattern = /^week\s+\d+/i

  entries.forEach((entry) => {
    const label = cleanScoreboardText(entry.label)

    if (!weekPattern.test(label)) {
      seasonTotals.push(entry)
      return
    }

    let group = weekGroups.find((item) => item.label === label)

    if (!group) {
      group = {
        label,
        entries: [],
      }
      weekGroups.push(group)
    }

    group.entries.push(entry)
  })

  return {
    weekGroups: weekGroups.map((group) => {
      const totalEntry =
        [...group.entries].reverse().find((entry) => /total/i.test(entry.metric)) ||
        group.entries[group.entries.length - 1]

      return {
        ...group,
        totalEntry,
        detailEntries: group.entries.filter((entry) => entry !== totalEntry),
      }
    }),
    seasonTotals,
  }
}

function ScoreboardSeasonTable({ season }) {
  const { weekGroups, seasonTotals } = buildScoreboardGroups(season.entries)
  const seasonTotalEntry =
    [...seasonTotals].reverse().find((entry) => /grand total|total/i.test(entry.metric)) ||
    seasonTotals[seasonTotals.length - 1]

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0b1220]/70 p-4 sm:p-5">
      <div className="mb-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-emerald-300 text-xs font-black uppercase tracking-[0.2em]">
            Scoreboard
          </p>
          <h4 className="mt-2 text-2xl font-black">{season.label}</h4>
        </div>

        <div className="flex flex-wrap gap-2">
          {season.teams.map((team) => {
            const brand = getTeamBrand(team.name)

            return (
              <span
                key={team.name}
                className={`inline-flex items-center gap-2 rounded-xl border ${brand.border} bg-white/5 px-3 py-2 text-xs font-black ${brand.accent}`}
              >
                <TeamLogo teamName={team.name} className="h-5 w-5" />
                {team.name}
              </span>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        {weekGroups.map((week) => (
          <ScoreboardWeekCard key={week.label} week={week} teams={season.teams} />
        ))}
      </div>

      {seasonTotalEntry && (
        <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 sm:p-5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <p className="text-emerald-300 text-xs font-black uppercase tracking-[0.2em]">
                Season Total
              </p>
              <h5 className="mt-2 text-xl font-black">{formatScoreboardLineLabel(seasonTotalEntry)}</h5>
            </div>

            <ScoreboardTeamValues values={seasonTotalEntry.values} compact={false} />
          </div>
        </div>
      )}
    </div>
  )
}

function ScoreboardWeekCard({ week, teams }) {
  return (
    <details className="interactive-card group rounded-2xl border border-white/10 bg-white/5 p-4 transition-all hover:bg-white/10">
      <summary className="list-none cursor-pointer">
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-[0.18em]">
                Weekly Total
              </p>
              <h5 className="mt-2 text-2xl font-black">{week.label}</h5>
            </div>

            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/10 text-cyan-300 font-black transition-transform group-open:rotate-45">
              +
            </div>
          </div>

          <ScoreboardTeamValues values={week.totalEntry?.values || []} />
        </div>
      </summary>

      <div className="mt-5 border-t border-white/10 pt-5">
        <div className="hidden sm:grid text-slate-500 text-xs font-bold uppercase tracking-[0.14em]" style={{ gridTemplateColumns: `minmax(12rem, 1.5fr) repeat(${teams.length}, minmax(6rem, 1fr))` }}>
          <div className="px-3 pb-2">Entry</div>
          {teams.map((team) => (
            <div key={team.name} className="px-3 pb-2 text-right">
              {team.name}
            </div>
          ))}
        </div>

        <div className="space-y-2">
          {week.detailEntries.map((entry) => (
            <div
              key={entry.id}
              className="grid grid-cols-1 sm:items-center gap-2 rounded-xl bg-[#070b14]/70 p-3 text-sm sm:grid-cols-[minmax(12rem,1.5fr)_1fr]"
            >
              <p className="font-bold text-slate-200">{formatScoreboardLineLabel(entry)}</p>

              <ScoreboardTeamValues values={entry.values} compact />
            </div>
          ))}

          {week.detailEntries.length === 0 && (
            <div className="rounded-xl bg-[#070b14]/70 p-3 text-sm font-bold text-slate-400">
              No detail lines recorded for this week yet.
            </div>
          )}
        </div>
      </div>
    </details>
  )
}

function ScoreboardTeamValues({ values = [], compact = true }) {
  return (
    <div className={`grid gap-2 ${compact ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2"}`}>
      {values.map((value) => {
        const brand = getTeamBrand(value.team)

        return (
          <div
            key={`${value.team}-${value.value}`}
            className={`rounded-xl border ${brand.border} bg-white/5 px-3 py-2 text-right`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className={`flex min-w-0 items-center gap-2 text-xs font-black ${brand.accent}`}>
                <TeamLogo teamName={value.team} className="h-5 w-5" />
                <span className="truncate">{value.team}</span>
              </span>
              <span className="shrink-0 text-lg font-black text-white">{value.value}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function AwardsAccoladesCard({ awardsData = [], selectedSeason, selectedSeasonLabel }) {
  const categories = [
    { key: "Team Champion", label: "Team Champion", type: "team", accent: "text-cyan-300" },
    { key: "MVP", label: "MVP", accent: "text-emerald-300" },
    { key: "KO Champion", label: "KO Champion", accent: "text-pink-300" },
    { key: "CTP Champion", label: "CTP Champion", accent: "text-purple-300" },
    { key: "KPPG Champion", label: "KPPG Champion", accent: "text-amber-300" },
    { key: "CTPPG Champion", label: "CTPPG Champion", accent: "text-cyan-300" },
  ]

  const visibleAwards = awardsData
    .filter((row) => normalizeSeasonId(getSheetValue(row, ["Season"])))
    .filter((row) => {
      if (selectedSeason === "all") return true

      return normalizeSeasonId(getSheetValue(row, ["Season"])) === selectedSeason
    })
    .sort((a, b) => {
      const first = Number(normalizeSeasonId(getSheetValue(a, ["Season"]))) || 0
      const second = Number(normalizeSeasonId(getSheetValue(b, ["Season"]))) || 0

      return second - first
    })

  return (
    <Panel className="mt-6">
      <PanelHeader
        eyebrow="Awards & Accolades"
        title="Awards & Accolades"
        right={selectedSeason === "all" ? "All-Time Honors" : selectedSeasonLabel}
      />

      {visibleAwards.length > 0 ? (
        <div className="space-y-4">
          {visibleAwards.map((row) => {
            const seasonId = normalizeSeasonId(getSheetValue(row, ["Season"]))

            return (
              <div key={seasonId} className="rounded-2xl border border-white/10 bg-[#0b1220]/70 p-4 sm:p-5">
                <div className="mb-5 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-cyan-300 text-xs font-black uppercase tracking-[0.2em]">
                      Hall of Results
                    </p>
                    <h4 className="mt-2 text-2xl font-black">{getSeasonLabel(seasonId)}</h4>
                  </div>

                  <span className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-sm font-black text-cyan-200">
                    {getSeasonBadge(seasonId)}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {categories.map((category) => {
                    const winner = getSheetValue(row, [category.key])

                    if (!winner) return null

                    return (
                      <div key={category.key} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-[0.18em]">
                          {category.label}
                        </p>

                        <div className="mt-3 flex items-center gap-3">
                          {category.type === "team" ? (
                            <TeamLogo teamName={winner} className="h-10 w-10" />
                          ) : (
                            <PlayerAvatar playerName={winner} className="h-10 w-10" />
                          )}

                          <p className={`min-w-0 text-lg font-black ${category.accent}`}>
                            {winner}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm font-bold text-slate-400">
          {selectedSeasonLabel} awards will appear here once the Awards & Accolades sheet has winners.
        </div>
      )}
    </Panel>
  )
}

function RegionsTab({ regionStats, countryStats, selectedSeasonLabel }) {
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
        seasonLabel={selectedSeasonLabel}
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

function PlayersTab({ playerStats = [], dailyData = [], selectedSeasonLabel }) {
  const dailyPlayerStats = useMemo(() => buildDailyPlayerStats(dailyData), [dailyData])
  const playerProfiles = useMemo(() => {
    return playerStats.map((player) => ({
      ...player,
      daily: dailyPlayerStats.find((dailyPlayer) => dailyPlayer.name === player.name),
    }))
  }, [playerStats, dailyPlayerStats])

  const [selectedPlayerName, setSelectedPlayerName] = useState("")
  const [comparePlayerName, setComparePlayerName] = useState("")
  const profileShareRef = useRef(null)
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
        seasonLabel={selectedSeasonLabel}
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
        <div ref={profileShareRef} className="xl:col-span-2">
          <Panel>
            <PanelHeader eyebrow="Profile Focus" title={selectedPlayer?.name || "Choose a Player"} right={selectedPlayer?.team || "Season"} />
            <PlayerProfileDetail player={selectedPlayer} shareTargetRef={profileShareRef} />
          </Panel>
        </div>

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

function buildPlayerProfileBlurb(player, daily, regionRanks) {
  const bestRegion = regionRanks[0]?.name || player.bestRegion || "the safer parts of the map"
  const weakestRegion = regionRanks[regionRanks.length - 1]?.name || player.recentForm?.weakestRegion || "the danger zone"
  const dailyDistance = Number.isFinite(daily?.avgDistance)
    ? formatDistance(daily.avgDistance)
    : "not enough daily data yet"
  const countryHit = Number.isFinite(daily?.countryHitRate) ? formatPercent(daily.countryHitRate) : "0%"
  const regionHit = Number.isFinite(daily?.regionHitRate) ? formatPercent(daily.regionHitRate) : "0%"
  const ctpGap = player.ctps - player.defensivePins

  const statStyle =
    player.defensivePins > player.ctps
      ? `The Defensive Pins are doing a lot of heavy lifting here, which is either discipline or a very stylish refusal to be first.`
      : ctpGap <= 5
      ? `The CTP and Defensive Pins counts are basically side-eyeing each other, so this profile is more balanced than it wants to admit.`
      : player.kos >= 5
      ? `The KO count adds some bite, because apparently quietly being accurate was not dramatic enough.`
      : `The stat line leans more precision than chaos, a respectable choice even if chaos has better marketing.`

  return `${player.name} is strongest in ${bestRegion} and needs to keep an eye on ${weakestRegion}, where the map has been a little less friendly. Daily Challenge form sits at ${dailyDistance} with ${countryHit} country hits and ${regionHit} region hits. ${statStyle}`
}

function PlayerProfileDetail({ player, shareTargetRef }) {
  const [shareState, setShareState] = useState("idle")

  if (!player) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-slate-400">
        Player data will appear here once the sheet loads.
      </div>
    )
  }

  const brand = getTeamBrand(player.team)
  const daily = player.daily
  const profileShareText = `${player.name} GeoCommand Profile: ${player.ctps} CTPs, ${player.defensivePins} Defensive Pins, ${player.kos} KOs, ${formatDistance(player.avgDistance)} season avg.`
  const regionRanks = Object.entries(player.regions || {})
    .map(([name, data]) => ({
      name,
      appearances: data.count,
      avgDistance: data.totalDistance / data.count,
    }))
    .sort((a, b) => a.avgDistance - b.avgDistance)
  const profileBlurb = buildPlayerProfileBlurb(player, daily, regionRanks)

  async function shareProfileImage() {
    try {
      setShareState("rendering")

      const dataUrl = await toPng(shareTargetRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#111827",
        filter: (node) => node.dataset?.shareAction !== "true",
      })
      const imageBlob = await fetch(dataUrl).then((response) => response.blob())
      const fileName = `${player.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-geocommand-card.png`
      const imageFile = new File([imageBlob], fileName, { type: "image/png" })

      if (navigator.canShare?.({ files: [imageFile] })) {
        await navigator.share({
          title: `${player.name} GeoCommand Profile`,
          text: profileShareText,
          files: [imageFile],
        })

        setShareState("shared")
      } else {
        const link = document.createElement("a")
        link.href = dataUrl
        link.download = fileName
        document.body.appendChild(link)
        link.click()
        link.remove()

        setShareState("downloaded")
      }

      window.setTimeout(() => setShareState("idle"), 1800)
    } catch (error) {
      if (error.name === "AbortError") {
        setShareState("idle")
        return
      }

      await navigator.clipboard.writeText(`${profileShareText} ${window.location.href}`)
      setShareState("downloaded")
      window.setTimeout(() => setShareState("idle"), 1800)
    }
  }

  return (
    <div className="space-y-6">
      <div className={`rounded-2xl sm:rounded-[2rem] border ${brand.border} bg-[#1f2430] p-4 sm:p-6`}>
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
              <p className="mt-4 max-w-3xl text-sm sm:text-base leading-7 text-slate-300">
                {profileBlurb}
              </p>

              <button
                type="button"
                onClick={shareProfileImage}
                data-share-action="true"
                disabled={shareState === "rendering"}
                className="mt-5 inline-flex items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm font-black text-cyan-200 transition-all hover:bg-cyan-400/20"
              >
                {shareState === "idle" ? <Share2 className="h-4 w-4" /> : shareState === "shared" ? <Check className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                {shareState === "idle"
                  ? "Share Card"
                  : shareState === "rendering"
                  ? "Creating Image"
                  : shareState === "shared"
                  ? "Shared"
                  : "Downloaded"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full lg:w-auto lg:min-w-[24rem]">
            <MiniStat label="Season Avg" value={formatDistance(player.avgDistance)} accent="text-cyan-400" />
            <MiniStat label="CTPs" value={player.ctps} accent="text-emerald-400" />
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="space-y-2">
            <span className="text-slate-500 text-xs font-bold uppercase tracking-[0.2em]">
              Player A
            </span>
            <select
              value={selectedPlayerName}
              onChange={(event) => setSelectedPlayerName(event.target.value)}
              className="bg-[#0f172a] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white w-full"
            >
              {players.map((player) => (
                <option key={player.name} value={player.name}>
                  {player.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-slate-500 text-xs font-bold uppercase tracking-[0.2em]">
              Player B
            </span>
            <select
              value={comparePlayerName}
              onChange={(event) => setComparePlayerName(event.target.value)}
              className="bg-[#0f172a] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white w-full"
            >
              {players.map((player) => (
                <option key={player.name} value={player.name}>
                  {player.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-[1.15fr_1fr_1fr] gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-slate-500 text-xs font-bold uppercase tracking-[0.18em]">
          Metric
        </p>

        {[selectedPlayer, comparisonPlayer].map((player, index) => (
          <div key={player?.name || index} className="min-w-0">
            <p className="text-slate-500 text-xs font-bold uppercase tracking-[0.18em]">
              Player {index === 0 ? "A" : "B"}
            </p>
            <p className="mt-1 truncate text-sm font-black text-white">
              {player?.name || "Choose"}
            </p>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {metrics.map((metric) => (
          <div key={metric.label} className="bg-white/5 rounded-2xl p-4 border border-white/10">
            <div className="grid grid-cols-[1.15fr_1fr_1fr] gap-3 items-center">
              <p className="text-slate-500 text-sm font-bold">{metric.label}</p>
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

function BottomAnalytics({ liveMatches = [], liveRegions = [], leagueStats, selectedSeasonLabel = "All-Time" }) {
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
        <PanelHeader eyebrow="Activity" title="League Stats" right={selectedSeasonLabel} />

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
  selectedSeason,
  setSelectedSeason,
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
          Filter every tab by season, team, and game mode.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-3 sm:gap-4">
        <div className="flex gap-2 overflow-x-auto md:flex-wrap">
          {SEASON_OPTIONS.map((season) => (
            <button
              key={season.id}
              type="button"
              onClick={() => setSelectedSeason(season.id)}
              className={`shrink-0 px-4 py-3 rounded-xl text-sm font-bold border transition-all ${
                selectedSeason === season.id
                  ? "bg-emerald-400 text-black border-emerald-300"
                  : "bg-white/5 text-slate-400 border-white/10 hover:text-white"
              }`}
            >
              {season.label}
            </button>
          ))}
        </div>

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
              type="button"
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
