import KpiCard from './KpiCard'
import ExchPill from './ExchPill'
import { fmtCcy, fmt } from '../utils'
import { PORTFOLIO } from '../data/portfolio'

function MoverRow({ r, rank, type }) {
  return (
    <tr>
      <td style={{ color: '#cbd5e1', width: 20, fontSize: 11 }}>{rank}</td>
      <td>
        <div style={{ fontWeight: 700, fontSize: 12 }}>{r.eodhd}</div>
        <div style={{ fontSize: 10, color: '#a0aec0' }}>{r.name}</div>
      </td>
      <td className="num" style={{ fontSize: 12 }}>{fmt(r.close)}</td>
      <td className="num">
        <span style={{ fontWeight: 800, fontSize: 13 }} className={type === 'g' ? 'green' : 'red'}>
          {type === 'g' ? '+' : ''}{fmt(r.pct)}%
        </span>
      </td>
      <td className="num" style={{ fontSize: 11, color: '#718096' }}>{fmtCcy(r.value)}</td>
    </tr>
  )
}

export default function OverviewTab({ prices, loading }) {
  const withPrices = PORTFOLIO.map(h => ({ ...h, ...(prices[h.eodhd] || {}) }))
  const loaded     = withPrices.filter(r => r.ok)
  const sorted     = [...loaded].sort((a, b) => b.pct - a.pct)
  const gainers    = sorted.filter(r => r.pct > 0).slice(0, 8)
  const losers     = [...sorted].filter(r => r.pct < 0).reverse().slice(0, 8)
  const notable    = sorted.filter(r => Math.abs(r.pct) > 5)
  const avgMove    = sorted.length ? sorted.reduce((s, r) => s + r.pct, 0) / sorted.length : 0

  return (
    <>
      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 18 }}>
        <KpiCard
          label="Portfolio Value" value={fmtCcy(1594175.78)}
          sub="Snapshot · 13 Mar 2026" bg="#ebf8ff" border="#bee3f8" subColor="#3182ce"
        />
        <KpiCard
          label="Avg Move Today"
          value={loading ? '…' : `${avgMove >= 0 ? '+' : ''}${fmt(avgMove)}%`}
          sub={`${loaded.length} of ${PORTFOLIO.length} prices loaded`}
          bg={!loading && avgMove >= 0 ? '#f0fff4' : '#fff5f5'}
          border={!loading && avgMove >= 0 ? '#c6f6d5' : '#fed7d7'}
          subColor={!loading && avgMove >= 0 ? '#38a169' : '#e53e3e'}
        />
        <KpiCard
          label="Top Gainer"
          value={gainers[0] ? `+${fmt(gainers[0].pct)}%` : '—'}
          sub={gainers[0] ? `${gainers[0].eodhd} · ${gainers[0].name}` : ''}
          bg="#fffaf0" border="#fbd38d" subColor="#c05621"
        />
        <KpiCard
          label="Notable Moves >±5%"
          value={loading ? '…' : notable.length}
          sub={notable.slice(0, 3).map(r => r.eodhd).join('  ·  ') || 'None today'}
          bg={notable.length ? '#fff5f5' : '#f7fafc'}
          border={notable.length ? '#fed7d7' : '#e2e8f0'}
          subColor={notable.length ? '#e53e3e' : '#a0aec0'}
        />
      </div>

      {/* Notable moves banner */}
      {notable.length > 0 && (
        <div className="card" style={{ marginBottom: 16, borderLeft: '4px solid #f59e0b', padding: '14px 18px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#4a5568', marginBottom: 10 }}>⚡ Notable Moves &gt;±5%</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {notable.map(r => (
              <div key={r.eodhd} style={{
                background: r.pct > 0 ? '#f0fff4' : '#fff5f5',
                border: `1px solid ${r.pct > 0 ? '#c6f6d5' : '#fed7d7'}`,
                borderRadius: 10, padding: '8px 14px', minWidth: 140
              }}>
                <div style={{ fontWeight: 700, fontSize: 12 }}>{r.eodhd} <ExchPill exch={r.exch} /></div>
                <div style={{ fontSize: 10, color: '#718096', margin: '2px 0 4px' }}>{r.name}</div>
                <div style={{ fontWeight: 800, fontSize: 20, color: r.pct > 0 ? '#38a169' : '#e53e3e' }}>
                  {r.pct > 0 ? '+' : ''}{fmt(r.pct)}%
                </div>
                <div style={{ fontSize: 10, color: '#a0aec0' }}>close {fmt(r.close)} · {fmtCcy(r.value)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gainers + Losers */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card">
          <div style={{ fontSize: 14, fontWeight: 700, color: '#4a5568', marginBottom: 12 }}>
            <span className="green">▲</span> Top Gainers
          </div>
          <table>
            <thead><tr><th>#</th><th>Holding</th><th className="num">Close</th><th className="num">Change</th><th className="num">Value</th></tr></thead>
            <tbody>{gainers.map((r, i) => <MoverRow key={r.eodhd} r={r} rank={i + 1} type="g" />)}</tbody>
          </table>
        </div>
        <div className="card">
          <div style={{ fontSize: 14, fontWeight: 700, color: '#4a5568', marginBottom: 12 }}>
            <span className="red">▼</span> Top Losers
          </div>
          <table>
            <thead><tr><th>#</th><th>Holding</th><th className="num">Close</th><th className="num">Change</th><th className="num">Value</th></tr></thead>
            <tbody>{losers.map((r, i) => <MoverRow key={r.eodhd} r={r} rank={i + 1} type="l" />)}</tbody>
          </table>
        </div>
      </div>
    </>
  )
}
