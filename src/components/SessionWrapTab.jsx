import { PORTFOLIO } from '../data/portfolio'
import { fmtPct, fmt } from '../utils'

// ── Sector map ──────────────────────────────────────────────────────────────
const SECTOR_MAP = {
  'GOOG.US':  'Internet & AI',   'GOOGL.US': 'Internet & AI',   'META.US':  'Internet & AI',
  'MSFT.US':  'Software & Cloud','ADBE.US':  'Software & Cloud','MDB.US':   'Software & Cloud',
  'NET.US':   'Software & Cloud',
  'NVDA.US':  'Semiconductors',  'AMD.US':   'Semiconductors',  'TSM.US':   'Semiconductors',
  'ASML.US':  'Semiconductors',
  'AAPL.US':  'Consumer Tech',
  'AMZN.US':  'E-Commerce',      'SHOP.US':  'E-Commerce',
  'BKNG.US':  'Travel',          'EXPE.US':  'Travel',          'ABNB.US':  'Travel',
  'LYV.US':   'Entertainment',   'DIS.US':   'Entertainment',   'NFLX.US':  'Streaming',
  'SPOT.US':  'Streaming',
  'V.US':     'Financials',      'MA.US':    'Financials',      'AXP.US':   'Financials',
  'JPM.US':   'Financials',      'BAC.US':   'Financials',      'BLK.US':   'Financials',
  'ICE.US':   'Financials',      'CB.US':    'Financials',
  'SBUX.US':  'Consumer',        'NKE.US':   'Consumer',
  'NVO.US':   'Healthcare',
  'TLT.US':   'Fixed Income',    'BND.US':   'Fixed Income',    'IEI.US':   'Fixed Income',
  'AGG.US':   'Fixed Income',    'VGSH.US':  'Fixed Income',
  'EADSY.US': 'Intl ADRs',       'ADYEY.US': 'Intl ADRs',      'LVMUY.US': 'Intl ADRs',
  'SMWB.US':  'Small Cap',       'U.US':     'Small Cap',       'XYZ.US':   'Small Cap',
}

const SECTOR_ORDER = [
  'Internet & AI', 'Semiconductors', 'Software & Cloud', 'Consumer Tech',
  'E-Commerce', 'Travel', 'Streaming', 'Entertainment',
  'Financials', 'Consumer', 'Healthcare', 'Intl ADRs',
  'Fixed Income', 'Small Cap',
]

// ── Colours ─────────────────────────────────────────────────────────────────
const C = {
  green:   '#38a169',
  red:     '#e53e3e',
  grey:    '#a0aec0',
  border:  '#e2e8f0',
  rowAlt:  '#f7fafc',
  rowAltR: '#fff5f5',
  rowAltG: '#f0fff4',
  text:    '#2d3748',
  muted:   '#718096',
  card:    { background: '#fff', borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,.07)', padding: 20 },
  th:      {
    padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700,
    color: '#718096', borderBottom: '1px solid #e2e8f0',
    textTransform: 'uppercase', letterSpacing: '.05em', whiteSpace: 'nowrap',
  },
  td: { padding: '9px 12px', fontSize: 13, borderBottom: '1px solid #f7fafc' },
}

const pctColor  = v => v == null ? C.grey : v > 0 ? C.green : v < 0 ? C.red : C.muted
const pctBg     = v => v > 0 ? C.rowAltG : v < 0 ? C.rowAltR : C.rowAlt

// ── Mini bar component ───────────────────────────────────────────────────────
function PctBar({ pct, max }) {
  if (pct == null || max === 0) return null
  const w = Math.min(Math.abs(pct) / max * 100, 100)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ flex: 1, height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          width: `${w}%`, height: '100%', borderRadius: 3,
          background: pctColor(pct), opacity: .7,
        }} />
      </div>
    </div>
  )
}

// ── Mini table used for gainers & losers ─────────────────────────────────────
function MoverTable({ rows, rank, altBg }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          {rank && <th style={{ ...C.th, width: 24 }}>#</th>}
          <th style={C.th}>Ticker</th>
          <th style={{ ...C.th, textAlign: 'right' }}>Close</th>
          <th style={{ ...C.th, textAlign: 'right' }}>Prev</th>
          <th style={{ ...C.th, textAlign: 'right' }}>Chg %</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.eodhd} style={{ background: i % 2 ? altBg : '#fff' }}>
            {rank && <td style={{ ...C.td, color: C.grey, fontSize: 11 }}>{i + 1}</td>}
            <td style={C.td}>
              <span style={{ fontWeight: 700, fontSize: 13 }}>{r.eodhd.replace('.US', '')}</span>
              <span style={{ fontSize: 11, color: C.muted, marginLeft: 6 }}>{r.name}</span>
            </td>
            <td style={{ ...C.td, textAlign: 'right', fontWeight: 600 }}>
              {r.close != null ? fmt(r.close) : '—'}
            </td>
            <td style={{ ...C.td, textAlign: 'right', color: C.muted }}>
              {r.prevClose != null ? fmt(r.prevClose) : '—'}
            </td>
            <td style={{ ...C.td, textAlign: 'right', fontWeight: 700, color: pctColor(r.pct) }}>
              {fmtPct(r.pct)}
            </td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr>
            <td colSpan={rank ? 5 : 4} style={{ ...C.td, color: C.grey, textAlign: 'center', padding: 20 }}>
              No data available
            </td>
          </tr>
        )}
      </tbody>
    </table>
  )
}

// ── Main component ───────────────────────────────────────────────────────────
export default function SessionWrapTab({ prices, loading, deleted }) {

  // Build enriched rows for US holdings only
  const rows = PORTFOLIO
    .filter(h => h.exch === 'US' && !deleted.has(h.eodhd))
    .map(h => {
      const p        = prices[h.eodhd] || {}
      const close    = p.close  ?? null
      const pct      = p.pct    ?? null
      const prevClose = (close != null && pct != null)
        ? close / (1 + pct / 100)
        : null
      return {
        ...h,
        close,
        pct,
        prevClose,
        sector: SECTOR_MAP[h.eodhd] ?? 'Other',
      }
    })

  // Split into priced / unpriced
  const priced   = rows.filter(r => r.pct != null)
  const unpriced = rows.filter(r => r.pct == null)

  // Sorted high → low
  const sorted   = [...priced].sort((a, b) => b.pct - a.pct)
  const gainers  = sorted.slice(0, 10)
  const losers   = [...sorted].reverse().slice(0, 10)

  // Notable moves
  const notable  = sorted.filter(r => Math.abs(r.pct) >= 5)

  // Avg move (equal-weighted for simplicity)
  const avgMove  = priced.length
    ? priced.reduce((s, r) => s + r.pct, 0) / priced.length
    : null

  // Max abs pct for bar scaling
  const maxPct   = priced.length ? Math.max(...priced.map(r => Math.abs(r.pct))) : 1

  // Sector aggregation
  const sectorData = {}
  for (const r of priced) {
    if (!sectorData[r.sector]) sectorData[r.sector] = { tickers: [], sum: 0 }
    sectorData[r.sector].tickers.push(r)
    sectorData[r.sector].sum += r.pct
  }
  const sectors = SECTOR_ORDER
    .filter(s => sectorData[s])
    .map(s => ({
      name:    s,
      avg:     sectorData[s].sum / sectorData[s].tickers.length,
      tickers: sectorData[s].tickers,
    }))

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Header banner ── */}
      <div style={{
        ...C.card, padding: '18px 24px',
        background: 'linear-gradient(135deg, #1a365d 0%, #2d3748 100%)',
        color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 2 }}>🇺🇸 US Session Wrap</div>
          <div style={{ fontSize: 12, color: '#90cdf4' }}>
            Wall Street Close · All prices from EODHD live feed
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          {loading
            ? <span style={{ fontSize: 12, color: '#90cdf4' }}>⏳ Loading prices…</span>
            : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: pctColor(avgMove) === C.green ? '#68d391' : pctColor(avgMove) === C.red ? '#fc8181' : '#cbd5e0' }}>
                  {fmtPct(avgMove)}
                </div>
                <div style={{ fontSize: 11, color: '#90cdf4' }}>
                  Avg move · {priced.length}/{rows.length} US prices loaded
                </div>
              </div>
            )
          }
        </div>
      </div>

      {/* ── Gainers / Losers ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div style={C.card}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, color: C.green }}>
            📈 Top 10 Gainers
          </div>
          <MoverTable rows={gainers} rank altBg={C.rowAltG} />
        </div>
        <div style={C.card}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, color: C.red }}>
            📉 Top 10 Losers
          </div>
          <MoverTable rows={losers} rank altBg={C.rowAltR} />
        </div>
      </div>

      {/* ── Notable Moves ── */}
      <div style={{
        ...C.card,
        borderLeft: `4px solid ${notable.length ? '#f6ad55' : '#e2e8f0'}`,
      }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: notable.length ? 14 : 0, color: notable.length ? '#c05621' : C.muted }}>
          ⚡ Notable Moves ≥ ±5%
          <span style={{ fontWeight: 400, fontSize: 12, color: C.muted, marginLeft: 8 }}>
            {notable.length ? `${notable.length} holding${notable.length > 1 ? 's' : ''}` : '— None today'}
          </span>
        </div>
        {notable.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {notable.map(r => (
              <div key={r.eodhd} style={{
                padding: '10px 16px', borderRadius: 10,
                background: r.pct > 0 ? '#f0fff4' : '#fff5f5',
                border: `1px solid ${r.pct > 0 ? '#c6f6d5' : '#fed7d7'}`,
                display: 'flex', alignItems: 'baseline', gap: 10,
              }}>
                <span style={{ fontWeight: 800, fontSize: 14 }}>{r.eodhd.replace('.US', '')}</span>
                <span style={{ fontSize: 11, color: C.muted }}>{r.name}</span>
                <span style={{ fontWeight: 800, fontSize: 16, color: pctColor(r.pct) }}>{fmtPct(r.pct)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Sector Snapshot ── */}
      <div style={C.card}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>🗂 Sector Snapshot</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {sectors.map(s => (
            <div key={s.name} style={{
              padding: '12px 14px', borderRadius: 10,
              background: s.avg > 0 ? '#f0fff4' : s.avg < 0 ? '#fff5f5' : '#f7fafc',
              border: `1px solid ${s.avg > 0 ? '#c6f6d5' : s.avg < 0 ? '#fed7d7' : '#e2e8f0'}`,
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 6 }}>{s.name}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: pctColor(s.avg), marginBottom: 6 }}>
                {fmtPct(s.avg)}
              </div>
              <div style={{ fontSize: 10, color: C.muted, lineHeight: 1.6 }}>
                {s.tickers.map(t => (
                  <span key={t.eodhd} style={{ marginRight: 6 }}>
                    {t.eodhd.replace('.US', '')}
                    <span style={{ color: pctColor(t.pct), marginLeft: 2 }}>{fmtPct(t.pct)}</span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Full Scorecard ── */}
      <div style={C.card}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>
          📋 Full US Scorecard
          <span style={{ fontWeight: 400, fontSize: 12, color: C.muted, marginLeft: 8 }}>
            sorted by daily % change
          </span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
            <thead>
              <tr style={{ background: '#f7fafc' }}>
                <th style={{ ...C.th, width: 28 }}>#</th>
                <th style={C.th}>Ticker</th>
                <th style={C.th}>Name</th>
                <th style={C.th}>Sector</th>
                <th style={{ ...C.th, textAlign: 'right' }}>Close</th>
                <th style={{ ...C.th, textAlign: 'right' }}>Prev Close</th>
                <th style={{ ...C.th, textAlign: 'right', minWidth: 80 }}>Chg %</th>
                <th style={{ ...C.th, width: 100 }}>Bar</th>
              </tr>
            </thead>
            <tbody>
              {[...sorted, ...unpriced].map((r, i) => (
                <tr key={r.eodhd} style={{
                  background: i % 2
                    ? (r.pct != null ? pctBg(r.pct) : C.rowAlt)
                    : '#fff',
                }}>
                  <td style={{ ...C.td, color: C.grey, fontSize: 11 }}>{i + 1}</td>
                  <td style={{ ...C.td, fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {r.eodhd.replace('.US', '')}
                  </td>
                  <td style={{ ...C.td, color: '#4a5568', fontSize: 12 }}>{r.name}</td>
                  <td style={{ ...C.td, fontSize: 11, color: C.muted }}>{r.sector}</td>
                  <td style={{ ...C.td, textAlign: 'right', fontWeight: 600 }}>
                    {r.close != null ? fmt(r.close) : <span style={{ color: '#cbd5e0' }}>—</span>}
                  </td>
                  <td style={{ ...C.td, textAlign: 'right', color: C.muted }}>
                    {r.prevClose != null ? fmt(r.prevClose) : <span style={{ color: '#cbd5e0' }}>—</span>}
                  </td>
                  <td style={{ ...C.td, textAlign: 'right', fontWeight: 700, color: pctColor(r.pct) }}>
                    {fmtPct(r.pct)}
                  </td>
                  <td style={{ ...C.td, paddingRight: 16 }}>
                    <PctBar pct={r.pct} max={maxPct} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
