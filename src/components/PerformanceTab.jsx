import { useState, useCallback } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { fmtCcy, fmt, fmtPct } from '../utils'

const PERIODS = [
  { label:'1W', days:7   }, { label:'1M', days:30  }, { label:'3M', days:90  },
  { label:'6M', days:180 }, { label:'1Y', days:365  }, { label:'Custom', days:null },
]

function addDays(date, n) {
  const d = new Date(date); d.setDate(d.getDate() + n); return d.toISOString().split('T')[0]
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface-container-highest border border-outline-variant/20 p-3 rounded-lg shadow-xl">
      <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">{label}</p>
      <p className="text-base font-black tabular">{fmtCcy(payload[0]?.value)}</p>
    </div>
  )
}

export default function PerformanceTab({ prices, portfolio }) {
  const today    = new Date().toISOString().split('T')[0]
  const [period,   setPeriod]   = useState('1M')
  const [fromDate, setFromDate] = useState(addDays(today, -30))
  const [toDate,   setToDate]   = useState(today)
  const [chart,    setChart]    = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)

  const getFrom = useCallback(() => {
    if (period === 'Custom') return fromDate
    return addDays(today, -(PERIODS.find(p => p.label === period)?.days ?? 30))
  }, [period, fromDate, today])

  const load = useCallback(async () => {
    setLoading(true); setError(null); setChart(null)
    try {
      const from    = getFrom()
      const tickers = portfolio.map(h => h.eodhd).join(',')
      const res     = await fetch(`/api/history?s=${tickers}&from=${from}&to=${toDate}`)
      const history = await res.json()
      const latestPrice = {}
      portfolio.forEach(h => { latestPrice[h.eodhd] = prices[h.eodhd]?.close ?? null })
      const dateSet = new Set()
      Object.values(history).forEach(arr => arr.forEach(d => dateSet.add(d.date)))
      const points = Array.from(dateSet).sort().map(date => {
        let total = 0
        portfolio.forEach(h => {
          const entry = (history[h.eodhd] || []).find(d => d.date === date)
          const lp    = latestPrice[h.eodhd]
          total += (entry && lp && lp > 0) ? (entry.close / lp) * h.value : h.value
        })
        return { date, value: Math.round(total) }
      })
      setChart(points)
    } catch { setError('Failed to load history. Try again.') }
    finally { setLoading(false) }
  }, [getFrom, toDate, prices, portfolio])

  const startVal  = chart?.[0]?.value
  const endVal    = chart?.[chart.length - 1]?.value
  const change    = startVal != null && endVal != null ? endVal - startVal : null
  const changePct = startVal && change != null ? (change / startVal) * 100 : null
  const isUp      = change != null && change >= 0
  const minVal    = chart ? Math.min(...chart.map(d => d.value)) : null
  const maxVal    = chart ? Math.max(...chart.map(d => d.value)) : null

  return (
    <div className="max-w-[1440px] mx-auto px-6 pt-8 pb-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div>
          <div className="text-xs font-bold tracking-widest uppercase text-on-surface-variant mb-1 flex items-center gap-2">
            <span className="opacity-50">Analytics</span>
            <span className="material-symbols-outlined text-sm">chevron_right</span>
            <span className="text-primary">Performance History</span>
          </div>
          <h2 className="text-4xl font-bold tracking-tight">Portfolio Performance</h2>
          <p className="text-on-surface-variant mt-1 text-sm">Historical NAV · EOD prices via EODHD</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-surface-container-low p-1 rounded-lg gap-0.5">
            {PERIODS.map(p => (
              <button key={p.label} onClick={() => setPeriod(p.label)}
                className={`px-4 py-2 text-xs font-bold rounded transition-colors ${period === p.label ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container'}`}>
                {p.label}
              </button>
            ))}
          </div>
          <button onClick={load} disabled={loading}
            className="bg-primary text-on-primary px-5 py-2 rounded font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50">
            {loading ? 'Loading…' : 'Load'}
          </button>
        </div>
      </div>

      {/* Custom date inputs */}
      {period === 'Custom' && (
        <div className="flex gap-4 mb-6">
          {[['From', fromDate, setFromDate], ['To', toDate, setToDate]].map(([label, val, setter]) => (
            <div key={label}>
              <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-1">{label}</label>
              <input type="date" value={val} onChange={e => setter(e.target.value)}
                className="bg-surface-container border border-outline-variant/20 text-on-surface px-3 py-2 text-sm rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        {[
          { label:'Start Value',  val: startVal  ? fmtCcy(startVal)  : '—', accent:'border-primary'           },
          { label:'End Value',    val: endVal    ? fmtCcy(endVal)    : '—', accent:'border-primary-container'  },
          { label:'Change $',     val: change    != null ? fmtCcy(Math.abs(change))          : '—', color: change    == null ? '' : isUp ? 'text-secondary' : 'text-error', prefix: change    != null ? (isUp ? '+' : '-') : '' },
          { label:'Change %',     val: changePct != null ? fmt(Math.abs(changePct), 2) + '%' : '—', color: changePct == null ? '' : isUp ? 'text-secondary' : 'text-error', prefix: changePct != null ? (isUp ? '+' : '-') : '' },
          { label:'Min Value',    val: minVal    ? fmtCcy(minVal)    : '—' },
          { label:'Max Value',    val: maxVal    ? fmtCcy(maxVal)    : '—' },
        ].map((s, i) => (
          <div key={i} className={`bg-surface-container p-5 rounded-md ${s.accent ? `border-t-4 ${s.accent}` : ''}`}>
            <span className="text-[10px] font-bold tracking-widest uppercase text-on-surface-variant block mb-2">{s.label}</span>
            <div className={`text-lg font-bold tabular ${s.color || ''}`}>{s.prefix || ''}{s.val}</div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-surface-container rounded-md p-6 mb-8">
        {!chart && !loading && !error && (
          <div className="flex flex-col items-center justify-center h-64 text-on-surface-variant">
            <span className="material-symbols-outlined text-5xl mb-3 opacity-20">monitoring</span>
            <p className="font-semibold">Select a period and click Load</p>
            <p className="text-sm">Historical portfolio value based on EOD prices</p>
          </div>
        )}
        {error   && <div className="flex items-center justify-center h-64 text-error">{error}</div>}
        {loading && (
          <div className="flex items-center justify-center h-64 text-on-surface-variant">
            <span className="material-symbols-outlined animate-spin text-3xl mr-3">progress_activity</span>Fetching historical prices…
          </div>
        )}
        {chart && !loading && (
          <ResponsiveContainer width="100%" height={380}>
            <AreaChart data={chart} margin={{ top:10, right:0, left:10, bottom:0 }}>
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#508ff8" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#508ff8" stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#424753" strokeOpacity={0.3} />
              <XAxis dataKey="date" tick={{ fill:'#c2c6d5', fontSize:10, fontWeight:600 }} tickLine={false} axisLine={false} tickFormatter={d => d.slice(5)} />
              <YAxis tick={{ fill:'#c2c6d5', fontSize:10, fontWeight:600 }} tickLine={false} axisLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} width={60} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="value" stroke="#acc7ff" strokeWidth={2.5} fill="url(#areaGrad)" dot={false} activeDot={{ r:5, fill:'#acc7ff', strokeWidth:0 }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
