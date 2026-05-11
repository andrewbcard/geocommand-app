const PLAYERS = [
  { name: "Andrew Card", id: "600b1c069801910001451ac7" },
  { name: "Caleb Heck", id: "69921ee53a246a7e905719fc" },
  { name: "Clark Marshall", id: "58ebdeb627c28b2f783c0e8c" },
  { name: "Chris Rossi", id: "5fdba10cb8fe34000115bddc" },
  { name: "Nick Sant", id: "63a4bd8acc4be6d2ce9a5e53" },
  { name: "Al Harris", id: "63a4c9c1a653001f41a5c6df" },
  { name: "Buddy Hammon", id: "63a605465a33dc52d74c4749" },
  { name: "Luke Gasque", id: "66ce1fca273658ad53bdaad7" },
  { name: "Jarratt Rouse", id: "69a5e0ea9f4b9e73e77dbcc7" },
]

const ACTIVE_MINUTES = 10
const RECENT_MINUTES = 60

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
  const players = await Promise.all(PLAYERS.map(fetchPlayerActivity))

  response.setHeader("Cache-Control", "no-store")
  response.status(200).json({
    checkedAt: new Date().toISOString(),
    activeWindowMinutes: ACTIVE_MINUTES,
    recentWindowMinutes: RECENT_MINUTES,
    players,
  })
}
