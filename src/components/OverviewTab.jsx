import ExchPill from './ExchPill'
import { fmtCcy, fmt } from '../utils'
import { PORTFOLIO, TOTAL_PORTFOLIO } from '../data/portfolio'

const REGIONS = [
  { key: 'AU', label: '🇦🇺 ASX',    color: '#ebf8ff', border: '#bee3f8', text: '#2b6cb0' },
  { key: 'US', label: '🇺🇸 US',     color: '#f0fff4', border: '#c6f6d5', text: '#276749' },
  { key: 'EU', label: '🇪🇺 Europe', color: '#fffaf0', border: '#fbd38d', text: '#744210' },
]

function MoverRow({ h, rank }) {
  const pctNum = parseFloat(h.pct)
  return (
    <tr>
      <td style={{ color: '#cbd5e1', fontSize: 11, paddingLeft: 16 }}>{rank}</td>
      <td>
        <div style={{ fontWeight: 700, fontSize: 12 }}>{h.eodhd} <ExchPill exch={h.exch} /></div>
        <div style={{ fontSize: 10, color: '#a0aec0' }}>{h.name}</div>
      </td>
      <td className="num" style={{ fontSize: 12 }}>
        {h.close != null ? fmt(h.close) : '—'}
      </td>
      <td className="num">
        <span style={{ fontWeight: 700, fontSize: 13 }}
          className={pctNum > 0 ? 'green' : pctNum < 0 ? 'red' : 'grey'}>
          {pctNum > 0 ? '+' : ''}{fmt(pctNum)}%
        </span>
      </td>
      <td className="num" style={{ fontSize: 12 }}>{fmtCcy(h.value)}</td>
    </tr>
  )
}

export default function OverviewTab({ prices, loading }) {
  const enriched = PORTFOLIO.map(h => ({
    ...h,
    ...(prices[h.eodhd] || {}),
    pctNum: parseFloat((prices[h.eodhd] || {}).pct),
  }))

  const withPrices = enriched.filter(h => h.ok && isFinite(h.pctNum))

  // Portfolio-level stats
  const avgMove = withPrices.length
    ? withPrices.reduce((s, h) => s + h.pctNum * (h.value / TOTAL_PORTFOLIO), 0)
    : null
  const topGainer = [...withPrices].sort((a, b) => b.pctNum - a.pctNum)[0]
  const topLoser  = [...withPrices].sort((a, b) => a.pctNum - b.pctNum)[0]
  const notable   = withPrices.filter(h => Math.abs(h.pctNum) >= 5)

  // Regional breakdown
  const regionData = REGIONS.map(reg => {
    const holdings = enriched.filter(h => h.exch === reg.key)
    const totalVal = holdings.reduce((s, h) => s + h.value, 0)
    const withP    = holdings.filter(h => h.ok && isFinite(h.pctNum))
    const avgPct   = withP.length
      ? withP.reduce((s, h) => s + h.pctNum * (h.value / (totalVal || 1)), 0)
      : null
    return { ...reg, count: holdings.length, value: totalVal, avgPct, loaded: withP.length }
  })

  const gainers = [...withPrices].sort((a, b) => b.pctNum - a.pctNum).slice(0, 8)
  const losers  = [...withPrices].sort((a, b) => a.pctNum - b.pctNum).slice(0, 8)

  return (
    <>
      {/* Top KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
        <div className="card" style={{ background: '#ebf8ff', border: '1px solid #bee3f8', padding: '14px 18px' }}>
          <div style={{ fontSize: 11, color: '#718096', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' }}>Portfolio Value</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#2d3748' }}>{fmtCcy(TOTAL_PORTFOLIO)}</div>
          <div style={{ fontSize: 11, color: '#a0aec0', marginTop: 2 }}>Snapshot · 13 Mar 2026</div>
        </div>
        <div className="card" style={{ background: '#f0fff4', border: '1px solid #c6f6d5', padding: '14px 18px' }}>
          <div style={{ fontSize: 11, color: '#718096', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' }}>Avg Move Today</div>
          <div style={{ fontSize: 26, fontWeight: 800 }}
            className={avgMove == null ? 'grey' : avgMove >= 0 ? 'green' : 'red'}>
            {avgMove == null ? '—' : `${avgMove >= 0 ? '+' : ''}${fmt(avgMove)}%`}
          </div>
          <div style={{ fontSize: 11, color: '#a0aec0', marginTop: 2 }}>
            {loading ? 'loading…' : `${withPrices.length} of ${PORTFOLIO.length} prices loaded`}
          </div>
        </div>
        <div className="card" style={{ background: '#fffaf0', border: '1px solid #fbd38d', padding: '14px 18px' }}>
          <div style={{ fontSize: 11, color: '#718096', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' }}>Top Gainer</div>
          <div style={{ fontSize: 22, fontWeight: 800 }} className="green">
            {topGainer ? `+${fmt(topGainer.pctNum)}%` : '—'}
          </div>
          <div style={{ fontSize: 11, color: '#a0aec0', marginTop: 2 }}>{topGainer?.eodhd ?? ''}</div>
        </div>
        <div className="card" style={{ background: '#fff5f5', border: '1px solid #fed7d7', padding: '14px 18px' }}>
          <div style={{ fontSize: 11, color: '#718096', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' }}>Notable Moves ≥±5%</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#2d3748' }}>{notable.length}</div>
          <div style={{ fontSize: 11, color: '#a0aec0', marginTop: 2 }}>
            {notable.length === 0 ? 'None today' : notable.slice(0, 3).map(h => h.eodhd).join(', ')}
          </div>
        </div>
      </div>

      {/* Regional breakdown */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#4a5568', marginBottom: 10 }}>Regional Breakdown</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
          {regionData.map(reg => (
            <div key={reg.key} className="card" style={{ background: reg.color, border: `1px solid ${reg.border}`, padding: '14px 18px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: reg.text, marginBottom: 8 }}>{reg.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#2d3748' }}>{fmtCcy(reg.value)}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 12 }}>
                <span style={{ color: '#718096' }}>{reg.count} holdings</span>
                {reg.avgPct != null ? (
                  <span style={{ fontWeight: 700 }} className={reg.avgPct >= 0 ? 'green' : 'red'}>
                    {reg.avgPct >= 0 ? '+' : ''}{fmt(reg.avgPct)}% avg
                  </span>
                ) : (
                  <span style={{ color: '#a0aec0' }}>—</span>
                )}
              </div>
              <div style={{ marginTop: 6 }}>
                <div style={{ height: 4, borderRadius: 2, background: '#e2e8f0' }}>
                  <div style={{
                    height: '100%', borderRadius: 2,
                    width: `${(reg.value / TOTAL_PORTFOLIO * 100).toFixed(1)}%`,
                    background: reg.text,
                  }} />
                </div>
                <div style={{ fontSize: 10, color: '#a0aec0', marginTop: 3 }}>
                  {fmt(reg.value / TOTAL_PORTFOLIO * 100, 1)}% of portfolio
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Notable moves banner */}
      {notable.length > 0 && (
        <div style={{
          background: '#fffbeb', border: '1px solid #f6e05e', borderRadius: 10,
          padding: '10px 16px', marginBottom: 16, fontSize: 12, color: '#744210',
          display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center'
        }}>
          <span style={{ fontWeight: 700 }}>⚡ Notable moves today:</span>
          {notable.map(h => (
            <span key={h.eodhd} style={{ fontWeight: 600 }}>
              {h.eodhd} <span className={h.pctNum >= 0 ? 'green' : 'red'}>
                {h.pctNum >= 0 ? '+' : ''}{fmt(h.pctNum)}%
              </span>
            </span>
          ))}
        </div>
      )}

      {/* Gainers / Losers */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card">
          <div style={{ fontSize: 14, fontWeight: 700, color: '#38a169', marginBottom: 12 }}>▲ Top Gainers</div>
          <table>
            <thead><tr>
              <th>#</th><th>Holding</th>
              <th className="num">Close</th><th className="num">Change</th><th className="num">Value</th>
            </tr></thead>
            <tbody>
              {gainers.length === 0
                ? <tr><td colSpan={5} style={{ textAlign: 'center', color: '#a0aec0', padding: 16 }}>Waiting for prices…</td></tr>
                : gainers.map((h, i) => <MoverRow key={h.eodhd} h={h} rank={i + 1} />)
              }
            </tbody>
          </table>
        </div>
        <div className="card">
          <div style={{ fontSize: 14, fontWeight: 700, color: '#e53e3e', marginBottom: 12 }}>▼ Top Losers</div>
          <table>
            <thead><tr>
              <th>#</th><th>Holding</th>
              <th className="num">Close</th><th className="num">Change</th><th className="num">Value</th>
            </tr></thead>
            <tbody>
              {losers.length === 0
                ? <tr><td colSpan={5} style={{ textAlign: 'center', color: '#a0aec0', padding: 16 }}>Waiting for prices…</td></tr>
                : losers.map((h, i) => <MoverRow key={h.eodhd} h={h} rank={i + 1} />)
              }
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
