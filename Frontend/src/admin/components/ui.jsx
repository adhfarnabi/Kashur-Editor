// src/admin/components/ui.jsx
// Small shared building blocks used across every admin section. Kept
// dependency-free (no chart/icon libraries) — charts are inline SVG,
// consistent with how KashurEditor already renders its own charts.

export function StatCard({ label, value, sub, accent = "indigo", icon, trend }) {
  const accents = {
    indigo: "from-indigo-500 to-indigo-600 shadow-indigo-500/30",
    emerald: "from-emerald-500 to-emerald-600 shadow-emerald-500/30",
    amber: "from-amber-500 to-amber-600 shadow-amber-500/30",
    rose: "from-rose-500 to-rose-600 shadow-rose-500/30",
    sky: "from-sky-500 to-sky-600 shadow-sky-500/30",
  }
  return (
    <div className="group bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1 tabular-nums">{value}</p>
          <div className="flex items-center gap-1.5 mt-1">
            {trend != null && (
              <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${trend >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                {trend >= 0 ? "▲" : "▼"} {Math.abs(trend)}%
              </span>
            )}
            {sub && <p className="text-xs text-slate-400 dark:text-slate-500">{sub}</p>}
          </div>
        </div>
        {icon && (
          <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${accents[accent]} flex items-center justify-center text-white text-lg shrink-0 shadow-lg group-hover:scale-105 transition-transform duration-200`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}

export function Skeleton({ className = "" }) {
  return <div className={`animate-pulse bg-slate-200 dark:bg-slate-700 rounded ${className}`} />
}

export function StatCardSkeleton() {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
      <Skeleton className="h-3 w-20 mb-3" />
      <Skeleton className="h-7 w-16 mb-2" />
      <Skeleton className="h-3 w-24" />
    </div>
  )
}

export function Card({ title, action, children, className = "" }) {
  return (
    <div className={`bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition-shadow duration-200 hover:shadow-md ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          {title && <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{title}</h3>}
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  )
}

export function Badge({ children, tone = "slate" }) {
  const tones = {
    slate:  "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
    green:  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    red:    "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
    amber:  "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    indigo: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  }
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${tones[tone]}`}>{children}</span>
}

export function Button({ children, onClick, variant = "primary", size = "md", disabled, type = "button" }) {
  const base = "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-all duration-150 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
  const sizes = { sm: "text-xs px-2.5 py-1.5", md: "text-sm px-4 py-2" }
  const variants = {
    primary: "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm hover:shadow-md",
    secondary: "bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200",
    danger: "bg-rose-600 hover:bg-rose-700 text-white shadow-sm hover:shadow-md",
    ghost: "hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300",
  }
  return (
    <button type={type} disabled={disabled} onClick={onClick} className={`${base} ${sizes[size]} ${variants[variant]}`}>
      {children}
    </button>
  )
}

export function Input({ label, className = "", ...props }) {
  return (
    <label className="block">
      {label && <span className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{label}</span>}
      <input
        {...props}
        className={`w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${className}`}
      />
    </label>
  )
}

export function Textarea({ label, className = "", ...props }) {
  return (
    <label className="block">
      {label && <span className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{label}</span>}
      <textarea
        {...props}
        className={`w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${className}`}
      />
    </label>
  )
}

export function Select({ label, className = "", children, ...props }) {
  return (
    <label className="block">
      {label && <span className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{label}</span>}
      <select
        {...props}
        className={`w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${className}`}
      >
        {children}
      </select>
    </label>
  )
}

export function Modal({ title, onClose, children, wide }) {
  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4"
    >
      <div className={`bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full ${wide ? "max-w-2xl" : "max-w-md"} max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl leading-none">×</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

export function ConfirmDialog({ title, message, confirmLabel = "Confirm", danger, onConfirm, onCancel }) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="text-sm text-slate-600 dark:text-slate-300 mb-5">{message}</p>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button variant={danger ? "danger" : "primary"} onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </Modal>
  )
}

export function EmptyState({ icon = "📭", title, sub }) {
  return (
    <div className="text-center py-12">
      <div className="text-4xl mb-2">{icon}</div>
      <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{title}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  )
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-8 h-8 border-3 border-slate-200 dark:border-slate-600 border-t-indigo-600 rounded-full animate-spin" />
    </div>
  )
}

export function Pagination({ page, pages, onChange }) {
  if (pages <= 1) return null
  return (
    <div className="flex items-center justify-center gap-1.5 mt-4">
      <button
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className="w-8 h-8 rounded-lg text-sm border border-slate-200 dark:border-slate-600 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
      >‹</button>
      <span className="text-xs text-slate-500 dark:text-slate-400 px-2">Page {page} of {pages}</span>
      <button
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
        className="w-8 h-8 rounded-lg text-sm border border-slate-200 dark:border-slate-600 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
      >›</button>
    </div>
  )
}

// ── Lightweight inline SVG pie/donut chart, no dependency ───────────────────
export function PieChart({ data, size = 160, donut = true }) {
  const safeData = Array.isArray(data) ? data : []
  const total = safeData.reduce((sum, item) => sum + (Number(item.value) || 0), 0)
  if (!total) return <EmptyState icon="🥧" title="No data yet" />

  const r = size / 2
  const inner = donut ? r * 0.55 : 0
  const positiveData = safeData.filter(item => Number(item.value) > 0)
  const slices = positiveData.map((d, index) => {
    const fraction = d.value / total
    const precedingTotal = positiveData
      .slice(0, index)
      .reduce((sum, item) => sum + (Number(item.value) || 0), 0)
    const startAngle = -90 + (precedingTotal / total) * 360
    const endAngle = startAngle + fraction * 360

    const toXY = (deg, radius) => {
      const rad = (deg * Math.PI) / 180
      return [r + radius * Math.cos(rad), r + radius * Math.sin(rad)]
    }
    const [x1, y1] = toXY(startAngle, r)
    const [x2, y2] = toXY(endAngle, r)
    const [ix1, iy1] = toXY(endAngle, inner)
    const [ix2, iy2] = toXY(startAngle, inner)
    const largeArc = fraction > 0.5 ? 1 : 0

    const fullCircle = fraction > 0.999999
    const path = fullCircle
      ? donut
        ? `M ${r} 0 A ${r} ${r} 0 1 1 ${r} ${size} A ${r} ${r} 0 1 1 ${r} 0 L ${r} ${r - inner} A ${inner} ${inner} 0 1 0 ${r} ${r + inner} A ${inner} ${inner} 0 1 0 ${r} ${r - inner} Z`
        : `M ${r} 0 A ${r} ${r} 0 1 1 ${r} ${size} A ${r} ${r} 0 1 1 ${r} 0 Z`
      : donut
        ? `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${inner} ${inner} 0 ${largeArc} 0 ${ix2} ${iy2} Z`
        : `M ${r} ${r} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`

    return { ...d, path, pct: Math.round(fraction * 100) }
  })

  return (
    <div className="flex items-center gap-6 flex-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {slices.map((s, i) => (
          <path key={i} d={s.path} fill={s.color} stroke="white" strokeWidth="1.5" />
        ))}
        {donut && (
          <text x={r} y={r} textAnchor="middle" dominantBaseline="central" className="fill-slate-700 dark:fill-slate-200" fontSize="18" fontWeight="700">
            {total}
          </text>
        )}
      </svg>
      <div className="space-y-1.5">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ background: s.color }} />
            <span className="text-slate-600 dark:text-slate-300">{s.label}</span>
            <span className="text-slate-400">{s.value} ({s.pct}%)</span>
          </div>
        ))}
      </div>
    </div>
  )
}
// ── Lightweight inline SVG grouped bar chart, no dependency ────────────────
// data: [{ label, k1: n, k2: n, ... }]   keys: ["k1","k2"]   colors: ["#..","#.."]
// ── Horizontal bar chart: categories (e.g. days) stacked on the y-axis,
// bars extending rightward by value on the x-axis. Used where days need to
// read top-to-bottom rather than left-to-right.
export function HorizontalBarChart({ data, valueKey = "value", color = "#E8A33D", rowHeight = 22, maxRows = 12, valueFormat }) {
  if (!data || data.length === 0) return <EmptyState icon="📊" title="No data yet" />
  const fmt = valueFormat || (v => v)
  const maxVal = Math.max(1, ...data.map(d => d[valueKey] || 0))
  const visibleHeight = Math.min(data.length, maxRows) * rowHeight
  const labelWidth = 78

  return (
    <div className="overflow-y-auto pr-1" style={{ maxHeight: visibleHeight + 8 }}>
      <div className="space-y-1">
        {data.map((d, i) => {
          const val = d[valueKey] || 0
          const pct = Math.max(val > 0 ? 3 : 0, (val / maxVal) * 100)
          return (
            <div key={i} className="flex items-center gap-2" style={{ height: rowHeight }}>
              <span className="text-[10px] text-slate-400 shrink-0 text-right tabular-nums" style={{ width: labelWidth }}>
                {d.label}
              </span>
              <div className="flex-1 h-3.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${pct}%`, backgroundColor: color, minWidth: val > 0 ? "3px" : 0 }}
                  title={`${d.label}: ${fmt(val)}`}
                />
              </div>
              <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 w-6 text-right tabular-nums shrink-0">
                {val}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Format a size given in MB, switching to KB when it's small enough that
// "0.52 MB" reads as less precise/useful than "532 KB".
export function formatStorage(mb) {
  const safeMb = Number.isFinite(Number(mb)) ? Math.max(0, Number(mb)) : 0
  if (safeMb < 1) return `${Math.round(safeMb * 1024)} KB`
  if (safeMb < 1024) return `${safeMb.toFixed(safeMb < 10 ? 2 : 1)} MB`
  return `${(safeMb / 1024).toFixed(2)} GB`
}

// export function BarChart({ data, keys, colors, height = 180, valueFormat }) {
//   if (!data || data.length === 0) return <EmptyState icon="📊" title="No data yet" />
//   const width = 640
//   const padding = 28
//   const bottomPad = 34
//   const maxVal = Math.max(1, ...data.flatMap(d => keys.map(k => d[k] || 0)))
//   const groupWidth = (width - padding * 2) / data.length
//   const barGap = 3
//   const barWidth = Math.max(2, (groupWidth - barGap * (keys.length + 1)) / keys.length)
//   const chartH = height - padding - bottomPad
//   const fmt = valueFormat || (v => v)

//   // Thin out x-axis labels if there are many bars, to avoid crowding
//   const labelStep = Math.ceil(data.length / 10)

//   return (
//     <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
//       {[0, 0.25, 0.5, 0.75, 1].map(f => (
//         <line key={f} x1={padding} x2={width - padding}
//           y1={padding + f * chartH} y2={padding + f * chartH}
//           stroke="currentColor" strokeOpacity="0.08" />
//       ))}
//       {data.map((d, gi) => {
//         const gx = padding + gi * groupWidth
//         return (
//           <g key={gi}>
//             {keys.map((k, ki) => {
//               const val = d[k] || 0
//               const barH = (val / maxVal) * chartH
//               const x = gx + barGap + ki * (barWidth + barGap)
//               const y = padding + chartH - barH
//               return (
//                 <rect key={k} x={x} y={y} width={barWidth} height={Math.max(0, barH)}
//                   fill={colors[ki]} rx="1.5">
//                   <title>{`${d.label}: ${fmt(val)}`}</title>
//                 </rect>
//               )
//             })}
//             {gi % labelStep === 0 && (
//               <text x={gx + groupWidth / 2} y={height - bottomPad + 14} textAnchor="middle"
//                 fontSize="14" className="fill-slate-400 dark:fill-slate-500">
//                 {d.label}
//               </text>
//             )}
//           </g>
//         )
//       })}
//     </svg>
//   )
// }
export function BarChart({ data, keys, colors, height = 180, valueFormat }) {
  if (!data || data.length === 0) return <EmptyState icon="📊" title="No data yet" />
  const width = 640
  const leftPad = 40
  const rightPad = 16
  const bottomPad = 34
  const topPad = 20
  const rawMax = Math.max(1, ...data.flatMap(d => keys.map(k => d[k] || 0)))
  const fmt = valueFormat || (v => v)

  // Pick a clean step (1, 2, 5, 10, 20, 50...) so axis labels never repeat
  const targetTicks = 4
  const rawStep = rawMax / targetTicks
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep || 1)))
  const norm = rawStep / mag
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag
  const niceMax = Math.max(step, Math.ceil(rawMax / step) * step)
  const ticks = []
  for (let v = 0; v <= niceMax + 1e-9; v += step) ticks.push(Math.round(v))

  const groupWidth = (width - leftPad - rightPad) / data.length
  const barGap = 3
  const barWidth = Math.max(2, (groupWidth - barGap * (keys.length + 1)) / keys.length)
  const chartH = height - topPad - bottomPad
  const labelStep = Math.ceil(data.length / 10)

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      {ticks.map(v => {
        const y = topPad + chartH - (v / niceMax) * chartH
        return (
          <g key={v}>
            <line x1={leftPad} x2={width - rightPad} y1={y} y2={y}
              stroke="currentColor" strokeOpacity="0.08" />
            <text x={leftPad - 8} y={y + 4} textAnchor="end"
              fontSize="11" className="fill-slate-400 dark:fill-slate-500">
              {fmt(v)}
            </text>
          </g>
        )
      })}
      {data.map((d, gi) => {
        const gx = leftPad + gi * groupWidth
        const isLast = gi === data.length - 1
        return (
          <g key={gi}>
            {keys.map((k, ki) => {
              const val = d[k] || 0
              const barH = (val / niceMax) * chartH
              const x = gx + barGap + ki * (barWidth + barGap)
              const y = topPad + chartH - barH
              return (
                <rect key={k} x={x} y={y} width={barWidth} height={Math.max(0, barH)}
                  fill={colors[ki]} rx="1.5">
                  <title>{`${d.label}: ${fmt(val)}`}</title>
                </rect>
              )
            })}
            {(gi % labelStep === 0 || isLast) && (
              <text x={gx + groupWidth / 2} y={height - bottomPad + 14} textAnchor="middle"
                fontSize="14" className="fill-slate-400 dark:fill-slate-500">
                {d.label}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

// ── Small pill toggle, e.g. Day / Week grouping switches ───────────────────
export function ToggleGroup({ options, value, onChange }) {
  return (
    <div className="inline-flex items-center rounded-lg bg-slate-100 dark:bg-slate-700 p-0.5 text-xs">
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`px-2.5 py-1 rounded-md font-medium transition-colors duration-150 ${
            value === opt.value
              ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// ── Group an array of {date, ...numericKeys} daily rows into ISO-week buckets
export function groupByWeek(dailyData, keys) {
  const weeks = new Map()
  for (const row of dailyData) {
    const d = new Date(row.date)
    const jan1 = new Date(d.getFullYear(), 0, 1)
    const dayOfYear = Math.floor((d - jan1) / 86400000)
    const weekNum = Math.ceil((dayOfYear + jan1.getDay() + 1) / 7)
    const key = `${d.getFullYear()}-W${weekNum}`
    if (!weeks.has(key)) {
      const entry = { label: key }
      keys.forEach(k => { entry[k] = 0 })
      weeks.set(key, entry)
    }
    const entry = weeks.get(key)
    keys.forEach(k => { entry[k] += row[k] || 0 })
  }
  return Array.from(weeks.values())
}

export function LineBarChart({ data, keys, colors, height = 180 }) {
  if (!data || data.length === 0) return <EmptyState icon="📈" title="No data yet" />
  const width = 640
  const padding = 24
  const maxVal = Math.max(1, ...data.flatMap(d => keys.map(k => d[k] || 0)))
  const stepX = (width - padding * 2) / Math.max(1, data.length - 1)

  const points = (key) => data.map((d, i) => {
    const x = padding + i * stepX
    const y = height - padding - ((d[key] || 0) / maxVal) * (height - padding * 2)
    return `${x},${y}`
  }).join(" ")

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      {/* gridlines */}
      {[0, 0.25, 0.5, 0.75, 1].map(f => (
        <line key={f} x1={padding} x2={width - padding}
          y1={padding + f * (height - padding * 2)} y2={padding + f * (height - padding * 2)}
          stroke="currentColor" strokeOpacity="0.08" />
      ))}
      {keys.map((k, i) => (
        <polyline key={k} points={points(k)} fill="none" stroke={colors[i]} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      ))}
      {keys.map((k, i) => data.map((d, di) => {
        const x = padding + di * stepX
        const y = height - padding - ((d[k] || 0) / maxVal) * (height - padding * 2)
        return <circle key={`${k}-${di}`} cx={x} cy={y} r="2.5" fill={colors[i]} />
      }))}
    </svg>
  )
}

// ── Conversion funnel for registered → verified → active → creator ─────────
export function FunnelChart({ data }) {
  if (!data || data.length === 0) return <EmptyState icon="🔻" title="No funnel data yet" />
  const maximum = Math.max(1, ...data.map(item => item.value || 0))
  const palette = ["#4f46e5", "#0ea5e9", "#10b981", "#f59e0b", "#f43f5e"]
  return (
    <div className="space-y-3">
      {data.map((item, index) => {
        const width = Math.max(18, ((item.value || 0) / maximum) * 100)
        const conversion = index === 0
          ? 100
          : data[index - 1].value
            ? Math.round(((item.value || 0) / data[index - 1].value) * 100)
            : 0
        return (
          <div key={item.label}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-medium text-slate-600 dark:text-slate-300">{item.label}</span>
              <span className="text-slate-400 tabular-nums">{item.value} · {conversion}% step conversion</span>
            </div>
            <div className="h-8 rounded-lg bg-slate-100 dark:bg-slate-700 overflow-hidden">
              <div
                className="h-full rounded-lg flex items-center justify-end pr-3 text-white text-xs font-semibold transition-all duration-500"
                style={{ width: `${width}%`, backgroundColor: palette[index % palette.length] }}
              >
                {Math.round(((item.value || 0) / maximum) * 100)}%
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Compact ranked distribution; useful for bands/categories, not timelines ─
export function DistributionBars({ data, color = "#6366f1", valueLabel = value => value }) {
  if (!data || data.length === 0) return <EmptyState icon="📊" title="No distribution data yet" />
  const maximum = Math.max(1, ...data.map(item => item.value || 0))
  return (
    <div className="space-y-3">
      {data.map(item => {
        const percentage = ((item.value || 0) / maximum) * 100
        return (
          <div key={item.label} className="grid grid-cols-[90px_1fr_48px] items-center gap-3">
            <span className="text-xs text-slate-500 dark:text-slate-400 truncate" title={item.label}>{item.label}</span>
            <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.max(item.value ? 3 : 0, percentage)}%`, backgroundColor: item.color || color }}
              />
            </div>
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 text-right tabular-nums">
              {valueLabel(item.value || 0)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── A set of progress gauges for operational health percentages ─────────────
export function HealthGauges({ items }) {
  return (
    <div className="grid sm:grid-cols-3 gap-4">
      {items.map(item => {
        const value = Math.max(0, Math.min(100, Number(item.value) || 0))
        const tone = value >= 75 ? "#10b981" : value >= 45 ? "#f59e0b" : "#f43f5e"
        return (
          <div key={item.label} className="rounded-xl border border-slate-100 dark:border-slate-700 p-4">
            <div className="flex justify-between items-end mb-2">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{item.label}</span>
              <span className="text-lg font-bold text-slate-800 dark:text-slate-100 tabular-nums">{value}%</span>
            </div>
            <div className="h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${value}%`, backgroundColor: tone }} />
            </div>
            {item.sub && <p className="text-[11px] text-slate-400 mt-2">{item.sub}</p>}
          </div>
        )
      })}
    </div>
  )
}

// ── Icon-based workload view for small status/category counts ───────────────
export function Pictograph({ data, icon = "●", maxIcons = 12 }) {
  if (!data || data.every(item => !item.value)) {
    return <EmptyState icon="💬" title="No feedback in the last 30 days" />
  }
  const maximum = Math.max(1, ...data.map(item => item.value || 0))
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {data.map(item => {
        const visible = item.value
          ? Math.max(1, Math.round(((item.value || 0) / maximum) * maxIcons))
          : 0
        return (
          <div key={item.label} className="rounded-xl border border-slate-100 dark:border-slate-700 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{item.label}</span>
              <span className="text-lg font-bold text-slate-800 dark:text-slate-100 tabular-nums">{item.value || 0}</span>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-3 min-h-7" title={`${item.label}: ${item.value || 0}`}>
              {Array.from({ length: visible }, (_, index) => (
                <span key={index} className="text-lg leading-none" style={{ color: item.color || "#6366f1" }}>{icon}</span>
              ))}
              {!visible && <span className="text-xs text-slate-300 dark:text-slate-600">No items</span>}
            </div>
            <p className="text-[10px] text-slate-400 mt-2">Icons are scaled to the largest status; the number is exact.</p>
          </div>
        )
      })}
    </div>
  )
}
