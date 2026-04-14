import { useState, useEffect } from 'react'
import { fmtPct, fmt } from '../utils'

const SECTOR_MAP = {
  'GOOG.US':'Internet & AI','GOOGL.US':'Internet & AI','META.US':'Internet & AI',
  'MSFT.US':'Software','ADBE.US':'Software','MDB.US':'Software','NET.US':'Software',
  'NVDA.US':'Semis','AMD.US':'Semis','TSM.US':'Semis','ASML.US':'Semis',
  'AAPL.US':'Consumer Tech',
  'AMZN.US':'E-Commerce','SHOP.US':'E-Commerce',
  'BKNG.US':'Travel','EXPE.US':'Travel','ABNB.US':'Travel',
  'LYV.US':'Entertainment','DIS.US':'Entertainment',
  'NFLX.US':'Streaming','SPOT.US':'Streaming',
  'V.US':'Financials','MA.US':'Financials','AXP.US':'Financials','JPM.US':'Financials',
  'BAC.US':'Financials','BLK.US':'Financials','ICE.US':'Financials','CB.US':'Financials',
  'SBUX.US':'Consumer','NKE.US':'Consumer',
  'NVO.US':'Healthcare',
  'TLT.US':'Fixed Income','BND.US':'Fixed Income','IEI.US':'Fixed Income',
  'AGG.US':'Fixed Income','VGSH.US':'Fixed Income',
  'EADSY.US':'Intl ADRs','ADYEY.US':'Intl ADRs','LVMUY.US':'Intl ADRs',
  'SMWB.US':'Small Cap','U.US':'Small Cap','XYZ.US':'Small Cap',
}
const SECTOR_ORDER = [
  'Internet & AI','Semis','Software','Consumer Tech','E-Commerce',
  'Travel','Streaming','Entertainment','Financials','Consumer',
  'Healthcare','Intl ADRs','Fixed Income','Small Cap',
]
const INDICES = [
  { ticker:'GSPC.INDX', label:'S&P 500' },
  { ticker:'IXIC.INDX', label:'Nasdaq'  },
  { ticker:'DJI.INDX',  label:'Dow'     },
]

const pctColor = (v) => v == null ? 'text-on-surface-variant' : v > 0 ? 'text-secondary' : v < 0 ? 'text-error' : 'text-on-surface-variant'
const pctBadge = (v) => v == null ? 'bg-outline-variant/20 text-on-surface-variant' : v > 0 ? 'bg-secondary/10 text-secondary' : 'bg-error/10 text-error'

function timeAgo(s) {
  const d = Date.now() - new Date(s).getTime()
  const h = Math.floor(d/3600000), dd = Math.floor(d/86400000)
  return h < 24 ? `${h}h ago` : `${dd}d ago`
}

export default function SessionWrapTab({ prices, loading, portfolio, deleted }) {
  const [indices,     setIndices]     = useState({})
  const [news,        setNews]        = useState([])
  const [newsLoading, setNewsLoading] = useState(true)

  const usTickers = portfolio.filter(h => h.exch === 'US')
    .slice().sort((a,b) => b.value - a.value).slice(0,10).map(h => h.eodhd)

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

  const rows    = portfolio.filter(h => h.exch === 'US' && !deleted.has(h.eodhd))
    .map(h => ({ ...h, ...(prices[h.eodhd] || {}), pct: prices[h.eodhd]?.pct ?? null, sector: SECTOR_MAP[h.eodhd] ?? 'Other' }))
  const withPct = rows.filter(r => r.pct != null)
  const gainers = [...withPct].sort((a,b) => parseFloat(b.pct)-parseFloat(a.pct)).slice(0,10)
  const losers  = [...withPct].sort((a,b) => parseFloat(a.pct)-parseFloat(b.pct)).slice(0,10)
  const notable = withPct.filter(r => Math.abs(parseFloat(r.pct)) >= 5)
  const avgMove = withPct.length ? withPct.reduce((s,r)=>s+parseFloat(r.pct),0)/withPct.length : null

  const sectorData = SECTOR_ORDER.map(sector => {
    const members = rows.filter(r => r.sector === sector && r.pct != null)
    const avg     = members.length ? members.reduce((s,r)=>s+parseFloat(r.pct),0)/members.length : null
    return { sector, avg, members }
  })

  const MoverRow = ({ h, isGainer }) => (
    <div className="flex items-center px-4 py-3 border-b border-outline-variant/10 last:border-0">
      <div className="flex-1 min-w-0">
        <span className="font-bold text-sm">{h.eodhd.split('.')[0]}</span>
        <span className="text-xs text-on-surface-variant block truncate">{h.name}</span>
      </div>
      <div className="flex flex-col items-end ml-3 flex-shrink-0">
        <span className="text-sm font-medium tabular">{h.close != null ? fmt(h.close) : '—'}</span>
        <span className={`text-xs font-bold tabular ${isGainer ? 'text-secondary' : 'text-error'}`}>
          {fmtPct(parseFloat(h.pct))}
        </span>
      </div>
    </div>
  )

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 pt-5 pb-24">

      {/* Hero banner */}
      <div className="bg-surface-container rounded-lg p-5 md:p-8 mb-6 md:mb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold tracking-widest uppercase rounded-sm border border-primary/20 mb-2 inline-block">Market Report</span>
            <h2 className="text-2xl md:text-4xl font-extrabold tracking-tighter">🇺🇸 US Session Wrap</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-on-surface-variant text-xs">Avg:</span>
            <span className={`text-2xl font-black tabular ${pctColor(avgMove)}`}>{avgMove != null ? fmtPct(avgMove) : '—'}</span>
            <span className="text-xs text-on-surface-variant">{withPct.length}/{rows.length}</span>
          </div>
        </div>
      </div>

      {/* Index cards */}
      <div className="grid grid-cols-3 gap-3 md:gap-6 mb-6 md:mb-10">
        {INDICES.map(idx => {
          const d   = indices[idx.ticker]
          const pct = d ? parseFloat(d.pct) : null
          return (
            <div key={idx.ticker} className={`bg-surface-container p-3 md:p-6 border-t-4 ${pct == null ? 'border-outline-variant' : pct >= 0 ? 'border-secondary' : 'border-error'}`}>
              <p className="text-[9px] md:text-[10px] font-bold tracking-wider text-on-surface-variant uppercase mb-1">{idx.label}</p>
              <h3 className="text-base md:text-3xl font-bold tabular">
                {d?.close != null ? d.close.toLocaleString('en-AU', { maximumFractionDigits:0 }) : '—'}
              </h3>
              {pct != null && (
                <span className={`text-xs font-bold tabular mt-1 inline-block px-1.5 py-0.5 rounded-sm ${pctBadge(pct)}`}>
                  {fmtPct(pct)}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Movers — side by side on mobile with reduced info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 mb-6 md:mb-10">
        {[
          { items: gainers, isGainer: true,  icon: 'rocket_launch', color: 'text-secondary', title: 'Top Gainers' },
          { items: losers,  isGainer: false, icon: 'trending_down', color: 'text-error',     title: 'Top Losers'  },
        ].map(({ items, isGainer, icon, color, title }) => (
          <div key={title}>
            <div className="flex items-center gap-2 mb-3">
              <span className={`material-symbols-outlined ${color}`}>{icon}</span>
              <h4 className="text-base font-bold">{title}</h4>
            </div>
            <div className="bg-surface-container-low rounded-lg overflow-hidden">
              {items.map(h => <MoverRow key={h.eodhd} h={h} isGainer={isGainer} />)}
              {items.length === 0 && (
                <div className="py-8 text-center text-sm text-on-surface-variant">No data today</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Notable moves */}
      <div className="mb-6 p-4 rounded-lg border border-outline-variant/10 bg-surface-container">
        <h4 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant mb-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-sm">bolt</span>Notable ≥±5%
        </h4>
        {notable.length === 0
          ? <p className="text-sm text-on-surface-variant">None today</p>
          : <div className="flex flex-wrap gap-2">
              {notable.map(r => (
                <div key={r.eodhd} className="flex items-center gap-1.5 bg-surface-container-high px-3 py-1.5 rounded text-sm">
                  <span className="font-bold">{r.eodhd.split('.')[0]}</span>
                  <span className={`font-bold tabular ${pctColor(parseFloat(r.pct))}`}>{fmtPct(parseFloat(r.pct))}</span>
                </div>
              ))}
            </div>
        }
      </div>

      {/* Sector grid — 4 cols on mobile, 7 on desktop */}
      <section className="mb-8">
        <h4 className="text-lg md:text-2xl font-black tracking-tight mb-2">Sector Snapshot</h4>
        <p className="text-on-surface-variant text-sm mb-4">{SECTOR_ORDER.length} verticals</p>
        <div className="grid grid-cols-4 md:grid-cols-7 gap-px bg-outline-variant/10 border border-outline-variant/10">
          {sectorData.map(({ sector, avg, members }) => (
            <div key={sector} className={`p-2 md:p-4 ${avg == null ? 'bg-surface' : avg > 0 ? 'bg-secondary/5' : avg < 0 ? 'bg-error/5' : 'bg-surface'}`}>
              <p className="text-[8px] md:text-[10px] font-bold text-on-surface-variant mb-1 truncate">{sector}</p>
              <p className={`text-sm md:text-xl font-black tabular ${pctColor(avg)}`}>{avg != null ? fmtPct(avg) : '—'}</p>
              <div className="hidden md:flex flex-wrap gap-1 mt-1">
                {members.slice(0,2).map(m => (
                  <span key={m.eodhd} className="text-[9px] px-1 bg-surface-container-high text-on-surface-variant">{m.eodhd.split('.')[0]}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* News */}
      <section>
        <h4 className="text-xl md:text-2xl font-black tracking-tight mb-4 border-l-4 border-primary pl-4">US Market News</h4>
        {newsLoading && <p className="text-on-surface-variant text-sm">Loading…</p>}
        <div className="space-y-2">
          {news.map((a, i) => (
            <a key={i} href={a.link||a.url||'#'} target="_blank" rel="noopener noreferrer"
              className="block bg-surface-container hover:bg-surface-container-high transition-colors p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] font-bold text-primary uppercase">{a.source || 'News'}</span>
                <span className="text-[10px] text-on-surface-variant">· {a.date ? timeAgo(a.date) : ''}</span>
              </div>
              <p className="text-sm font-bold leading-snug text-on-surface line-clamp-2">{a.title}</p>
            </a>
          ))}
        </div>
      </section>
    </div>
  )
}
