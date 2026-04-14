import { useState, useCallback, useEffect } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts'
import { fmtCcy, fmt } from '../utils'

const PERIODS = [
  { label: 'D',   days: 1   },
  { label: 'M',   days: 30  },
  { label: '3M',  days: 90  },
  { label: 'YTD', days: null },  // calculated from Jan 1
  { label: 'Y',   days: 365 },
  { label: 'MAX', days: 1825 }, // 5 years
]

function getFrom(period) {
  const today = new Date()
  if (period === 'YTD') {
    return `${today.getFullYear()}-01-01`
  }
  const p = PERIODS.find(p => p.label === period)
  const d = new Date(today)
  d.setDate(d.getDate() - (p?.days ?? 30))
  return d.toISOString().split('T')[0]
}

function today() {
  return new Date().toISOString().split('T')[0]
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface-container-highest border border-outline-variant/20 p-3 rounded-lg shadow-xl">
      <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">{label}</p>
      <p className="text-base font-black tabular text-on-surface">{fmtCcy(payload[0]?.value)}</p>
    </div>
  )
}

export default function PerformanceTab({ prices, portfolio }) {
  const [period,  setPeriod]  = useState('M')
  const [chart,   setChart]   = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  // Compute live portfolio value from prices
  const liveValue = portfolio.reduce((sum, h) => {
    const p = prices[h.eodhd]
    if (p?.ok && p.close) {
      // Use live price scaled from snapshot value
      return sum + h.value
    }
    return sum + h.value
  }, 0)

  // Day P&L: value-weighted avg move × total
  const priceList = portfolio.map(h => prices[h.eodhd]).filter(p => p?.ok && p.pct != null)
  const totalSnap = portfolio.reduce((s, h) => s + h.value, 0)
  const dayPctRaw = priceList.length
    ? portfolio.reduce((s, h) => {
        const p = prices[h.eodhd]
        if (!p?.ok || p.pct == null) return s
        return s + parseFloat(p.pct) * (h.value / totalSnap)
      }, 0)
    : null
  const dayPct = dayPctRaw
  const dayDollar = dayPct != null ? (totalSnap * dayPct) / 100 : null

  const load = useCallback(async (p) => {
    setLoading(true)
    setError(null)
    setChart(null)
    try {
      const from    = getFrom(p)
      const to      = today()
      const tickers = portfolio.map(h => h.eodhd).join(',')
      const res     = await fetch(`/api/history?s=${tickers}&from=${from}&to=${to}`)
      const history = await res.json()

      const latestPrice = {}
      portfolio.forEach(h => { latestPrice[h.eodhd] = prices[h.eodhd]?.close ?? null })

      const dateSet = new Set()
      Object.values(history).forEach(arr => {
        if (Array.isArray(arr)) arr.forEach(d => dateSet.add(d.date))
      })

      const points = Array.from(dateSet).sort().map(date => {
        let total = 0
        portfolio.forEach(h => {
          const entry = (history[h.eodhd] || []).find(d => d.date === date)
          const lp    = latestPrice[h.eodhd]
          total += (entry && lp && lp > 0) ? (entry.close / lp) * h.value : h.value
        })
        return { date, value: Math.round(total) }
      })

      setChart(points.length > 0 ? points : null)
    } catch (err) {
      setError('Failed to load history.')
    } finally {
      setLoading(false)
    }
  }, [prices, portfolio])

  // Auto-load on mount and when period changes
  useEffect(() => {
    if (Object.keys(prices).length > 0) {
      load(period)
    }
  }, [period, prices])

  const startVal  = chart?.[0]?.value
  const endVal    = chart?.[chart.length - 1]?.value
  const change    = startVal != null && endVal != null ? endVal - startVal : null
  const changePct = startVal && change != null ? (change / startVal) * 100 : null
  const isUp      = change != null && change >= 0
  const minVal    = chart ? Math.min(...chart.map(d => d.value)) : null
  const maxVal    = chart ? Math.max(...chart.map(d => d.value)) : null
  const strokeColor = isUp ? '#4edea3' : '#ffb4ab'
  const gradientId  = isUp ? 'areaGradGreen' : 'areaGradRed'

  return (
    <div className="max-w-[1440px] mx-auto px-4 md:px-6 pt-6 pb-24">

      {/* ── Live value header (Sharesight style) ── */}
      <div className="mb-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-2">
          <div>
            <p className="text-xs text-on-surface-variant mb-1">Performance</p>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight tabular">
              {fmtCcy(totalSnap)}
            </h2>
            {dayPct != null && (
              <div className={`flex items-center gap-2 mt-1.5 ${isUp ? 'text-secondary' : 'text-error'}`}>
                <span className="material-symbols-outlined text-base">
                  {isUp ? 'arrow_upward' : 'arrow_downward'}
                </span>
                <span className="text-sm font-bold tabular">
                  {dayDollar != null ? `${isUp ? '+' : ''}${fmtCcy(dayDollar)}` : ''}
                  {' '}({isUp ? '+' : ''}{fmt(dayPct, 2)}%) Day
                </span>
              </div>
            )}
          </div>

          {/* Period selector */}
          <div className="flex items-center bg-surface-container-low rounded-lg p-1 gap-0.5 self-start md:self-auto">
            {PERIODS.map(p => (
              <button
                key={p.label}
                onClick={() => setPeriod(p.label)}
                className={`px-3 md:px-4 py-2 text-xs font-bold rounded transition-colors ${
                  period === p.label
                    ? 'bg-primary text-on-primary'
                    : 'text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Chart ── */}
      <div className="bg-surface-container rounded-xl overflow-hidden mb-6">
        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center h-56 md:h-80 text-on-surface-variant">
            <span className="material-symbols-outlined animate-spin text-3xl mr-3">progress_activity</span>
            <span className="text-sm">Loading {period} history…</span>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="flex items-center justify-center h-56 text-error text-sm">{error}</div>
        )}

        {/* Chart */}
        {chart && !loading && (
          <ResponsiveContainer width="100%" height={window.innerWidth < 768 ? 220 : 340}>
            <AreaChart data={chart} margin={{ top: 16, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="areaGradGreen" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#4edea3" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#4edea3" stopOpacity={0}   />
                </linearGradient>
                <linearGradient id="areaGradRed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#ffb4ab" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#ffb4ab" stopOpacity={0}   />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#424753" strokeOpacity={0.2} vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: '#8c909e', fontSize: 10, fontWeight: 600 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={d => {
                  if (period === 'D') return d.slice(11, 16) || d.slice(5)
                  if (period === 'Y' || period === 'MAX') return d.slice(0, 7)
                  return d.slice(5)
                }}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: '#8c909e', fontSize: 10, fontWeight: 600 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
                width={50}
                domain={['auto', 'auto']}
              />
              <Tooltip content={<CustomTooltip />} />
              {startVal && (
                <ReferenceLine
                  y={startVal}
                  stroke="#424753"
                  strokeDasharray="4 4"
                  strokeWidth={1}
                />
              )}
              <Area
                type="monotone"
                dataKey="value"
                stroke={strokeColor}
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                dot={false}
                activeDot={{ r: 4, fill: strokeColor, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}

        {/* No data */}
        {!chart && !loading && !error && (
          <div className="flex flex-col items-center justify-center h-56 text-on-surface-variant">
            <span className="material-symbols-outlined text-4xl mb-2 opacity-20">monitoring</span>
            <p className="text-sm">Loading…</p>
          </div>
        )}
      </div>

      {/* ── Stats strip ── */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 md:gap-3">
        {[
          { label: 'Start',    val: startVal  ? fmtCcy(startVal)  : '—' },
          { label: 'End',      val: endVal    ? fmtCcy(endVal)    : '—' },
          {
            label: 'Change $',
            val:   change != null ? fmtCcy(Math.abs(change)) : '—',
            color: change == null ? '' : isUp ? 'text-secondary' : 'text-error',
            prefix: change != null ? (isUp ? '+' : '-') : '',
          },
          {
            label: 'Change %',
            val:   changePct != null ? fmt(Math.abs(changePct), 2) + '%' : '—',
            color: changePct == null ? '' : isUp ? 'text-secondary' : 'text-error',
            prefix: changePct != null ? (isUp ? '+' : '-') : '',
          },
          { label: 'Low',  val: minVal ? fmtCcy(minVal) : '—' },
          { label: 'High', val: maxVal ? fmtCcy(maxVal) : '—' },
        ].map((s, i) => (
          <div key={i} className="bg-surface-container p-3 md:p-4 rounded-lg">
            <span className="text-[9px] md:text-[10px] font-bold tracking-widest uppercase text-on-surface-variant block mb-1">
              {s.label}
            </span>
            <div className={`text-sm md:text-base font-bold tabular ${s.color || 'text-on-surface'}`}>
              {s.prefix || ''}{s.val}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
