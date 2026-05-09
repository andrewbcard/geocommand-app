export function PageHeader({ eyebrow, title, description }) {
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

export function StatCard({ label, value, sub, accent = "cyan" }) {
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

export function Panel({ children, className = "" }) {
  return (
    <div className={`bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl sm:rounded-[2rem] p-4 sm:p-6 shadow-2xl min-w-0 ${className}`}>
      {children}
    </div>
  )
}

export function PanelHeader({ eyebrow, title, right }) {
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

export function MiniStat({ label, value, accent = "" }) {
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
