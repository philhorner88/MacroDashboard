import { useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import ExchPill from './ExchPill'
import { fmtCcy, fmt } from '../utils'

const COLORS = ['#acc7ff','#508ff8','#b76dff','#4edea3','#6900b3','#dd6b20','#319795','#d53f8c','#2b6cb0','#276749','#744210','#9b2335','#553c9a','#c05621']
const STR_COLS = new Set(['eodhd','name'])

function safeSort(a, b, col, dir) {
  if (STR_COLS.has(col)) {
    const as = String(a[col]??''), bs = String(b[col]??'')
    return dir === 'asc' ? as.localeCompare(bs) : bs.localeCompare(as)
  }
  const an = parseFloat(a[col]), bn = parseFloat(b[col])
  const aOk = isFinite(an), bOk = isFinite(bn)
  if (!aOk && !bOk) return 0; if (!aOk) return 1; if (!bOk) return -1
  return dir === 'asc' ? an - bn : bn - an
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-surface-container-highest border border-outline-variant/20 p-3 rounded-lg shadow-xl text-xs">
      <p className="font-bold text-on-surface-variant mb-1">{d.name}</p>
      <p className="text-base font-black tabular text-on-surface">{fmtCcy(d.value)}</p>
      <p className="text-primary mt-1">{fmt(d.pct, 1)}%</p>
    </div>
  )
}

export default function ExposureTab({ prices, portfolio, totalValue, deleted }) {
  const [sortCol, setSortCol] = useState('value')
  const [sortDir, setSortDir] = useState('desc')

  const active      = portfolio.filter(h => !deleted.has(h.eodhd))
  const activeTotal = active.reduce((s, h) => s + h.value, 0)
  const byValue     = [...active].sort((a, b) => b.value - a.value)
  const top14       = byValue.slice(0, 14)
  const rest        = byValue.slice(14)
  const othersVal   = rest.reduce((s, r) => s + r.value, 0)

  const pieData = [
    ...top14.map(r => ({ name: r.name, code: r.eodhd, value: r.value, pct: activeTotal ? r.value / activeTotal * 100 : 0 })),
    ...(othersVal > 0 ? [{ name: `Others (${rest.length})`, code: '', value: othersVal, pct: activeTotal ? othersVal / activeTotal * 100 : 0 }] : [])
  ]

  const tableData = [...active].map(h => ({ ...h, pct: activeTotal ? h.value / activeTotal * 100 : 0 }))
  const sorted    = [...tableData].sort((a, b) => safeSort(a, b, sortCol, sortDir))
  const largest   = byValue[0]
  const largestPct = largest && activeTotal ? largest.value / activeTotal * 100 : 0

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('desc') }
  }

  const thCls = "px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest cursor-pointer hover:text-on-surface select-none"

  return (
    <div className="max-w-[1440px] mx-auto px-4 md:px-6 py-6 md:py-10 pb-24 space-y-6 md:space-y-8">

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 md:gap-6">
        <div className="bg-surface-container p-4 md:p-6 rounded-sm border-t-4 border-primary">
          <span className="text-[9px] md:text-[10px] font-bold tracking-widest text-on-surface-variant uppercase block mb-2">Total</span>
          <span className="text-lg md:text-3xl font-bold tracking-tight tabular">{fmtCcy(activeTotal)}</span>
        </div>
        <div className="bg-surface-container p-4 md:p-6 rounded-sm">
          <span className="text-[9px] md:text-[10px] font-bold tracking-widest text-on-surface-variant uppercase block mb-2">Holdings</span>
          <span className="text-lg md:text-3xl font-bold tabular">{active.length}</span>
        </div>
        <div className="bg-surface-container p-4 md:p-6 rounded-sm">
          <span className="text-[9px] md:text-[10px] font-bold tracking-widest text-on-surface-variant uppercase block mb-2">Largest</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg md:text-3xl font-bold tabular">{fmt(largestPct, 1)}%</span>
            {largest && <span className="text-primary text-xs font-medium hidden sm:inline">{largest.eodhd.split('.')[0]}</span>}
          </div>
        </div>
      </div>

      {/* Chart + table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 items-start">
        {/* Pie */}
        <div className="lg:col-span-5 bg-surface-container-low p-5 md:p-8 rounded-sm">
          <h2 className="text-base md:text-lg font-bold mb-1">Allocation</h2>
          <p className="text-xs text-on-surface-variant mb-4">Top {top14.length} holdings by value</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={2} dataKey="value">
                {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 grid grid-cols-2 gap-y-2 gap-x-3">
            {pieData.slice(0, 8).map((d, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                  <span className="text-xs text-on-surface-variant truncate max-w-[70px]">{d.code?.split('.')[0] || 'Others'}</span>
                </div>
                <span className="text-xs font-bold tabular">{fmt(d.pct, 1)}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="lg:col-span-7 bg-surface-container overflow-hidden rounded-sm">
          <div className="p-4 md:p-6 border-b border-outline-variant/10">
            <h2 className="text-base md:text-lg font-bold">Full Ledger</h2>
          </div>

          {/* Mobile: simplified list */}
          <div className="md:hidden max-h-[400px] overflow-y-auto">
            {sorted.map((h, i) => {
              const colorIdx = byValue.findIndex(b => b.eodhd === h.eodhd)
              const swatch   = colorIdx < 14 ? COLORS[colorIdx] : '#424753'
              return (
                <div key={h.eodhd} className="flex items-center px-4 py-3 border-b border-outline-variant/10 last:border-0">
                  <div className="w-1.5 h-5 rounded-full flex-shrink-0 mr-3" style={{ backgroundColor: swatch }}></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-sm text-primary">{h.eodhd.split('.')[0]}</span>
                      <ExchPill exch={h.exch} />
                    </div>
                    <span className="text-xs text-on-surface-variant truncate block">{h.name}</span>
                  </div>
                  <div className="flex flex-col items-end ml-3 flex-shrink-0">
                    <span className="text-sm font-semibold tabular">{fmtCcy(h.value)}</span>
                    <span className="text-xs text-primary tabular">{fmt(h.pct, 1)}%</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Desktop: full table */}
          <div className="hidden md:block overflow-x-auto max-h-[520px] overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-surface-container-low sticky top-0">
                <tr>
                  <th className={thCls} onClick={() => toggleSort('eodhd')}>Ticker</th>
                  <th className={thCls} onClick={() => toggleSort('name')}>Name</th>
                  <th className={`${thCls} text-right`} onClick={() => toggleSort('value')}>Value</th>
                  <th className={`${thCls} text-right`} onClick={() => toggleSort('pct')}>Weight</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/5">
                {sorted.map((h, i) => {
                  const colorIdx = byValue.findIndex(b => b.eodhd === h.eodhd)
                  const swatch   = colorIdx < 14 ? COLORS[colorIdx] : '#424753'
                  return (
                    <tr key={h.eodhd} className="hover:bg-surface-container-high transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-5 rounded-full flex-shrink-0" style={{ backgroundColor: swatch }}></div>
                          <span className="font-bold text-primary">{h.eodhd.split('.')[0]}</span>
                          <ExchPill exch={h.exch} />
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-on-surface truncate max-w-[200px]">{h.name}</td>
                      <td className="px-6 py-4 text-right tabular text-sm font-semibold">{fmtCcy(h.value)}</td>
                      <td className="px-6 py-4 text-right">
                        <span className="px-2 py-1 bg-primary-container/10 text-primary text-[11px] font-bold rounded-sm tabular">{fmt(h.pct, 1)}%</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
