import Papa from "papaparse"

const PLAYER_INFO_URL =
  "https://docs.google.com/spreadsheets/d/1ev1Gw72evcdMUp-M1xSOEuZJiarnOK4NKxscPVQiXeY/gviz/tq?tqx=out:csv&sheet=Player%20Info"

const PLAYER_NAME_COLUMNS = ["Player", "Player Name", "Name"]
const GEOGUESSR_PROFILE_COLUMNS = [
  "GeoGuessr Profile URL",
  "Geoguessr Profile URL",
  "GeoGuessr URL",
  "Geoguessr URL",
  "GeoGuessr",
  "Geoguessr",
  "Profile URL",
  "GeoGuessr ID",
  "Geoguessr ID",
]

const ACTIVE_MINUTES = 30
const LIKELY_ACTIVE_MINUTES = 120
const RECENT_MINUTES = 180
const PLAYER_CACHE_MS = 60 * 1000

let cachedPlayers = []
let cachedPlayersAt = 0

function getSheetValue(row, labels) {
  const normalizedLabels = labels.map((label) => label.toLowerCase())
  const entry = Object.entries(row).find(([key]) =>
    normalizedLabels.includes(String(key || "").trim().toLowerCase())
  )

  return entry?.[1] || ""
}

function extractGeoGuessrId(value) {
  const rawValue = String(value || "").trim()

  if (!rawValue) return ""

  const userPathMatch = rawValue.match(/geoguessr\.com\/user\/([^/?#\s]+)/i)
  if (userPathMatch?.[1]) return userPathMatch[1]

  const bareIdMatch = rawValue.match(/^[a-z0-9]{16,}$/i)
  if (bareIdMatch) return rawValue

  return ""
}

async function fetchPlayersFromSheet() {
  if (Date.now() - cachedPlayersAt < PLAYER_CACHE_MS && cachedPlayers.length > 0) {
    return cachedPlayers
  }

  const response = await fetch(`${PLAYER_INFO_URL}&cacheBust=${Date.now()}`)

  if (!response.ok) {
    throw new Error(`Player Info sheet returned ${response.status}`)
  }

  const csv = await response.text()
  const results = Papa.parse(csv, { header: true, skipEmptyLines: true })

  if (results.errors?.length) {
    throw new Error("Could not read Player Info sheet")
  }

  cachedPlayers = results.data
    .map((row) => {
      const name = getSheetValue(row, PLAYER_NAME_COLUMNS).trim()
      const profileValue = getSheetValue(row, GEOGUESSR_PROFILE_COLUMNS)
      const id = extractGeoGuessrId(profileValue)

      return name && id ? { name, id } : null
    })
    .filter(Boolean)

  cachedPlayersAt = Date.now()

  return cachedPlayers
}

function extractNextData(html) {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/)

  if (!match) return null

  return JSON.parse(match[1])
}

async function fetchPlayerActivity(player) {
  const url = `https://www.geoguessr.com/user/${player.id}`

  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0 GeoCommand activity checker",
      },
    })

    if (!response.ok) {
      throw new Error(`GeoGuessr returned ${response.status}`)
    }

    const html = await response.text()
    const nextData = extractNextData(html)
    const lastVisitAt = nextData?.props?.pageProps?.userProfile?.lastVisitDateTime
    const lastVisitTime = lastVisitAt ? new Date(lastVisitAt).getTime() : 0
    const minutesAgo = lastVisitTime
      ? Math.max(0, Math.round((Date.now() - lastVisitTime) / 60000))
      : null

    return {
      ...player,
      url,
      lastVisitAt,
      minutesAgo,
      status:
        minutesAgo === null
          ? "unknown"
          : minutesAgo <= ACTIVE_MINUTES
          ? "active"
          : minutesAgo <= LIKELY_ACTIVE_MINUTES
          ? "likely-active"
          : minutesAgo <= RECENT_MINUTES
          ? "recent"
          : "away",
    }
  } catch (error) {
    return {
      ...player,
      url,
      lastVisitAt: null,
      minutesAgo: null,
      status: "unknown",
      error: error.message,
    }
  }
}

export default async function handler(request, response) {
  let source = "player-info-sheet"
  let configuredPlayers = []

  try {
    configuredPlayers = await fetchPlayersFromSheet()
  } catch (error) {
    source = `player-info-sheet-error: ${error.message}`
  }

  const players = await Promise.all(configuredPlayers.map(fetchPlayerActivity))

  response.setHeader("Cache-Control", "no-store")
  response.status(200).json({
    checkedAt: new Date().toISOString(),
    source,
    activeWindowMinutes: ACTIVE_MINUTES,
    likelyActiveWindowMinutes: LIKELY_ACTIVE_MINUTES,
    recentWindowMinutes: RECENT_MINUTES,
    players,
  })
}
