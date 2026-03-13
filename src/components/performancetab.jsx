import { useState, useCallback } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { fmtCcy, fmt } from '../utils'
import { PORTFOLIO, TOTAL_PORTFOLIO } from '../data/portfolio'

const PERIODS = [
  { label: '1W',     days: 7   },
  { label: '1M',     days: 30  },
  { label: '3M',     days: 90  },
  { label: '6M',     days: 180 },
  { label: '1Y',     days: 365 },
  { label: 'Custom', days: null },
]

function addDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

function toYMD(d) { return new Date(d).toISOString().split('T')[0] }

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const val = payload[0]?.value
  return (
    <div style={{
      background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
      padding: '10px 14px', fontSize: 12, boxShadow: '0 2px 12px rgba(0,0,0,.1)'
    }}>
      <div style={{ color: '#a0aec0', marginBottom: 4 }}>{label}</div>
      <div style={{ fontWeight: 800, fontSize: 16 }}>{fmtCcy(val)}</div>
    </div>
  )
}

export default function PerformanceTab({ prices }) {
  const today     = toYMD(new Date())
  const [period,  setPeriod]  = useState('1M')
  const [fromDate, setFrom]   = useState(addDays(today, -30))
  const [toDate,   setTo]     = useState(today)
  const [chartData, setChart] = useState(null)
  const [loading,  setLoading] = useState(false)
  const [error,    setError]  = useState(null)

  const getFrom = useCallback(() => {
    if (period === 'Custom') return fromDate
    const days = PERIODS.find(p => p.label === period)?.days ?? 30
    return addDays(today, -days)
  }, [period, fromDate, today])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setChart(null)
    try {
      const from    = getFrom()
      const tickers = PORTFOLIO.map(h => h.eodhd)
      const res     = await fetch(`/api/history?t=${tickers.join(',')}&from=${from}&to=${toDate}`)
      const history = await res.json()

      // Build a map of ticker -> latest price (from real-time prices prop, or last EOD)
      const latestPrice = {}
      PORTFOLIO.forEach(h => {
        const rt = prices[h.eodhd]
        latestPrice[h.eodhd] = rt?.close ?? null
      })

      // Collect all unique dates across all tickers
      const dateSet = new Set()
      Object.values(history).forEach(arr => arr.forEach(d => dateSet.add(d.date)))
      const dates = Array.from(dateSet).sort()

      // For each date, estimate portfolio value
      // approx_value = (historical_close / latest_close) * current_sharesight_value
      const points = dates.map(date => {
        let total = 0
        let covered = 0
        PORTFOLIO.forEach(h => {
          const arr   = history[h.eodhd] || []
          const entry = arr.find(d => d.date === date)
          const lp    = latestPrice[h.eodhd]
          if (entry && lp && lp > 0) {
            total   += (entry.close / lp) * h.value
            covered += h.value
          } else {
            // Can't price this holding on this date — use current value as proxy
            total += h.value
          }
        })
        return { date, value: Math.round(total) }
      })

      setChart(points)
    } catch (e) {
      setError('Failed to load history. Try again.')
    } finally {
      setLoading(false)
    }
  }, [getFrom, toDate, prices])

  const startVal = chartData?.[0]?.value
  const endVal   = chartData?.[chartData.length - 1]?.value
  const change   = startVal && endVal ? endVal - startVal : null
  const changePct = startVal && endVal ? ((endVal - startVal) / startVal) * 100 : null
  const isUp     = change != null && change >= 0

  const minVal = chartData ? Math.min(...chartData.map(d => d.value)) : 0
  const maxVal = chartData ? Math.max(...chartData.map(d => d.value)) : 0
  const yPad   = (maxVal - minVal) * 0.1 || 10000

  return (
    <>
      {/* Period selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        {PERIODS.map(p => (
          <button key={p.label} onClick={() => setPeriod(p.label)} style={{
            padding: '7px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600,
            border: period === p.label ? 'none' : '1px solid #e2e8f0',
            background: period === p.label ? '#3182ce' : '#fff',
            color: period === p.label ? '#fff' : '#4a5568', cursor: 'pointer',
          }}>{p.label}</button>
        ))}
        {period === 'Custom' && (
          <>
            <input type="date" value={fromDate} max={toDate}
              onChange={e => setFrom(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
            <span style={{ color: '#a0aec0', fontSize: 12 }}>to</span>
            <input type="date" value={toDate} min={fromDate} max={today}
              onChange={e => setTo(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
          </>
        )}
        <button onClick={load} disabled={loading} style={{
          padding: '7px 20px', borderRadius: 8, fontSize: 12, fontWeight: 700,
          border: 'none', background: loading ? '#a0aec0' : '#3182ce',
          color: '#fff', cursor: loading ? 'not-allowed' : 'pointer',
        }}>
          {loading ? 'Loading…' : 'Load'}
        </button>
      </div>

      {/* Summary KPIs */}
      {chartData && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
          {[
            { label: 'Start Value',   value: fmtCcy(startVal),  bg: '#f7fafc', border: '#e2e8f0' },
            { label: 'End Value',     value: fmtCcy(endVal),    bg: '#f7fafc', border: '#e2e8f0' },
            { label: 'Change ($)',    value: change != null ? `${isUp ? '+' : ''}${fmtCcy(change)}` : '—',
              bg: isUp ? '#f0fff4' : '#fff5f5', border: isUp ? '#c6f6d5' : '#fed7d7',
              color: isUp ? '#38a169' : '#e53e3e' },
            { label: 'Change (%)',    value: changePct != null ? `${isUp ? '+' : ''}${fmt(changePct)}%` : '—',
              bg: isUp ? '#f0fff4' : '#fff5f5', border: isUp ? '#c6f6d5' : '#fed7d7',
              color: isUp ? '#38a169' : '#e53e3e' },
          ].map(k => (
            <div key={k.label} className="card" style={{ background: k.bg, border: `1px solid ${k.border}`, padding: '14px 18px' }}>
              <div style={{ fontSize: 11, color: '#718096', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: k.color || '#2d3748' }}>{k.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Chart */}
      <div className="card">
        {!chartData && !loading && !error && (
          <div style={{ textAlign: 'center', padding: 60, color: '#a0aec0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📈</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Select a period and click Load</div>
            <div style={{ fontSize: 12 }}>Historical portfolio value based on EOD prices</div>
          </div>
        )}
        {loading && (
          <div style={{ textAlign: 'center', padding: 60, color: '#a0aec0' }}>
            <div className="spinner" style={{ margin: '0 auto 12px' }} />
            <div style={{ fontSize: 14 }}>Fetching historical prices for {PORTFOLIO.length} holdings…</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>This may take 10–20 seconds</div>
          </div>
        )}
        {error && (
          <div style={{ textAlign: 'center', padding: 40, color: '#e53e3e', fontSize: 14 }}>{error}</div>
        )}
        {chartData && chartData.length > 0 && (
          <>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#4a5568', marginBottom: 4 }}>Portfolio Value Over Time</div>
            <div style={{ fontSize: 11, color: '#a0aec0', marginBottom: 16 }}>
              Approximate · based on EOD prices and Sharesight values
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={isUp ? '#3182ce' : '#e53e3e'} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={isUp ? '#3182ce' : '#e53e3e'} stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false}
                  tickFormatter={d => d.slice(5)} interval="preserveStartEnd" />
                <YAxis
                  domain={[minVal - yPad, maxVal + yPad]}
                  tick={{ fontSize: 11 }} tickLine={false} axisLine={false}
                  tickFormatter={v => '$' + (v / 1000).toFixed(0) + 'k'}
                  width={60}
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={startVal} stroke="#e2e8f0" strokeDasharray="4 4" />
                <Area
                  type="monotone" dataKey="value"
                  stroke={isUp ? '#3182ce' : '#e53e3e'} strokeWidth={2}
                  fill="url(#grad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </>
        )}
      </div>
    </>
  )
}
