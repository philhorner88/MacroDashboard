import { useState, useEffect } from 'react'
import { PORTFOLIO } from '../data/portfolio'
import { fmtPct, fmt } from '../utils'

// ── Sector map ───────────────────────────────────────────────────────────────
const SECTOR_MAP = {
  'GOOG.US':  'Internet & AI',    'GOOGL.US': 'Internet & AI',    'META.US':  'Internet & AI',
  'MSFT.US':  'Software & Cloud', 'ADBE.US':  'Software & Cloud', 'MDB.US':   'Software & Cloud',
  'NET.US':   'Software & Cloud',
  'NVDA.US':  'Semiconductors',   'AMD.US':   'Semiconductors',   'TSM.US':   'Semiconductors',
  'ASML.US':  'Semiconductors',
  'AAPL.US':  'Consumer Tech',
  'AMZN.US':  'E-Commerce',       'SHOP.US':  'E-Commerce',
  'BKNG.US':  'Travel',           'EXPE.US':  'Travel',           'ABNB.US':  'Travel',
  'LYV.US':   'Entertainment',    'DIS.US':   'Entertainment',
  'NFLX.US':  'Streaming',        'SPOT.US':  'Streaming',
  'V.US':     'Financials',       'MA.US':    'Financials',       'AXP.US':   'Financials',
  'JPM.US':   'Financials',       'BAC.US':   'Financials',       'BLK.US':   'Financials',
  'ICE.US':   'Financials',       'CB.US':    'Financials',
  'SBUX.US':  'Consumer',         'NKE.US':   'Consumer',
  'NVO.US':   'Healthcare',
  'TLT.US':   'Fixed Income',     'BND.US':   'Fixed Income',     'IEI.US':   'Fixed Income',
  'AGG.US':   'Fixed Income',     'VGSH.US':  'Fixed Income',
  'EADSY.US': 'Intl ADRs',        'ADYEY.US': 'Intl ADRs',       'LVMUY.US': 'Intl ADRs',
  'SMWB.US':  'Small Cap',        'U.US':     'Small Cap',        'XYZ.US':   'Small Cap',
}

const SECTOR_ORDER = [
  'Internet & AI', 'Semiconductors', 'Software & Cloud', 'Consumer Tech',
  'E-Commerce', 'Travel', 'Streaming', 'Entertainment',
  'Financials', 'Consumer', 'Healthcare', 'Intl ADRs', 'Fixed Income', 'Small Cap',
]

// Tickers to fetch news for — top US holdings by value
const US_NEWS_TICKERS = PORTFOLIO
  .filter(h => h.exch === 'US')
  .sort((a, b) => b.value - a.value)
  .slice(0, 10)
  .map(h => h.eodhd)

// Indices to show in the market overview bar
const INDICES = [
  { ticker: 'GSPC.INDX', label: 'S&P 500' },
  { ticker: 'IXIC.INDX', label: 'Nasdaq'  },
  { ticker: 'DJI.INDX',  label: 'Dow'     },
]

// ── Helpers ──────────────────────────────────────────────────────────────────
const pctColor  = v => v == null ? '#a0aec0' : v > 0 ? '#38a169' : v < 0 ? '#e53e3e' : '#718096'
const rowBg     = (v, i) => {
  if (v > 0) return i % 2 ? '#f0fff4' : '#f6fffa'
  if (v < 0) return i % 2 ? '#fff5f5' : '#fffafa'
  return i % 2 ? '#f7fafc' : '#fff'
}

function timeAgo(dateStr) {
  const diff  = Date.now() - new Date(dateStr).getTime()
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

// ── Shared styles ────────────────────────────────────────────────────────────
const card = { background: '#fff', borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,.07)', padding: 20 }
const TH   = {
  padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700,
  color: '#718096', borderBottom: '1px solid #e2e8f0',
  textTransform: 'uppercase', letterSpacing: '.05em', whiteSpace: 'nowrap',
}
const TD   = { padding: '9px 12px', fontSize: 13, borderBottom: '1px solid #f7fafc' }

// ── Subcomponents ────────────────────────────────────────────────────────────
function PctBar({ pct, max }) {
  if (pct == null || max === 0) return null
  const w = Math.min(Math.abs(pct) / max * 100, 100)
  return (
    <div style={{ height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{ width: `${w}%`, height: '100%', borderRadius: 3, background: pctColor(pct), opacity: .75 }} />
    </div>
  )
}

function IndexCard({ label, data }) {
  const loading = !data
  return (
    <div style={{
      flex: 1, padding: '14px 18px', borderRadius: 10,
      background: loading ? '#f7fafc' : data.pct > 0 ? '#f0fff4' : data.pct < 0 ? '#fff5f5' : '#f7fafc',
      border: `1px solid ${loading ? '#e2e8f0' : data.pct > 0 ? '#c6f6d5' : data.pct < 0 ? '#fed7d7' : '#e2e8f0'}`,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#718096', marginBottom: 4 }}>{label}</div>
      {loading
        ? <div style={{ fontSize: 18, color: '#cbd5e0' }}>—</div>
        : <>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#2d3748' }}>
              {data.close != null ? data.close.toLocaleString('en-AU', { maximumFractionDigits: 2 }) : '—'}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: pctColor(data.pct), marginTop: 2 }}>
              {fmtPct(data.pct)}
            </div>
          </>
      }
    </div>
  )
}

function SentimentBadge({ sentiment }) {
  if (!sentiment?.polarity) return null
  const map = {
    positive: ['#f0fff4', '#38a169', '↑ positive'],
    negative: ['#fff5f5', '#e53e3e', '↓ negative'],
    neutral:  ['#f7fafc', '#718096', '– neutral'],
  }
  const [bg, color, label] = map[sentiment.polarity] || map.neutral
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: bg, color }}>
      {label}
    </span>
  )
}

// ── Main component ───────────────────────────────────────────────────────────
export default function SessionWrapTab({ prices, loading, deleted }) {

  const [indices,     setIndices]     = useState({})
  const [news,        setNews]        = useState([])
  const [newsLoading, setNewsLoading] = useState(true)

  // Fetch index prices (S&P, Nasdaq, Dow)
  useEffect(() => {
    const tickers = INDICES.map(i => i.ticker).join(',')
    fetch(`/api/prices?t=${tickers}`)
      .then(r => r.json())
      .then(setIndices)
      .catch(() => {})
  }, [])

  // Fetch news for top US holdings
  useEffect(() => {
    setNewsLoading(true)
    fetch(`/api/news?t=${US_NEWS_TICKERS.join(',')}`)
      .then(r => r.json())
      .then(d => { setNews(Array.isArray(d) ? d.slice(0, 20) : []) })
      .catch(() => setNews([]))
      .finally(() => setNewsLoading(false))
  }, [])

  // Build enriched US holdings rows
  const rows = PORTFOLIO
    .filter(h => h.exch === 'US' && !deleted.has(h.eodhd))
    .map(h => {
      const p = prices[h.eodhd] || {}
      return {
        ...h,
        close:    p.close ?? null,
        prev:     p.prev  ?? null,
        pct:      p.pct   ?? null,
        sector:   SECTOR_MAP[h.eodhd] ?? 'Other',
      }
    })

  const priced   = rows.filter(r => r.pct != null)
  const unpriced = rows.filter(r => r.pct == null)
  const sorted   = [...priced].sort((a, b) => b.pct - a.pct)
  const gainers  = sorted.slice(0, 10)
  const losers   = [...sorted].reverse().slice(0, 10)
  const notable  = sorted.filter(r => Math.abs(r.pct) >= 5)
  const maxPct   = priced.length ? Math.max(...priced.map(r => Math.abs(r.pct))) : 1
  const avgMove  = priced.length ? priced.reduce((s, r) => s + r.pct, 0) / priced.length : null

  // Sector aggregation
  const sectorMap = {}
  for (const r of priced) {
    if (!sectorMap[r.sector]) sectorMap[r.sector] = []
    sectorMap[r.sector].push(r)
  }
  const sectors = SECTOR_ORDER
    .filter(s => sectorMap[s])
    .map(s => ({
      name:    s,
      avg:     sectorMap[s].reduce((a, r) => a + r.pct, 0) / sectorMap[s].length,
      tickers: sectorMap[s],
    }))

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Header ── */}
      <div style={{
        ...card, padding: '18px 24px',
        background: 'linear-gradient(135deg, #1a365d 0%, #2d3748 100%)',
        color: '#fff',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>🇺🇸 US Session Wrap</div>
            <div style={{ fontSize: 12, color: '#90cdf4', marginTop: 2 }}>
              Wall Street Close · All prices via EODHD
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            {loading
              ? <span style={{ fontSize: 12, color: '#90cdf4' }}>⏳ Loading prices…</span>
              : <>
                  <div style={{ fontSize: 26, fontWeight: 800, color: avgMove > 0 ? '#68d391' : avgMove < 0 ? '#fc8181' : '#cbd5e0' }}>
                    {fmtPct(avgMove)}
                  </div>
                  <div style={{ fontSize: 11, color: '#90cdf4' }}>
                    Avg move · {priced.length}/{rows.length} US prices
                  </div>
                </>
            }
          </div>
        </div>

        {/* Index bar */}
        <div style={{ display: 'flex', gap: 12 }}>
          {INDICES.map(({ ticker, label }) => (
            <IndexCard key={ticker} label={label} data={indices[ticker] || null} />
          ))}
        </div>
      </div>

      {/* ── Gainers / Losers ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* Gainers */}
        <div style={card}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#38a169', marginBottom: 14 }}>📈 Top 10 Gainers</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={{ ...TH, width: 24 }}>#</th>
              <th style={TH}>Ticker</th>
              <th style={{ ...TH, textAlign: 'right' }}>Close</th>
              <th style={{ ...TH, textAlign: 'right' }}>Prev</th>
              <th style={{ ...TH, textAlign: 'right' }}>Chg %</th>
            </tr></thead>
            <tbody>
              {gainers.length === 0
                ? <tr><td colSpan={5} style={{ ...TD, textAlign: 'center', color: '#a0aec0', padding: 20 }}>No data</td></tr>
                : gainers.map((r, i) => (
                  <tr key={r.eodhd} style={{ background: i % 2 ? '#f0fff4' : '#fff' }}>
                    <td style={{ ...TD, color: '#a0aec0', fontSize: 11 }}>{i + 1}</td>
                    <td style={TD}>
                      <div style={{ fontWeight: 700 }}>{r.eodhd.replace('.US', '')}</div>
                      <div style={{ fontSize: 11, color: '#718096' }}>{r.name}</div>
                    </td>
                    <td style={{ ...TD, textAlign: 'right', fontWeight: 600 }}>{r.close != null ? fmt(r.close) : '—'}</td>
                    <td style={{ ...TD, textAlign: 'right', color: '#718096' }}>{r.prev != null ? fmt(r.prev) : '—'}</td>
                    <td style={{ ...TD, textAlign: 'right', fontWeight: 700, color: '#38a169' }}>{fmtPct(r.pct)}</td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>

        {/* Losers */}
        <div style={card}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#e53e3e', marginBottom: 14 }}>📉 Top 10 Losers</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={{ ...TH, width: 24 }}>#</th>
              <th style={TH}>Ticker</th>
              <th style={{ ...TH, textAlign: 'right' }}>Close</th>
              <th style={{ ...TH, textAlign: 'right' }}>Prev</th>
              <th style={{ ...TH, textAlign: 'right' }}>Chg %</th>
            </tr></thead>
            <tbody>
              {losers.length === 0
                ? <tr><td colSpan={5} style={{ ...TD, textAlign: 'center', color: '#a0aec0', padding: 20 }}>No data</td></tr>
                : losers.map((r, i) => (
                  <tr key={r.eodhd} style={{ background: i % 2 ? '#fff5f5' : '#fff' }}>
                    <td style={{ ...TD, color: '#a0aec0', fontSize: 11 }}>{i + 1}</td>
                    <td style={TD}>
                      <div style={{ fontWeight: 700 }}>{r.eodhd.replace('.US', '')}</div>
                      <div style={{ fontSize: 11, color: '#718096' }}>{r.name}</div>
                    </td>
                    <td style={{ ...TD, textAlign: 'right', fontWeight: 600 }}>{r.close != null ? fmt(r.close) : '—'}</td>
                    <td style={{ ...TD, textAlign: 'right', color: '#718096' }}>{r.prev != null ? fmt(r.prev) : '—'}</td>
                    <td style={{ ...TD, textAlign: 'right', fontWeight: 700, color: '#e53e3e' }}>{fmtPct(r.pct)}</td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Notable Moves ── */}
      <div style={{ ...card, borderLeft: `4px solid ${notable.length ? '#f6ad55' : '#e2e8f0'}` }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: notable.length ? '#c05621' : '#a0aec0', marginBottom: notable.length ? 12 : 0 }}>
          ⚡ Notable Moves ≥ ±5%
          <span style={{ fontWeight: 400, fontSize: 12, color: '#a0aec0', marginLeft: 8 }}>
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
                <span style={{ fontSize: 11, color: '#718096' }}>{r.name}</span>
                <span style={{ fontWeight: 800, fontSize: 16, color: pctColor(r.pct) }}>{fmtPct(r.pct)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Sector Snapshot ── */}
      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>🗂 Sector Snapshot</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 12 }}>
          {sectors.map(s => (
            <div key={s.name} style={{
              padding: '12px 14px', borderRadius: 10,
              background: s.avg > 0 ? '#f0fff4' : s.avg < 0 ? '#fff5f5' : '#f7fafc',
              border: `1px solid ${s.avg > 0 ? '#c6f6d5' : s.avg < 0 ? '#fed7d7' : '#e2e8f0'}`,
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#2d3748', marginBottom: 4 }}>{s.name}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: pctColor(s.avg), marginBottom: 6 }}>{fmtPct(s.avg)}</div>
              <div style={{ fontSize: 10, color: '#718096', lineHeight: 1.8 }}>
                {s.tickers.map(t => (
                  <span key={t.eodhd} style={{ marginRight: 8 }}>
                    <span style={{ fontWeight: 600 }}>{t.eodhd.replace('.US', '')}</span>
                    <span style={{ color: pctColor(t.pct), marginLeft: 3 }}>{fmtPct(t.pct)}</span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── US Market News ── */}
      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>
          📰 US Market News
          <span style={{ fontWeight: 400, fontSize: 11, color: '#a0aec0', marginLeft: 8 }}>
            via EODHD · your top holdings
          </span>
        </div>
        {newsLoading ? (
          <div style={{ textAlign: 'center', padding: 30, color: '#a0aec0' }}>
            <div className="spinner" style={{ margin: '0 auto 10px' }} />
            Loading news…
          </div>
        ) : news.length === 0 ? (
          <div style={{ color: '#a0aec0', fontSize: 13 }}>No news available.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {news.map((item, i) => (
              <a key={i} href={item.link} target="_blank" rel="noopener noreferrer"
                style={{ textDecoration: 'none' }}>
                <div style={{
                  padding: '12px 14px', borderRadius: 10,
                  background: i % 2 ? '#f7fafc' : '#fff',
                  border: '1px solid #e2e8f0',
                  transition: 'border-color .15s',
                }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: '#2d3748', marginBottom: 6, lineHeight: 1.4 }}>
                    {item.title}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: '#a0aec0' }}>{timeAgo(item.date)}</span>
                    {item.symbols?.slice(0, 5).map(s => (
                      <span key={s} style={{
                        fontSize: 10, fontWeight: 700, padding: '1px 7px',
                        borderRadius: 10, background: '#ebf8ff', color: '#2b6cb0',
                      }}>{s.split('.')[0]}</span>
                    ))}
                    <SentimentBadge sentiment={item.sentiment} />
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* ── Full Scorecard ── */}
      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>
          📋 Full US Scorecard
          <span style={{ fontWeight: 400, fontSize: 11, color: '#a0aec0', marginLeft: 8 }}>sorted by daily % change</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
            <thead>
              <tr style={{ background: '#f7fafc' }}>
                <th style={{ ...TH, width: 28 }}>#</th>
                <th style={TH}>Ticker</th>
                <th style={TH}>Name</th>
                <th style={TH}>Sector</th>
                <th style={{ ...TH, textAlign: 'right' }}>Close</th>
                <th style={{ ...TH, textAlign: 'right' }}>Prev Close</th>
                <th style={{ ...TH, textAlign: 'right' }}>Chg %</th>
                <th style={{ ...TH, minWidth: 90 }}>Bar</th>
              </tr>
            </thead>
            <tbody>
              {[...sorted, ...unpriced].map((r, i) => (
                <tr key={r.eodhd} style={{ background: rowBg(r.pct, i) }}>
                  <td style={{ ...TD, color: '#a0aec0', fontSize: 11 }}>{i + 1}</td>
                  <td style={{ ...TD, fontWeight: 700 }}>{r.eodhd.replace('.US', '')}</td>
                  <td style={{ ...TD, color: '#4a5568', fontSize: 12 }}>{r.name}</td>
                  <td style={{ ...TD, fontSize: 11, color: '#718096' }}>{r.sector}</td>
                  <td style={{ ...TD, textAlign: 'right', fontWeight: 600 }}>
                    {r.close != null ? fmt(r.close) : <span style={{ color: '#cbd5e0' }}>—</span>}
                  </td>
                  <td style={{ ...TD, textAlign: 'right', color: '#718096' }}>
                    {r.prev != null ? fmt(r.prev) : <span style={{ color: '#cbd5e0' }}>—</span>}
                  </td>
                  <td style={{ ...TD, textAlign: 'right', fontWeight: 700, color: pctColor(r.pct) }}>
                    {fmtPct(r.pct)}
                  </td>
                  <td style={{ ...TD, paddingRight: 16, minWidth: 90 }}>
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
