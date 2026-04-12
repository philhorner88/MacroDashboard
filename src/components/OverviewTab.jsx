import { useState } from 'react'
import ExchPill from './ExchPill'
import { fmtCcy, fmtPct, fmt } from '../utils'

const REGIONS = [
  { key: 'AU', label: 'ASX',    hexColor: '#FF9F43', bg: 'bg-[#FF9F43]/10', text: 'text-[#FF9F43]' },
  { key: 'US', label: 'US',     hexColor: '#4F8EF7', bg: 'bg-[#4F8EF7]/10', text: 'text-[#4F8EF7]' },
  { key: 'EU', label: 'Europe', hexColor: '#B76DFF', bg: 'bg-[#B76DFF]/10', text: 'text-[#B76DFF]' },
]
const DEFAULT_ROWS = 8

function safeSort(a, b, col, dir) {
  const an = parseFloat(a[col]), bn = parseFloat(b[col])
  const aOk = isFinite(an), bOk = isFinite(bn)
  if (!aOk && !bOk) return 0
  if (!aOk) return 1
  if (!bOk) return -1
  return dir === 'asc' ? an - bn : bn - an
}

function SortIcon({ col, sortCol, sortDir }) {
  if (sortCol !== col) return <span className="text-on-surface-variant/30 ml-1">↕</span>
  return <span className="text-primary ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
}

function MoverRow({ h, rank, isGainer }) {
  const pct = parseFloat(h.pct)
  return (
    <tr className={`hover:bg-surface-container-high transition-colors ${rank % 2 === 0 ? 'bg-surface-container/30' : ''}`}>
      <td className="px-6 py-4 text-xs font-medium text-on-surface-variant tabular">#{rank}</td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="font-bold">{h.eodhd.split('.')[0]}</span>
          <ExchPill exch={h.exch} />
        </div>
        <div className="text-xs text-on-surface-variant mt-0.5 truncate max-w-[140px]">{h.name}</div>
      </td>
      <td className="px-6 py-4 text-right text-xs tabular">{h.close != null ? fmt(h.close) : '–'}</td>
      <td className={`px-6 py-4 text-right text-xs font-bold tabular ${isGainer ? 'text-secondary' : 'text-error'}`}>
        {fmtPct(pct)}
      </td>
      <td className="px-6 py-4 text-right text-xs tabular">{fmtCcy(h.value)}</td>
    </tr>
  )
}

export default function OverviewTab({ prices, loading, today, portfolio, totalValue, deleted }) {
  const [exchFilter,    setExchFilter]    = useState('All')
  const [expandGainers, setExpandGainers] = useState(false)
  const [expandLosers,  setExpandLosers]  = useState(false)
  const [gSortCol,      setGSortCol]      = useState('pct')
  const [gSortDir,      setGSortDir]      = useState('desc')
  const [lSortCol,      setLSortCol]      = useState('pct')
  const [lSortDir,      setLSortDir]      = useState('asc')

  const toggleGSort = (col) => { if (gSortCol === col) setGSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setGSortCol(col); setGSortDir('desc') } }
  const toggleLSort = (col) => { if (lSortCol === col) setLSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setLSortCol(col); setLSortDir('asc') } }

  const active   = portfolio.filter(h => !deleted.has(h.eodhd))
  const enriched = active.map(h => ({
    ...h, ...(prices[h.eodhd] || {}),
    pctNum: parseFloat(prices[h.eodhd]?.pct || 0),
  }))
  const withPrices = enriched.filter(h => h.ok && isFinite(h.pctNum))
  const activeTotal = active.reduce((s, h) => s + h.value, 0)

  const avgMove  = withPrices.length ? withPrices.reduce((s, h) => s + h.pctNum * (h.value / (activeTotal || 1)), 0) : null
  const topGainer = [...withPrices].sort((a, b) => b.pctNum - a.pctNum)[0]
  const notable   = withPrices.filter(h => Math.abs(h.pctNum) >= 5)

  const regionData = REGIONS.map(r => {
    const rh  = active.filter(h => h.exch === r.key)
    const rwp = withPrices.filter(h => h.exch === r.key)
    const val = rh.reduce((s, h) => s + h.value, 0)
    const avg = rwp.length ? rwp.reduce((s, h) => s + h.pctNum * (h.value / (val || 1)), 0) : null
    return { ...r, count: rh.length, value: val, avg, weight: activeTotal ? val / activeTotal * 100 : 0 }
  })

  const filtered  = (exchFilter === 'All' ? withPrices : withPrices.filter(h => h.exch === exchFilter))
  const gainers   = [...filtered].sort((a, b) => safeSort(a, b, gSortCol, gSortDir)).filter(h => h.pctNum >= 0)
  const losers    = [...filtered].sort((a, b) => safeSort(a, b, lSortCol, lSortDir)).filter(h => h.pctNum < 0)
  const showG     = expandGainers ? gainers : gainers.slice(0, DEFAULT_ROWS)
  const showL     = expandLosers  ? losers  : losers.slice(0, DEFAULT_ROWS)

  const avgCol  = avgMove == null ? '' : avgMove >= 0 ? 'text-secondary' : 'text-error'
  const thCls   = "px-6 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest cursor-pointer hover:text-on-surface select-none"

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8 pb-24">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-10">
        <div className="bg-surface-container p-6 rounded-lg relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-primary"></div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Portfolio Value</p>
          <h2 className="text-3xl font-extrabold tracking-tight tabular">{fmtCcy(activeTotal)}</h2>
          <p className="text-xs text-on-surface-variant mt-2">{active.length} active holdings</p>
        </div>
        <div className="bg-surface-container p-6 rounded-lg">
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Avg Move Today</p>
          <h2 className={`text-3xl font-extrabold tracking-tight tabular ${avgCol}`}>
            {avgMove != null ? fmtPct(avgMove) : '—'}
          </h2>
          <p className="text-xs text-on-surface-variant mt-2">
            {loading ? 'Loading prices…' : `${withPrices.length}/${active.length} prices loaded`}
          </p>
        </div>
        <div className="bg-surface-container p-6 rounded-lg">
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Top Gainer</p>
          {topGainer ? (
            <>
              <div className="flex items-baseline gap-2">
                <h2 className="text-3xl font-extrabold tracking-tight tabular text-secondary">{fmtPct(topGainer.pctNum)}</h2>
                <span className="text-sm font-bold text-on-surface-variant">{topGainer.eodhd.split('.')[0]}</span>
              </div>
              <p className="text-xs text-on-surface-variant mt-2 truncate">{topGainer.name}</p>
            </>
          ) : <h2 className="text-3xl font-extrabold text-on-surface-variant">—</h2>}
        </div>
        <div className="bg-surface-container p-6 rounded-lg">
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Notable Moves</p>
          <h2 className="text-3xl font-extrabold tracking-tight tabular">{notable.length}</h2>
          <p className="text-xs text-on-surface-variant mt-2">{notable.length === 0 ? 'None today' : 'Assets exceeding ±5%'}</p>
        </div>
      </div>

      {/* Regional */}
      <section className="mb-10">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold">Regional Distribution</h3>
            <p className="text-xs text-on-surface-variant">Global exposure and performance · {today}</p>
          </div>
          <div className="flex bg-surface-container-low p-1 rounded-md gap-1">
            {['All','AU','US','EU'].map(f => (
              <button key={f} onClick={() => setExchFilter(f)}
                className={`px-4 py-1.5 text-xs font-bold rounded transition-colors ${exchFilter === f ? 'bg-surface-container-high text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>
                {f}
              </button>
            ))}
            <span className="px-3 py-1.5 text-xs text-on-surface-variant/60 border-l border-outline-variant/20">{withPrices.length} priced</span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {regionData.map(r => (
            <div key={r.key} className="bg-surface-container-low p-6 rounded-lg">
              <div className="flex justify-between items-start mb-4">
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-sm ${r.bg} ${r.text}`}>{r.key}</span>
                <span className="text-xs text-on-surface-variant">{r.count} Holdings</span>
              </div>
              <h4 className="text-2xl font-bold tabular mb-1">{fmtCcy(r.value)}</h4>
              <p className={`text-xs mb-5 ${r.avg != null ? (r.avg >= 0 ? 'text-secondary' : 'text-error') : 'text-on-surface-variant'}`}>
                {r.avg != null ? fmtPct(r.avg) + ' Today' : 'No prices'}
              </p>
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                  <span>Weight</span><span>{fmt(r.weight, 1)}%</span>
                </div>
                <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${r.weight}%`, backgroundColor: r.hexColor }}></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Gainers / Losers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {[
          { list: showG, all: gainers, expand: expandGainers, setExpand: setExpandGainers, sortCol: gSortCol, sortDir: gSortDir, toggleSort: toggleGSort, isGainer: true, title: 'Top Gainers', color: 'text-secondary', icon: 'arrow_upward' },
          { list: showL, all: losers,  expand: expandLosers,  setExpand: setExpandLosers,  sortCol: lSortCol, sortDir: lSortDir, toggleSort: toggleLSort, isGainer: false, title: 'Top Losers', color: 'text-error', icon: 'arrow_downward' },
        ].map(({ list, all, expand, setExpand, sortCol, sortDir, toggleSort, isGainer, title, color, icon }) => (
          <div key={title} className="bg-surface-container rounded-lg overflow-hidden">
            <div className="px-6 py-5 border-b border-outline-variant/10 flex justify-between items-center">
              <h3 className={`text-sm font-bold uppercase tracking-widest ${color} flex items-center gap-2`}>
                <span className="material-symbols-outlined text-lg">{icon}</span>{title}
              </h3>
              <span className="text-xs text-on-surface-variant">{all.length} stocks</span>
            </div>
            <table className="w-full text-left">
              <thead className="bg-surface-container-low">
                <tr>
                  <th className={thCls}>#</th>
                  <th className={thCls}>Holding</th>
                  {['close','pct','value'].map(c => (
                    <th key={c} className={`${thCls} text-right`} onClick={() => toggleSort(c)}>
                      {c === 'pct' ? 'Change' : c.charAt(0).toUpperCase() + c.slice(1)}
                      <SortIcon col={c} sortCol={sortCol} sortDir={sortDir} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/5">
                {list.map((h, i) => <MoverRow key={h.eodhd} h={h} rank={i + 1} isGainer={isGainer} />)}
                {list.length === 0 && (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-sm text-on-surface-variant">No data</td></tr>
                )}
              </tbody>
            </table>
            {all.length > DEFAULT_ROWS && (
              <div className="px-6 py-3 border-t border-outline-variant/10 text-center">
                <button onClick={() => setExpand(e => !e)} className="text-xs font-bold text-primary hover:underline">
                  {expand ? 'Show less' : `Show all ${all.length}`}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
