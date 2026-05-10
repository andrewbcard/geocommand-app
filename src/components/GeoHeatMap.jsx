import { useEffect, useState } from "react"
import * as d3 from "d3"
import { feature } from "topojson-client"
import { formatDistance, getDistanceTier } from "../data/stats.js"

const WORLD_TOPO_JSON =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"

const GEO_COORDS = {
  "North America": [-100, 45],
  "Central America": [-84, 12],
  "South America": [-60, -20],
  Scandinavia: [15, 62],
  "Western Europe": [2, 48],
  "Eastern Europe": [25, 49],
  "North Africa": [15, 25],
  Asia: [95, 45],
  "Southeast Asia": [105, 12],
  Oceania: [140, -25],
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

export default function GeoHeatMap({ regionStats = [], metric = "distance" }) {
  const [worldData, setWorldData] = useState(null)
  const [hoveredRegion, setHoveredRegion] = useState(null)
  const [selectedRegion, setSelectedRegion] = useState(null)

  useEffect(() => {
    fetch(WORLD_TOPO_JSON)
      .then((res) => res.json())
      .then((topology) => {
        setWorldData(feature(topology, topology.objects.countries))
      })
  }, [])

  const projection = d3.geoMercator().scale(150).translate([500, 300])
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

        {mappedRegions.map((item) => (
          <g
            key={item.name}
            transform={`translate(${item.x}, ${item.y})`}
            onMouseEnter={() => setHoveredRegion(item)}
            onMouseLeave={() => setHoveredRegion(null)}
            onClick={() => setSelectedRegion(item)}
            className="cursor-pointer"
          >
            <circle r={item.size + 5} fill={item.tier.fill} opacity="0.14" />
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
        ))}
      </svg>
    </div>
  )
}
