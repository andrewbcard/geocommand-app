import React, { useEffect, useState } from "react";
import Papa from "papaparse";

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

const matches = [
  { winner: "Atlas", loser: "Vanguard", score: "22,430 — 21,980", status: "WIN" },
  { winner: "Vanguard", loser: "Atlas", score: "21,120 — 20,410", status: "WIN" },
  { winner: "Atlas", loser: "Vanguard", score: "23,004 — 20,992", status: "WIN" },
]

const regions = [
  { name: "Western Europe", rate: 92, color: "bg-cyan-400" },
  { name: "Japan", rate: 84, color: "bg-purple-400" },
  { name: "Brazil", rate: 79, color: "bg-pink-400" },
  { name: "North America", rate: 76, color: "bg-emerald-400" },
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

  return (
    <div className="min-h-screen bg-[#070b14] text-white overflow-hidden">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top_right,#1d4ed830,transparent_35%),radial-gradient(circle_at_bottom_left,#06b6d430,transparent_35%)] pointer-events-none" />

      <div className="relative z-10 p-6 md:p-10">
        <TopNav activeTab={activeTab} setActiveTab={setActiveTab} />
<div className="mb-6 text-sm font-bold">
  <p className="text-green-400">
    Raw Entries: {rawData.length}
  </p>

  <p className="text-cyan-400">
    Daily Entries: {dailyData.length}
  </p>
</div>
        {activeTab === "feed" && <FeedTab />}
        {activeTab === "leaders" && <LeadersTab />}
        {activeTab === "regions" && <RegionsTab />}
        {activeTab === "players" && <PlayersTab />}
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

function LeadersTab() {
  return (
    <>
      <PageHeader
        eyebrow="Competitive Analytics"
        title="League Leaders"
        description="Season-long standings, team metrics, MVP race, match feed, and performance trends."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard label="League Leader" value="Atlas" sub="12 Wins • +4,122 diff" accent="cyan" />
        <StatCard label="Highest Avg Score" value="24,320" sub="Season Average" accent="purple" />
        <StatCard label="Current MVP" value="Andrew" sub="+18% This Week" accent="pink" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Panel className="xl:col-span-2">
          <PanelHeader eyebrow="Rankings" title="League Standings" right="Updated Live" />
          <StandingsTable />
        </Panel>

        <Panel>
          <PanelHeader eyebrow="MVP Race" title="Top Players" right="Season" />
          <PlayerList />
        </Panel>
      </div>

      <BottomAnalytics />
    </>
  )
}

function FeedTab() {
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
            {matches.map((match, index) => (
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

function RegionsTab() {
  return (
    <>
      <PageHeader
        eyebrow="Geo Analytics"
        title="Regions & Countries"
        description="Regional performance, strongest territories, map-read consistency, and location-specific dominance."
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Panel className="xl:col-span-2">
          <PanelHeader eyebrow="Regional Meta" title="Strongest Regions" right="Accuracy Index" />

          <div className="space-y-6">
            {regions.map((region) => (
              <div key={region.name}>
                <div className="flex justify-between mb-2">
                  <span className="font-bold">{region.name}</span>
                  <span className="text-cyan-400 font-black">{region.rate}%</span>
                </div>

                <div className="h-3 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={`h-full ${region.color} rounded-full`}
                    style={{ width: `${region.rate}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <PanelHeader eyebrow="Map Pool" title="Territory Notes" right="Scout" />

          <div className="space-y-4">
            <MiniStat label="Best Region" value="Western Europe" accent="text-cyan-400" />
            <MiniStat label="Risk Zone" value="South America" accent="text-pink-400" />
            <MiniStat label="Most Played" value="Japan" accent="text-purple-400" />
          </div>
        </Panel>
      </div>
    </>
  )
}

function PlayersTab() {
  return (
    <>
      <PageHeader
        eyebrow="Player Database"
        title="Player Cards"
        description="Individual dossiers for each league player, including team, accuracy, placement, and best region."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {players.map((player) => (
          <div key={player.name} className="relative overflow-hidden bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-6 shadow-2xl hover:bg-white/10 transition-all">
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 blur-3xl" />

            <p className="text-cyan-400 uppercase tracking-[0.2em] text-xs font-bold mb-2">
              {player.team}
            </p>

            <h3 className="text-3xl font-black mb-6">
              {player.name}
            </h3>

            <div className="space-y-4">
              <MiniStat label="Accuracy" value={player.accuracy} accent="text-cyan-400" />
              <MiniStat label="Avg Placement" value={player.avgPlacement} />
              <MiniStat label="Best Region" value={player.region} accent="text-purple-400" />
            </div>
          </div>
        ))}
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

function StandingsTable() {
  return (
    <>
      <div className="grid grid-cols-4 text-slate-500 text-sm border-b border-white/10 pb-3 px-4">
        <div>Team</div>
        <div>Wins</div>
        <div>Avg Score</div>
        <div>Diff</div>
      </div>

      <div className="space-y-3 mt-4">
        {teams.map((team) => (
          <div key={team.name} className="grid grid-cols-4 items-center bg-white/5 hover:bg-white/10 transition-all rounded-2xl p-4 border border-cyan-500/10">
            <div className="font-bold text-lg">{team.name}</div>
            <div className="font-semibold">{team.wins}</div>
            <div>{team.avgScore}</div>
            <div className="text-emerald-400 font-semibold">{team.diff}</div>
          </div>
        ))}
      </div>
    </>
  )
}

function PlayerList() {
  return (
    <div className="space-y-3">
      {players.slice(0, 3).map((player) => (
        <div key={player.name} className="flex items-center justify-between bg-white/5 rounded-2xl p-4 border border-white/10">
          <div>
            <p className="font-bold">{player.name}</p>
            <p className="text-slate-500 text-sm">{player.team}</p>
          </div>

          <div className="text-right">
            <p className="text-cyan-400 font-bold">{player.accuracy}</p>
            <p className="text-slate-500 text-xs">Accuracy</p>
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

function BottomAnalytics() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
      <Panel>
        <PanelHeader eyebrow="Match Feed" title="Recent Results" right="Live" />

        <div className="space-y-4">
          {matches.slice(0, 2).map((match, index) => (
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
          {regions.slice(0, 3).map((region) => (
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