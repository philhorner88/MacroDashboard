import { useState, useEffect } from 'react'
import { fmtPct, fmt } from '../utils'

const SECTOR_MAP = {
  'GOOG.US':'Internet & AI',   'GOOGL.US':'Internet & AI',  'META.US':'Internet & AI',
  'MSFT.US':'Software & Cloud','ADBE.US':'Software & Cloud','MDB.US': 'Software & Cloud','NET.US':'Software & Cloud',
  'NVDA.US':'Semiconductors',  'AMD.US': 'Semiconductors',  'TSM.US':'Semiconductors',  'ASML.US':'Semiconductors',
  'AAPL.US':'Consumer Tech',
  'AMZN.US':'E-Commerce',      'SHOP.US':'E-Commerce',
  'BKNG.US':'Travel',          'EXPE.US':'Travel',          'ABNB.US':'Travel',
  'LYV.US': 'Entertainment',   'DIS.US': 'Entertainment',
  'NFLX.US':'Streaming',       'SPOT.US':'Streaming',
  'V.US':'Financials','MA.US':'Financials','AXP.US':'Financials','JPM.US':'Financials',
  'BAC.US':'Financials','BLK.US':'Financials','ICE.US':'Financials','CB.US':'Financials',
  'SBUX.US':'Consumer','NKE.US':'Consumer',
  'NVO.US':'Healthcare',
  'TLT.US':'Fixed Income','BND.US':'Fixed Income','IEI.US':'Fixed Income','AGG.US':'Fixed Income','VGSH.US':'Fixed Income',
  'EADSY.US':'Intl ADRs','ADYEY.US':'Intl ADRs','LVMUY.US':'Intl ADRs',
  'SMWB.US':'Small Cap','U.US':'Small Cap','XYZ.US':'Small Cap',
}
const SECTOR_ORDER = [
  'Internet & AI','Semiconductors','Software & Cloud','Consumer Tech',
  'E-Commerce','Travel','Streaming','Entertainment',
  'Financials','Consumer','Healthcare','Intl ADRs','Fixed Income','Small Cap',
]
const INDICES = [
  { ticker:'GSPC.INDX', label:'S&P 500' },
  { ticker:'IXIC.INDX', label:'Nasdaq'  },
  { ticker:'DJI.INDX',  label:'Dow'     },
]

const pctColor = (v) => v == null ? 'text-on-surface-variant' : v > 0 ? 'text-secondary' : v < 0 ? 'text-error' : 'text-on-surface-variant'
const pctBadge = (v) => v == null ? 'bg-outline-variant/20 text-on-surface-variant' : v > 0 ? 'bg-secondary/10 text-secondary' : v < 0 ? 'bg-error/10 text-error' : 'bg-outline-variant/20 text-on-surface-variant'

function timeAgo(s) {
  const d = Date.now() - new Date(s).getTime()
  const h = Math.floor(d/3600000), dd = Math.floor(d/86400000)
  return h < 24 ? `${h}h ago` : `${dd}d ago`
}

export default function SessionWrapTab({ prices, loading, portfolio, deleted }) {
  const [indices,      setIndices]      = useState({})
  const [news,         setNews]         = useState([])
  const [newsLoading,  setNewsLoading]  = useState(true)

  const usTickers = portfolio
    .filter(h => h.exch === 'US')
    .slice().sort((a, b) => b.value - a.value)
    .slice(0, 10)
    .map(h => h.eodhd)

  useEffect(() => {
    fetch(`/api/prices?s=${INDICES.map(i => i.ticker).join(',')}`)
      .then(r => r.json()).then(setIndices).catch(() => {})
  }, [])

  useEffect(() => {
    setNewsLoading(true)
    fetch(`/api/news?s=${usTickers.join(',')}`)
      .then(r => r.json())
      .then(d => setNews(Array.isArray(d) ? d.slice(0, 20) : []))
      .catch(() => {})
      .finally(() => setNewsLoading(false))
  }, [])

  const rows = portfolio
    .filter(h => h.exch === 'US' && !deleted.has(h.eodhd))
    .map(h => {
      const p = prices[h.eodhd] || {}
      return { ...h, close: p.close ?? null, prev: p.prev ?? null, pct: p.pct ?? null, sector: SECTOR_MAP[h.eodhd] ?? 'Other' }
    })

  const withPct  = rows.filter(r => r.pct != null)
  const gainers  = [...withPct].sort((a,b) => parseFloat(b.pct)-parseFloat(a.pct)).slice(0,10)
  const losers   = [...withPct].sort((a,b) => parseFloat(a.pct)-parseFloat(b.pct)).slice(0,10)
  const notable  = withPct.filter(r => Math.abs(parseFloat(r.pct)) >= 5)
  const avgMove  = withPct.length ? withPct.reduce((s,r) => s+parseFloat(r.pct),0)/withPct.length : null

  const sectorData = SECTOR_ORDER.map(sector => {
    const members = rows.filter(r => r.sector === sector && r.pct != null)
    const avg     = members.length ? members.reduce((s,r) => s+parseFloat(r.pct),0)/members.length : null
    return { sector, avg, members }
  })

  const thCls = "py-3 px-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest"

  const MoverTable = ({ items, isGainer }) => (
    <div className="bg-surface-container-low overflow-hidden rounded-lg">
      <table className="w-full text-left">
        <thead className="bg-surface-container-high/50">
          <tr>
            <th className={thCls}>Ticker</th>
            <th className={`${thCls} text-right`}>Close</th>
            <th className={`${thCls} text-right`}>Prev</th>
            <th className={`${thCls} text-right`}>Chg%</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant/10">
          {items.map((h, i) => (
            <tr key={h.eodhd} className={`hover:bg-surface-container transition-colors ${i%2===1?'bg-surface-container/20':''}`}>
              <td className="py-3 px-4">
                <div className="font-bold text-sm">{h.eodhd.split('.')[0]}</div>
                <div className="text-xs text-on-surface-variant truncate max-w-[140px]">{h.name}</div>
              </td>
              <td className="py-3 px-4 text-right tabular text-sm font-medium">{h.close != null ? fmt(h.close) : '—'}</td>
              <td className="py-3 px-4 text-right tabular text-sm text-on-surface-variant">{h.prev != null ? fmt(h.prev) : '—'}</td>
              <td className={`py-3 px-4 text-right tabular text-sm font-bold ${isGainer ? 'text-secondary' : 'text-error'}`}>
                {fmtPct(parseFloat(h.pct))}
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr><td colSpan={4} className="py-8 text-center text-sm text-on-surface-variant">No data today</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )

  return (
    <div className="max-w-7xl mx-auto px-6 pt-8 pb-24">
      {/* Hero banner */}
      <section className="bg-surface-container rounded-lg p-8 mb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold tracking-widest uppercase rounded-sm border border-primary/20 mb-3 inline-block">Market Report</span>
            <h2 className="text-4xl font-extrabold tracking-tighter">🇺🇸 US Session Wrap</h2>
            <p className="text-on-surface-variant mt-1 text-sm">Wall Street Close · All prices via EODHD</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-on-surface-variant text-sm">Avg session move:</span>
            <span className={`text-3xl font-black tabular ${pctColor(avgMove)}`}>{avgMove != null ? fmtPct(avgMove) : '—'}</span>
            {avgMove != null && (
              <span className={`material-symbols-outlined text-2xl ${pctColor(avgMove)}`}>{avgMove >= 0 ? 'trending_up' : 'trending_down'}</span>
            )}
            <span className="text-xs text-on-surface-variant ml-1">{withPct.length}/{rows.length} US</span>
          </div>
        </div>
      </section>

      {/* Index cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        {INDICES.map(idx => {
          const d   = indices[idx.ticker]
          const pct = d ? parseFloat(d.pct) : null
          return (
            <div key={idx.ticker} className={`bg-surface-container p-6 border-t-4 ${pct == null ? 'border-outline-variant' : pct >= 0 ? 'border-secondary' : 'border-error'}`}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-[10px] font-bold tracking-wider text-on-surface-variant uppercase mb-1">{idx.label}</p>
                  <h3 className="text-3xl font-bold tabular">
                    {d?.close != null ? d.close.toLocaleString('en-AU', { maximumFractionDigits:2 }) : '—'}
                  </h3>
                </div>
                {pct != null && <span className={`px-2 py-1 text-xs font-bold rounded-sm tabular ${pctBadge(pct)}`}>{fmtPct(pct)}</span>}
              </div>
            </div>
          )
        })}
      </div>

      {/* Movers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
        <section>
          <div className="flex items-center gap-2 mb-5">
            <span className="material-symbols-outlined text-secondary">rocket_launch</span>
            <h4 className="text-lg font-bold">Top 10 US Gainers</h4>
          </div>
          <MoverTable items={gainers} isGainer={true} />
        </section>
        <section>
          <div className="flex items-center gap-2 mb-5">
            <span className="material-symbols-outlined text-error">trending_down</span>
            <h4 className="text-lg font-bold">Top 10 US Losers</h4>
          </div>
          <MoverTable items={losers} isGainer={false} />
        </section>
      </div>

      {/* Notable moves */}
      <div className={`mb-10 p-5 rounded-lg border ${notable.length > 0 ? 'bg-surface-container border-outline-variant/10' : 'bg-surface-container border-outline-variant/10'}`}>
        <h4 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant mb-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">bolt</span>Notable Moves ≥±5%
        </h4>
        {notable.length === 0
          ? <p className="text-sm text-on-surface-variant">None today</p>
          : <div className="flex flex-wrap gap-3">
              {notable.map(r => (
                <div key={r.eodhd} className="flex items-center gap-2 bg-surface-container-high px-4 py-2 rounded">
                  <span className="font-bold text-sm">{r.eodhd.split('.')[0]}</span>
                  <span className={`font-bold text-sm tabular ${pctColor(parseFloat(r.pct))}`}>{fmtPct(parseFloat(r.pct))}</span>
                </div>
              ))}
            </div>
        }
      </div>

      {/* Sector snapshot */}
      <section className="mb-10">
        <h4 className="text-2xl font-black tracking-tight mb-2">Sector Snapshot</h4>
        <p className="text-on-surface-variant text-sm mb-6">Performance across {SECTOR_ORDER.length} key verticals</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-px bg-outline-variant/10 border border-outline-variant/10">
          {sectorData.map(({ sector, avg, members }) => (
            <div key={sector} className={`p-4 hover:bg-surface-container transition-colors ${avg == null ? 'bg-surface' : avg > 0 ? 'bg-secondary/5' : avg < 0 ? 'bg-error/5' : 'bg-surface'}`}>
              <p className="text-[10px] font-bold text-on-surface-variant mb-1 truncate">{sector}</p>
              <p className={`text-xl font-black tabular mb-2 ${pctColor(avg)}`}>{avg != null ? fmtPct(avg) : '—'}</p>
              <div className="flex flex-wrap gap-1">
                {members.slice(0,2).map(m => (
                  <span key={m.eodhd} className="text-[9px] px-1 bg-surface-container-high text-on-surface-variant">{m.eodhd.split('.')[0]}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* US market news */}
      <section>
        <div className="flex items-center justify-between mb-6 border-l-4 border-primary pl-4">
          <h4 className="text-2xl font-black tracking-tight">US Market News</h4>
        </div>
        {newsLoading && <p className="text-on-surface-variant text-sm">Loading news…</p>}
        {!newsLoading && news.length === 0 && <p className="text-on-surface-variant text-sm">No news available.</p>}
        <div className="space-y-3">
          {news.map((a, i) => (
            <article key={i} className="flex gap-5 bg-surface-container hover:bg-surface-container-high transition-colors p-5 rounded-lg group">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-bold text-primary uppercase">{a.source || 'News'}</span>
                  <span className="text-[10px] text-on-surface-variant">· {a.date ? timeAgo(a.date) : ''}</span>
                  {(a.symbols || []).slice(0,3).map((s,j) => (
                    <span key={j} className="px-1.5 py-0.5 bg-surface-container-highest text-on-surface-variant text-[9px] font-mono border border-outline-variant/10">
                      {s.split('.')[0]}
                    </span>
                  ))}
                </div>
                <a href={a.link||a.url||'#'} target="_blank" rel="noopener noreferrer"
                  className="text-sm font-bold leading-snug group-hover:text-primary transition-colors line-clamp-2">
                  {a.title}
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
