const PLAYER_AVATARS = {
  "Al Harris": "/league/players/al-harris.png",
  "Andrew Card": "/league/players/andrew-card.png",
  "Buddy Hammon": "/league/players/buddy-hammon.png",
  "Caleb Heck": "/league/players/caleb-heck.png",
  "Chris Rossi": "/league/players/chris-rossi.png",
  "Clark Marshall": "/league/players/clark-marshall.png",
  "Jarratt Rouse": "/league/players/jarratt-rouse.png",
  "Luke Gasque": "/league/players/luke-gasque.png",
  "Nick Sant": "/league/players/nick-sant.png",
}

const TEAM_LOGOS = {
  lats: "/league/teams/lats.png",
  bontswana: "/league/teams/bontswana.png",
}

function normalize(value) {
  return String(value || "").trim().toLowerCase()
}

function getInitials(name) {
  return String(name || "?")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

function getPlayerAvatar(playerName) {
  return PLAYER_AVATARS[playerName] || null
}

function getTeamLogo(teamName) {
  const normalized = normalize(teamName)

  if (normalized.includes("bontswana")) return TEAM_LOGOS.bontswana
  if (normalized.includes("lats")) return TEAM_LOGOS.lats

  return null
}

export function PlayerAvatar({ playerName, className = "h-16 w-16" }) {
  const avatar = getPlayerAvatar(playerName)

  if (!avatar) {
    return (
      <div className={`${className} shrink-0 rounded-2xl bg-cyan-500/10 border border-cyan-400/20 flex items-center justify-center text-cyan-300 font-black`}>
        {getInitials(playerName)}
      </div>
    )
  }

  return (
    <div className={`${className} shrink-0 rounded-2xl bg-slate-950/80 border border-white/10 overflow-hidden`}>
      <img
        src={avatar}
        alt={`${playerName} avatar`}
        className="h-full w-full object-contain"
        loading="lazy"
      />
    </div>
  )
}

export function TeamLogo({ teamName, className = "h-8 w-8" }) {
  const logo = getTeamLogo(teamName)

  if (!logo) {
    return null
  }

  return (
    <img
      src={logo}
      alt={`${teamName} logo`}
      className={`${className} shrink-0 rounded-lg object-contain`}
      loading="lazy"
    />
  )
}
