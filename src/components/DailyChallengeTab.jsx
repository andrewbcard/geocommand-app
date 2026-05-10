import { useMemo, useState } from "react"
import GeoHeatMap from "./GeoHeatMap.jsx"
import { MiniStat, PageHeader, Panel, PanelHeader, StatCard } from "./dashboardPrimitives.jsx"
import { PlayerAvatar } from "./LeagueIdentity.jsx"
import {
  buildDailyPlayerStats,
  buildDailyRegionStats,
  formatDistance,
  formatPercent,
  isYes,
} from "../data/stats.js"

export default function DailyChallengeTab({ dailyData = [] }) {
  const playerStats = useMemo(() => buildDailyPlayerStats(dailyData), [dailyData])
  const regionStats = useMemo(() => buildDailyRegionStats(dailyData), [dailyData])
  const [compareA, setCompareA] = useState("")
  const [compareB, setCompareB] = useState("")
  const [mapMetric, setMapMetric] = useState("distance")

  const countryHits = dailyData.filter((row) => isYes(row["Country Hit"])).length
  const regionHits = dailyData.filter((row) => isYes(row["Region Hit"])).length
  const bestDistancePlayer = playerStats[0]
  const topCountryPlayer =
    [...playerStats].sort((a, b) => b.countryHitRate - a.countryHitRate || a.avgDistance - b.avgDistance)[0]
  const topRegionPlayer =
    [...playerStats].sort((a, b) => b.regionHitRate - a.regionHitRate || a.avgDistance - b.avgDistance)[0]
  const firstComparePlayer = compareA || playerStats[0]?.name || ""
  const secondComparePlayer =
    compareB || playerStats.find((player) => player.name !== firstComparePlayer)?.name || ""
  const comparePlayerA = playerStats.find((player) => player.name === firstComparePlayer)
  const comparePlayerB = playerStats.find((player) => player.name === secondComparePlayer)

  return (
    <>
      <PageHeader
        eyebrow="Daily Challenge"
        title="Daily Challenge"
        description="Live stats from the Daily Challenges sheet: country hits, region hits, distance, timing, date, and mode."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <StatCard label="Total Guesses" value={dailyData.length} sub="All daily entries" accent="cyan" />
        <StatCard
          label="Best Avg Distance"
          value={formatDistance(bestDistancePlayer?.avgDistance)}
          sub={bestDistancePlayer?.name || "Waiting for data"}
          accent="purple"
        />
        <StatCard
          label="Top Country Hit %"
          value={formatPercent(topCountryPlayer?.countryHitRate)}
          sub={topCountryPlayer?.name || `${countryHits} country hits`}
          accent="pink"
        />
        <StatCard
          label="Top Region Hit %"
          value={formatPercent(topRegionPlayer?.regionHitRate)}
          sub={topRegionPlayer?.name || `${regionHits} region hits`}
          accent="emerald"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <Panel className="xl:col-span-2">
          <PanelHeader eyebrow="Daily Rankings" title="Player Leaderboard" right="Lower Distance Wins" />
          <DailyPlayerTable playerStats={playerStats} />
        </Panel>

        <Panel>
          <PanelHeader eyebrow="Daily Meta" title="Region Difficulty" right="Avg Distance" />
          <DailyRegionList regionStats={regionStats} />
        </Panel>
      </div>

      <Panel className="mb-6 sm:mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-5 sm:mb-6">
          <PanelHeader
            eyebrow="Daily Map"
            title="Daily Challenge Heat Map"
            right={mapMetric === "distance" ? "Avg Distance" : "Region Volume"}
          />

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

        <GeoHeatMap regionStats={regionStats} metric={mapMetric} />
      </Panel>

      <Panel className="mb-6 sm:mb-8">
        <PanelHeader eyebrow="Head-to-Head" title="Player Comparison" right="Daily Challenge" />
        <DailyComparison
          playerStats={playerStats}
          compareA={firstComparePlayer}
          compareB={secondComparePlayer}
          setCompareA={setCompareA}
          setCompareB={setCompareB}
          playerA={comparePlayerA}
          playerB={comparePlayerB}
        />
      </Panel>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
        {playerStats.map((player) => (
          <DailyPlayerCard key={player.name} player={player} />
        ))}
      </div>

      <Panel>
        <PanelHeader eyebrow="Daily Feed" title="Recent Daily Results" right="Live" />

        <div className="space-y-3">
          {dailyData.slice(0, 12).map((row, index) => (
            <div
              key={index}
              className="grid grid-cols-2 md:grid-cols-6 gap-3 md:gap-4 items-center bg-white/5 rounded-2xl p-4 border border-white/10"
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

function DailyComparison({
  playerStats = [],
  compareA,
  compareB,
  setCompareA,
  setCompareB,
  playerA,
  playerB,
}) {
  const metrics = [
    { label: "Avg Distance", a: playerA?.avgDistance, b: playerB?.avgDistance, format: formatDistance, lowerWins: true },
    { label: "Country Hit", a: playerA?.countryHitRate, b: playerB?.countryHitRate, format: formatPercent },
    { label: "Region Hit", a: playerA?.regionHitRate, b: playerB?.regionHitRate, format: formatPercent },
    { label: "Total Guesses", a: playerA?.guesses, b: playerB?.guesses, format: (value) => value || 0 },
  ]

  function metricWinner(metric, side) {
    if (!Number.isFinite(metric.a) || !Number.isFinite(metric.b) || metric.a === metric.b) {
      return "text-slate-300"
    }

    const aWins = metric.lowerWins ? metric.a < metric.b : metric.a > metric.b
    return (side === "a" && aWins) || (side === "b" && !aWins)
      ? "text-emerald-300"
      : "text-slate-300"
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        <select value={compareA} onChange={(event) => setCompareA(event.target.value)} className="bg-[#0f172a] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white w-full">
          {playerStats.map((player) => (
            <option key={player.name} value={player.name}>{player.name}</option>
          ))}
        </select>

        <select value={compareB} onChange={(event) => setCompareB(event.target.value)} className="bg-[#0f172a] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white w-full">
          {playerStats.map((player) => (
            <option key={player.name} value={player.name}>{player.name}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[playerA, playerB].map((player) => (
          <div key={player?.name || "empty"} className="bg-white/5 rounded-2xl p-4 sm:p-5 border border-white/10">
            <div className="flex items-center gap-4 mb-4">
              <PlayerAvatar playerName={player?.name} className="h-14 w-14 sm:h-16 sm:w-16" />

              <div>
                <p className="text-cyan-400 uppercase tracking-[0.2em] text-xs font-bold mb-2">
                  Profile Snapshot
                </p>
                <h4 className="text-xl sm:text-2xl font-black break-words">{player?.name || "Choose a player"}</h4>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <MiniStat label="Strongest" value={player?.strongestRegion || "N/A"} accent="text-emerald-400" />
              <MiniStat label="Weakest" value={player?.weakestRegion || "N/A"} accent="text-amber-400" />
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {metrics.map((metric) => (
          <div key={metric.label} className="grid grid-cols-2 md:grid-cols-3 gap-3 items-center bg-white/5 rounded-2xl p-4 border border-white/10">
            <p className="text-slate-400 font-bold">{metric.label}</p>
            <p className={`text-xl sm:text-2xl font-black ${metricWinner(metric, "a")}`}>{metric.format(metric.a)}</p>
            <p className={`text-xl sm:text-2xl font-black ${metricWinner(metric, "b")}`}>{metric.format(metric.b)}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function DailyPlayerTable({ playerStats = [] }) {
  return (
    <>
      <div className="hidden md:grid grid-cols-5 text-slate-500 text-sm border-b border-white/10 pb-3 px-4">
        <div>Player</div>
        <div>Guesses</div>
        <div>Country Hit</div>
        <div>Region Hit</div>
        <div>Avg Distance</div>
      </div>

      <div className="space-y-3 mt-4">
        {playerStats.map((player, index) => (
          <div key={player.name} className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4 items-center bg-white/5 hover:bg-white/10 transition-all rounded-2xl p-4 border border-white/10">
            <div className="flex items-center gap-3">
              <PlayerAvatar playerName={player.name} className="h-12 w-12" />

              <div className="min-w-0">
                <p className="font-black truncate">#{index + 1} {player.name}</p>
                <p className="text-slate-500 text-xs md:hidden">{player.guesses} guesses</p>
              </div>
            </div>
            <div className="font-semibold">
              <span className="md:hidden block text-slate-500 text-xs">Guesses</span>
              {player.guesses}
            </div>
            <div className="text-purple-300 font-bold">
              <span className="md:hidden block text-slate-500 text-xs">Country Hit</span>
              {formatPercent(player.countryHitRate)}
            </div>
            <div className="text-pink-300 font-bold">
              <span className="md:hidden block text-slate-500 text-xs">Region Hit</span>
              {formatPercent(player.regionHitRate)}
            </div>
            <div className="text-cyan-300 font-black">
              <span className="md:hidden block text-slate-500 text-xs">Avg Distance</span>
              {formatDistance(player.avgDistance)}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

function DailyPlayerCard({ player }) {
  return (
    <details className="group bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl sm:rounded-[2rem] p-4 sm:p-6 shadow-2xl hover:bg-white/10 transition-all">
      <summary className="list-none cursor-pointer">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <PlayerAvatar playerName={player.name} className="h-16 w-16 sm:h-20 sm:w-20" />

            <div className="min-w-0">
              <p className="text-cyan-400 uppercase tracking-[0.2em] text-xs font-bold mb-2">
                Daily Profile
              </p>
              <h3 className="text-xl sm:text-2xl font-black truncate">{player.name}</h3>
              <p className="text-slate-400 text-sm">
                {formatDistance(player.avgDistance)} avg • {formatPercent(player.countryHitRate)} country
              </p>
            </div>
          </div>

          <span className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-300 group-open:hidden">
            Open
          </span>
          <span className="hidden shrink-0 rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs font-bold text-cyan-300 group-open:inline">
            Close
          </span>
        </div>
      </summary>

      <div className="mt-5 sm:mt-6">
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <MiniStat label="Guesses" value={player.guesses} />
          <MiniStat label="Avg Distance" value={formatDistance(player.avgDistance)} accent="text-cyan-400" />
          <MiniStat label="Country Hit" value={formatPercent(player.countryHitRate)} accent="text-purple-400" />
          <MiniStat label="Region Hit" value={formatPercent(player.regionHitRate)} accent="text-pink-400" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-3 sm:mt-4">
          <MiniStat label="Strongest Region" value={player.strongestRegion} accent="text-emerald-400" />
          <MiniStat label="Weakest Region" value={player.weakestRegion} accent="text-amber-400" />
        </div>
      </div>
    </details>
  )
}

function DailyRegionList({ regionStats = [] }) {
  return (
    <div className="space-y-4">
      {regionStats.slice(0, 8).map((region) => (
        <div key={region.name} className="bg-white/5 rounded-2xl p-4 border border-white/10">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div>
              <p className="font-black">{region.name}</p>
              <p className="text-slate-500 text-xs">{region.guesses} guesses</p>
            </div>
            <p className="text-cyan-300 font-black">{formatDistance(region.avgDistance)}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-slate-500">Country Hit</p>
              <p className="font-bold text-purple-300">{formatPercent(region.countryHitRate)}</p>
            </div>
            <div>
              <p className="text-slate-500">Region Hit</p>
              <p className="font-bold text-pink-300">{formatPercent(region.regionHitRate)}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
