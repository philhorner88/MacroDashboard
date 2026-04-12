import { useState } from 'react'
import ExchPill from './ExchPill'
import { fmtCcy, fmt, fmtPct } from '../utils'

const STR_COLS = new Set(['eodhd','name'])

function safeSort(a, b, col, dir) {
  try {
    if (STR_COLS.has(col)) {
      return dir === 'asc' ? String(a[col]??'').localeCompare(String(b[col]??'')) : String(b[col]??'').localeCompare(String(a[col]??''))
    }
    const an = parseFloat(a[col]), bn = parseFloat(b[col])
    const aOk = isFinite(an), bOk = isFinite(bn)
    if (!aOk && !bOk) return 0; if (!aOk) return 1; if (!bOk) return -1
    return dir === 'asc' ? an - bn : bn - an
  } catch { return 0 }
}

export default function HoldingsTab({ prices, loading, portfolio, totalValue, deleted, deleteTicker, restoreTicker, restoreAll }) {
  const [sortCol,     setSortCol]     = useState('value')
  const [sortDir,     setSortDir]     = useState('desc')
  const [filter,      setFilter]      = useState('')
  const [exchFilter,  setExchFilter]  = useState('All')
  const [showDeleted, setShowDeleted] = useState(false)

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('desc') }
  }

  const rows = portfolio.map(h => ({
    ...h,
    weight: (h.value / totalValue) * 100,
    ...(prices[h.eodhd] || {}),
  }))

  const exchanges   = ['All', ...Array.from(new Set(portfolio.map(h => h.exch))).sort()]
  const activeRows  = rows.filter(r => !deleted.has(r.eodhd))
  const deletedRows = rows.filter(r =>  deleted.has(r.eodhd))

  const filtered = activeRows.filter(r => {
    const q = filter.toLowerCase()
    const matchText = !q || r.eodhd.toLowerCase().includes(q) || r.name.toLowerCase().includes(q)
    const matchExch = exchFilter === 'All' || r.exch === exchFilter
    return matchText && matchExch
  })
  const sorted = [...filtered].sort((a, b) => safeSort(a, b, sortCol, sortDir))

  const pctColor = (v) => v == null ? 'text-on-surface-variant' : v > 0 ? 'text-secondary' : v < 0 ? 'text-error' : 'text-on-surface-variant'
  const thCls    = "px-4 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest cursor-pointer hover:text-on-surface select-none"

  return (
    <div className="max-w-[1400px] mx-auto px-6 pt-8 pb-24">
      {/* Search + filters */}
      <section className="mb-8 space-y-4">
        <div className="relative">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50">search</span>
          <input
            type="text" value={filter} onChange={e => setFilter(e.target.value)}
            placeholder="Search by ticker or name…"
            className="w-full bg-surface-container-low border border-outline-variant/20 text-on-surface placeholder:text-on-surface-variant/40 py-4 pl-12 pr-4 text-base font-light rounded-lg focus:outline-none focus:border-primary transition-colors"
          />
        </div>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            {exchanges.map(f => (
              <button key={f} onClick={() => setExchFilter(f)}
                className={`px-4 py-1.5 rounded-sm text-xs font-bold uppercase tracking-wider transition-colors ${exchFilter === f ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container text-on-surface-variant hover:text-on-surface'}`}>
                {f}
              </button>
            ))}
            {deleted.size > 0 && (
              <button onClick={() => setShowDeleted(s => !s)}
                className="px-4 py-1.5 rounded-sm bg-surface-container-low text-on-surface-variant/60 text-xs font-medium italic border border-outline-variant/10">
                {deleted.size} hidden
              </button>
            )}
          </div>
          {deleted.size > 0 && (
            <button onClick={restoreAll} className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">restore</span>Restore all
            </button>
          )}
        </div>
      </section>

      {/* Table */}
      <div className="bg-surface-container rounded-lg overflow-hidden border border-outline-variant/5">
        <table className="w-full text-left border-collapse">
          <thead className="bg-surface-container-low">
            <tr>
              <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">#</th>
              {[['eodhd','Ticker'],['name','Name'],['value','Value'],['weight','Weight'],['close','Close'],['pct','% Today']].map(([col, label]) => (
                <th key={col} className={`${thCls} ${['value','weight','close','pct'].includes(col) ? 'text-right' : ''}`} onClick={() => toggleSort(col)}>
                  {label}
                  {sortCol === col
                    ? <span className="text-primary ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
                    : <span className="text-on-surface-variant/30 ml-1">↕</span>}
                </th>
              ))}
              <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/10">
            {sorted.map((h, i) => {
              const pctNum = parseFloat(h.pct)
              return (
                <tr key={h.eodhd} className="hover:bg-surface-container-high transition-colors group">
                  <td className="px-6 py-5 text-sm tabular font-medium text-on-surface-variant">{String(i+1).padStart(2,'0')}</td>
                  <td className="px-4 py-5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-primary">{h.eodhd.split('.')[0]}</span>
                      <ExchPill exch={h.exch} />
                    </div>
                  </td>
                  <td className="px-4 py-5 text-sm font-medium text-on-surface">{h.name}</td>
                  <td className="px-4 py-5 text-sm tabular text-right font-medium">{fmtCcy(h.value)}</td>
                  <td className="px-4 py-5 text-sm tabular text-right">{fmt(h.weight, 2)}%</td>
                  <td className="px-4 py-5 text-sm tabular text-right font-medium">{h.close != null ? fmt(h.close) : '—'}</td>
                  <td className={`px-4 py-5 text-sm tabular text-right font-bold ${pctColor(isNaN(pctNum) ? null : pctNum)}`}>
                    {h.pct != null ? fmtPct(pctNum) : '—'}
                  </td>
                  <td className="px-6 py-5 text-center">
                    <button onClick={() => deleteTicker(h.eodhd)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-on-surface-variant hover:text-error" title="Hide">
                      <span className="material-symbols-outlined text-lg">close</span>
                    </button>
                  </td>
                </tr>
              )
            })}
            {sorted.length === 0 && (
              <tr><td colSpan={8} className="px-6 py-12 text-center text-sm text-on-surface-variant">No holdings match your search.</td></tr>
            )}
            {showDeleted && deletedRows.map(h => (
              <tr key={`del-${h.eodhd}`} className="opacity-40 bg-surface-container-lowest/50">
                <td className="px-6 py-4 text-xs text-on-surface-variant">—</td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-on-surface-variant line-through">{h.eodhd.split('.')[0]}</span>
                    <ExchPill exch={h.exch} />
                  </div>
                </td>
                <td className="px-4 py-4 text-sm text-on-surface-variant">{h.name}</td>
                <td colSpan={4} className="px-4 py-4 text-center text-xs text-on-surface-variant italic">hidden</td>
                <td className="px-6 py-4 text-center">
                  <button onClick={() => restoreTicker(h.eodhd)} className="text-primary hover:underline text-xs font-bold">Restore</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-6 py-4 bg-surface-container-low flex justify-between items-center text-xs text-on-surface-variant">
          <div>Showing <span className="text-on-surface font-bold">{sorted.length}</span> of <span className="text-on-surface font-bold">{activeRows.length}</span> active{deleted.size > 0 && ` · ${deleted.size} hidden`}</div>
          {loading && <span className="text-primary animate-pulse">Refreshing prices…</span>}
        </div>
      </div>
    </div>
  )
}
