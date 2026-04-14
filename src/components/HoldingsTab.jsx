import { useState } from 'react'
import ExchPill from './ExchPill'
import { fmtCcy, fmt, fmtPct } from '../utils'

const STR_COLS = new Set(['eodhd','name'])

function safeSort(a, b, col, dir) {
  try {
    if (STR_COLS.has(col)) {
      return dir === 'asc' ? String(a[col]??'').localeCompare(String(b[col]??''))
                           : String(b[col]??'').localeCompare(String(a[col]??''))
    }
    const an = parseFloat(a[col]), bn = parseFloat(b[col])
    const aOk = isFinite(an), bOk = isFinite(bn)
    if (!aOk && !bOk) return 0; if (!aOk) return 1; if (!bOk) return -1
    return dir === 'asc' ? an - bn : bn - an
  } catch { return 0 }
}

function pctColor(v) {
  if (v == null) return 'text-on-surface-variant'
  return v > 0 ? 'text-secondary' : v < 0 ? 'text-error' : 'text-on-surface-variant'
}

function pctBg(v) {
  if (v == null) return ''
  return v > 0 ? 'bg-secondary/10' : v < 0 ? 'bg-error/10' : ''
}

// Mobile: single card per holding
function HoldingCard({ h, i, onDelete }) {
  const pctNum = parseFloat(h.pct)
  const hasPct = h.pct != null && !isNaN(pctNum)

  return (
    <div className="flex items-center px-4 py-3.5 border-b border-outline-variant/10 last:border-0 active:bg-surface-container-high transition-colors">
      {/* Rank */}
      <span className="text-xs text-on-surface-variant tabular w-7 flex-shrink-0">{String(i+1).padStart(2,'0')}</span>

      {/* Main info */}
      <div className="flex-1 min-w-0 ml-1">
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-sm text-primary">{h.eodhd.split('.')[0]}</span>
          <ExchPill exch={h.exch} />
        </div>
        <span className="text-xs text-on-surface-variant truncate block">{h.name}</span>
      </div>

      {/* Value + move */}
      <div className="flex flex-col items-end gap-0.5 ml-3 flex-shrink-0">
        <span className="text-sm font-bold tabular">{fmtCcy(h.value)}</span>
        {hasPct ? (
          <span className={`text-xs font-bold tabular px-1.5 py-0.5 rounded-sm ${pctBg(pctNum)} ${pctColor(pctNum)}`}>
            {fmtPct(pctNum)}
          </span>
        ) : (
          <span className="text-xs text-on-surface-variant/50">—</span>
        )}
      </div>

      {/* Delete */}
      <button
        onClick={() => onDelete(h.eodhd)}
        className="ml-3 text-on-surface-variant/40 hover:text-error transition-colors flex-shrink-0 p-1"
      >
        <span className="material-symbols-outlined text-base">close</span>
      </button>
    </div>
  )
}

export default function HoldingsTab({ prices, loading, portfolio, totalValue, deleted, deleteTicker, restoreTicker, restoreAll }) {
  const [sortCol,    setSortCol]    = useState('value')
  const [sortDir,    setSortDir]    = useState('desc')
  const [filter,     setFilter]     = useState('')
  const [exchFilter, setExchFilter] = useState('All')
  const [showDeleted,setShowDeleted]= useState(false)

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

  const thCls = "px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest cursor-pointer hover:text-on-surface select-none"

  return (
    <div className="max-w-[1400px] mx-auto pb-24">

      {/* ── Search + Filters ── */}
      <div className="sticky top-[57px] md:top-[65px] z-30 bg-background px-4 md:px-6 pt-4 pb-3 space-y-3 border-b border-outline-variant/10">
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-lg">search</span>
          <input
            type="text" value={filter} onChange={e => setFilter(e.target.value)}
            placeholder="Search ticker or name…"
            className="w-full bg-surface-container-low border border-outline-variant/20 text-on-surface placeholder:text-on-surface-variant/40 py-3 pl-10 pr-4 text-sm rounded-lg focus:outline-none focus:border-primary transition-colors"
          />
          {filter && (
            <button onClick={() => setFilter('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant">
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {exchanges.map(f => (
              <button key={f} onClick={() => setExchFilter(f)}
                className={`px-3 py-1.5 rounded-sm text-xs font-bold uppercase tracking-wider flex-shrink-0 transition-colors ${exchFilter === f ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container text-on-surface-variant'}`}>
                {f}
              </button>
            ))}
            {deleted.size > 0 && (
              <button onClick={() => setShowDeleted(s => !s)}
                className="px-3 py-1.5 rounded-sm bg-surface-container-low text-on-surface-variant/60 text-xs font-medium italic border border-outline-variant/10 flex-shrink-0">
                {deleted.size} hidden
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 ml-2 flex-shrink-0">
            <span className="text-xs text-on-surface-variant">{sorted.length}/{activeRows.length}</span>
            {deleted.size > 0 && (
              <button onClick={restoreAll} className="text-xs font-bold text-primary">
                Restore all
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Mobile: Card list ── */}
      <div className="md:hidden bg-surface-container">
        {sorted.map((h, i) => (
          <HoldingCard key={h.eodhd} h={h} i={i} onDelete={deleteTicker} />
        ))}
        {sorted.length === 0 && (
          <div className="px-4 py-16 text-center text-sm text-on-surface-variant">
            No holdings match your search.
          </div>
        )}
        {showDeleted && deletedRows.map(h => (
          <div key={`del-${h.eodhd}`} className="flex items-center px-4 py-3 border-b border-outline-variant/10 opacity-40">
            <span className="text-xs text-on-surface-variant w-7">—</span>
            <div className="flex-1 min-w-0 ml-1">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm text-on-surface-variant line-through">{h.eodhd.split('.')[0]}</span>
                <ExchPill exch={h.exch} />
              </div>
            </div>
            <button onClick={() => restoreTicker(h.eodhd)} className="text-xs font-bold text-primary ml-3">
              Restore
            </button>
          </div>
        ))}
      </div>

      {/* ── Desktop: Table ── */}
      <div className="hidden md:block px-6 pt-6">
        <div className="bg-surface-container rounded-lg overflow-hidden border border-outline-variant/5">
          <table className="w-full text-left border-collapse">
            <thead className="bg-surface-container-low">
              <tr>
                <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">#</th>
                {[['eodhd','Ticker'],['name','Name'],['value','Value'],['weight','Weight'],['close','Close'],['pct','% Today']].map(([col, label]) => (
                  <th key={col} onClick={() => toggleSort(col)}
                    className={`${thCls} ${['value','weight','close','pct'].includes(col) ? 'text-right' : ''}`}>
                    {label}
                    {sortCol === col
                      ? <span className="text-primary ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
                      : <span className="text-on-surface-variant/30 ml-1">↕</span>}
                  </th>
                ))}
                <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest text-center">Act</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {sorted.map((h, i) => {
                const pctNum = parseFloat(h.pct)
                return (
                  <tr key={h.eodhd} className="hover:bg-surface-container-high transition-colors group">
                    <td className="px-6 py-4 text-sm tabular font-medium text-on-surface-variant">{String(i+1).padStart(2,'0')}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-primary">{h.eodhd.split('.')[0]}</span>
                        <ExchPill exch={h.exch} />
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm font-medium text-on-surface">{h.name}</td>
                    <td className="px-4 py-4 text-sm tabular text-right font-medium">{fmtCcy(h.value)}</td>
                    <td className="px-4 py-4 text-sm tabular text-right">{fmt(h.weight, 2)}%</td>
                    <td className="px-4 py-4 text-sm tabular text-right font-medium">{h.close != null ? fmt(h.close) : '—'}</td>
                    <td className={`px-4 py-4 text-sm tabular text-right font-bold ${pctColor(isNaN(pctNum) ? null : pctNum)}`}>
                      {h.pct != null ? fmtPct(pctNum) : '—'}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button onClick={() => deleteTicker(h.eodhd)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-on-surface-variant hover:text-error">
                        <span className="material-symbols-outlined text-lg">close</span>
                      </button>
                    </td>
                  </tr>
                )
              })}
              {sorted.length === 0 && (
                <tr><td colSpan={8} className="px-6 py-12 text-center text-sm text-on-surface-variant">No holdings match.</td></tr>
              )}
              {showDeleted && deletedRows.map(h => (
                <tr key={`del-${h.eodhd}`} className="opacity-40 bg-surface-container-lowest/50">
                  <td className="px-6 py-3 text-xs text-on-surface-variant">—</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-on-surface-variant line-through">{h.eodhd.split('.')[0]}</span>
                      <ExchPill exch={h.exch} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-on-surface-variant">{h.name}</td>
                  <td colSpan={4} className="text-center text-xs text-on-surface-variant italic">hidden</td>
                  <td className="px-6 py-3 text-center">
                    <button onClick={() => restoreTicker(h.eodhd)} className="text-primary hover:underline text-xs font-bold">Restore</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-6 py-4 bg-surface-container-low flex justify-between items-center text-xs text-on-surface-variant">
            <div>Showing <span className="text-on-surface font-bold">{sorted.length}</span> of <span className="text-on-surface font-bold">{activeRows.length}</span> active{deleted.size > 0 && ` · ${deleted.size} hidden`}</div>
            {loading && <span className="text-primary animate-pulse">Refreshing…</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
