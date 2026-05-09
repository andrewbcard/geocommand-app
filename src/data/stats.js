export function isYes(value) {
  return String(value || "").trim().toLowerCase() === "yes"
}

export function parseDistance(value) {
  const distance = Number.parseFloat(value)
  return Number.isFinite(distance) ? distance : 0
}

export function formatPercent(value) {
  if (!Number.isFinite(value)) return "0%"
  return `${Math.round(value)}%`
}

export function formatDistance(value) {
  if (!Number.isFinite(value)) return "0.0 km"
  return `${value.toFixed(1)} km`
}

export function getBestAndWeakestRegion(regions) {
  const rankedRegions = Object.entries(regions)
    .map(([name, data]) => ({
      name,
      guesses: data.guesses,
      avgDistance: data.totalDistance / data.guesses,
    }))
    .filter((region) => region.guesses > 0)

  return {
    strongestRegion:
      [...rankedRegions].sort((a, b) => a.avgDistance - b.avgDistance)[0]?.name || "N/A",
    weakestRegion:
      [...rankedRegions].sort((a, b) => b.avgDistance - a.avgDistance)[0]?.name || "N/A",
  }
}

export function getDistanceTier(avgDistance) {
  if (avgDistance < 50) {
    return {
      label: "Strong",
      fill: "#34d399",
      text: "text-emerald-300",
    }
  }

  if (avgDistance < 150) {
    return {
      label: "Mixed",
      fill: "#fbbf24",
      text: "text-amber-300",
    }
  }

  return {
    label: "Weak",
    fill: "#fb7185",
    text: "text-rose-300",
  }
}

export function buildDailyPlayerStats(dailyRows) {
  const map = {}

  dailyRows.forEach((row) => {
    const player = row.Player
    const region = row.Region
    const distance = parseDistance(row["Distance (km)"])

    if (!player) return

    if (!map[player]) {
      map[player] = {
        name: player,
        guesses: 0,
        countryHits: 0,
        regionHits: 0,
        totalDistance: 0,
        regions: {},
      }
    }

    map[player].guesses += 1
    map[player].totalDistance += distance

    if (isYes(row["Country Hit"])) map[player].countryHits += 1
    if (isYes(row["Region Hit"])) map[player].regionHits += 1

    if (region) {
      if (!map[player].regions[region]) {
        map[player].regions[region] = {
          guesses: 0,
          totalDistance: 0,
        }
      }

      map[player].regions[region].guesses += 1
      map[player].regions[region].totalDistance += distance
    }
  })

  return Object.values(map)
    .map((player) => {
      const regionRanks = getBestAndWeakestRegion(player.regions)

      return {
        ...player,
        avgDistance: player.totalDistance / player.guesses,
        countryHitRate: (player.countryHits / player.guesses) * 100,
        regionHitRate: (player.regionHits / player.guesses) * 100,
        ...regionRanks,
      }
    })
    .sort((a, b) => a.avgDistance - b.avgDistance)
}

export function buildDailyRegionStats(dailyRows) {
  const map = {}

  dailyRows.forEach((row) => {
    const region = row.Region
    const distance = parseDistance(row["Distance (km)"])

    if (!region) return

    if (!map[region]) {
      map[region] = {
        name: region,
        guesses: 0,
        countryHits: 0,
        regionHits: 0,
        totalDistance: 0,
      }
    }

    map[region].guesses += 1
    map[region].totalDistance += distance

    if (isYes(row["Country Hit"])) map[region].countryHits += 1
    if (isYes(row["Region Hit"])) map[region].regionHits += 1
  })

  return Object.values(map)
    .map((region) => ({
      ...region,
      avgDistance: region.totalDistance / region.guesses,
      countryHitRate: (region.countryHits / region.guesses) * 100,
      regionHitRate: (region.regionHits / region.guesses) * 100,
    }))
    .sort((a, b) => a.avgDistance - b.avgDistance)
}
