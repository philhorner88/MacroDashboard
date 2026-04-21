import { useState } from 'react'
import ExchPill from './ExchPill'
import { fmtCcy, fmt, fmtPct } from '../utils'

const PASSIVE_CATEGORIES = {
  'XGOV.AU': 'Government Bond',
  'GHLD.AU': 'Gold',
  'TLT.US':  'US Treasury',
  'IEI.US':  'US Treasury',
  'BND.US':  'Bond Index',
  'AGG.US':  'Bond Index',
  'VGSH.US': 'Short Treasury',
  'GGOV.AU': 'Government Bond',
  'IAF.AU':  'Bond Index',
  'IDEF.US': 'Defined Outcome',
  'QQQM.US': 'Equity Index',
  'LQD.US':  'Corp Bond',
  'SHYG.US': 'High Yield Bond',
  'AOA.US':  'Multi-Asset',
  'IHAK.US': 'Thematic ETF',
  'IAU.US':  'Gold',
  'VCRB.US': 'Bond Index',
  'VT.US':   'Equity Index',
}

function pctColor(v) {
  if (v == null || isNaN(v)) return 'text-on-surface-variant'
  return v > 0 ? 'text-secondary' : v < 0 ? 'text-error' : 'text-on-surface-variant'
}

export default function PassiveTab({ portfolio, totalValue, prices, loading }) {
  const passive = portfolio.filter(h => h.passive)
  const active  = portfolio.filter(h => !h.passive)

  const passiveTotal = passive.reduce((s, h) => s + h.value, 0)
  const activeTotal  = active.reduce((s, h) => s + h.value, 0)
  const grandTotal   = passiveTotal + activeTotal

  const byCategory = {}
  passive.forEach(h => {
    const cat = PASSIVE_CATEGORIES[h.eodhd] || 'Other'
    if (!byCategory[cat]) byCategory[cat] = []
    byCategory[cat].push(h)
  })

  const passiveWithPrices = passive.filter(h => prices[h.eodhd]?.ok && prices[h.eodhd]?.pct != null)
  const passiveDayPct = passiveWithPrices.length && passiveTotal > 0
    ? passiveWithPrices.reduce((s, h) => {
        const pct = parseFloat(prices[h.eodhd]?.pct)
        return s + (isFinite(pct) ? pct * (h.value / passiveTotal) : 0)
      }, 0)
    : null

  return (
    <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-6 pb-24">
      <div className="mb-6">
        <h2 className="text-2xl md:text-3xl font-black tracking-tight">Passive Holdings</h2>
        <p className="text-sm text-on-surface-variant mt-1">ETFs, bonds, and index funds</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <div className="bg-surface-container p-4 md:p-6 rounded-lg col-span-2 md:col-span-1 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-[#B76DFF]"></div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Passive Total</p>
          <h3 className="text-2xl font-extrabold tabular">{fmtCcy(passiveTotal)}</h3>
          <p className={`text-xs mt-1 font-bold ${pctColor(passiveDayPct)}`}>
            {passiveDayPct != null ? fmtPct(passiveDayPct) + ' today' : loading ? 'Loading…' : 'No prices'}
          </p>
        </div>
        <div className="bg-surface-container p-4 md:p-6 rounded-lg">
          <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Of Portfolio</p>
          <h3 className="text-2xl font-extrabold tabular">{fmt(grandTotal ? passiveTotal / grandTotal * 100 : 0, 1)}%</h3>
          <p className="text-xs text-on-surface-variant mt-1">{passive.length} holdings</p>
        </div>
        <div className="bg-surface-container p-4 md:p-6 rounded-lg">
          <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Active Total</p>
          <h3 className="text-2xl font-extrabold tabular">{fmtCcy(activeTotal)}</h3>
          <p className="text-xs text-on-surface-variant mt-1">{active.length} holdings</p>
        </div>
        <div className="bg-surface-container p-4 md:p-6 rounded-lg">
          <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Grand Total</p>
          <h3 className="text-2xl font-extrabold tabular">{fmtCcy(grandTotal)}</h3>
          <p className="text-xs text-on-surface-variant mt-1">All holdings</p>
        </div>
      </div>
      <div className="bg-surface-container rounded-lg p-4 md:p-6 mb-8">
        <div className="flex justify-between text-xs font-bold text-on-surface-variant mb-2">
          <span>Active {fmt(grandTotal ? activeTotal/grandTotal*100 : 0, 1)}%</span>
          <span>Passive {fmt(grandTotal ? passiveTotal/grandTotal*100 : 0, 1)}%</span>
        </div>
        <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
          <div className="bg-primary rounded-full transition-all" style={{ width: `${grandTotal ? activeTotal/grandTotal*100 : 0}%` }}></div>
          <div className="bg-[#B76DFF] transition-all rounded-full" style={{ width: `${grandTotal ? passiveTotal/grandTotal*100 : 0}%` }}></div>
        </div>
        <div className="flex gap-4 mt-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-primary"></div>
            <span className="text-xs text-on-surface-variant">Active equities</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#B76DFF]"></div>
            <span className="text-xs text-on-surface-variant">Passive ETFs</span>
          </div>
        </div>
      </div>
      <div className="space-y-4">
        {Object.entries(byCategory).map(([cat, holdings]) => {
          const catTotal = holdings.reduce((s, h) => s + h.value, 0)
          return (
            <div key={cat} className="bg-surface-container rounded-lg overflow-hidden">
              <div className="px-4 md:px-6 py-4 border-b border-outline-variant/10 flex items-center justify-between">
                <span className="px-2 py-0.5 bg-[#B76DFF]/10 text-[#B76DFF] text-[10px] font-bold uppercase rounded-sm">{cat}</span>
                <span className="text-sm font-bold tabular">{fmtCcy(catTotal)}</span>
              </div>
              <div>
                {holdings.map(h => {
                  const p = prices[h.eodhd]
                  const pctNum = p?.ok ? parseFloat(p.pct) : null
                  const hasPct = pctNum != null && isFinite(pctNum)
                  return (
                    <div key={h.eodhd} className="flex items-center px-4 md:px-6 py-4 border-b border-outline-variant/10 last:border-0 hover:bg-surface-container-high transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-primary">{h.eodhd.split('.')[0]}</span>
                          <ExchPill exch={h.exch} />
                        </div>
                        <span className="text-xs text-on-surface-variant truncate block">{h.name}</span>
                      </div>
                      <div className="flex flex-col items-end ml-4">
                        <span className="font-bold tabular">{fmtCcy(h.value)}</span>
                        <span className="text-xs text-on-surface-variant tabular">
                          {fmt(passiveTotal ? h.value/passiveTotal*100 : 0, 1)}% of passive
                        </span>
                      </div>
                      <div className="ml-4 flex-shrink-0 text-right min-w-[60px]">
                        {hasPct ? (
                          <span className={`text-sm font-bold tabular ${pctColor(pctNum)}`}>{fmtPct(pctNum)}</span>
                        ) : (
                          <span className="text-xs text-on-surface-variant/50">—</span>
                        )}
                        {p?.close != null && (
                          <span className="text-xs text-on-surface-variant tabular block">{fmt(p.close)}</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
        {passive.length === 0 && (
          <div className="bg-surface-container rounded-lg p-12 text-center text-on-surface-variant">
            <span className="material-symbols-outlined text-4xl block mb-2 opacity-20">account_balance</span>
            <p className="text-sm">No passive holdings in your portfolio.</p>
          </div>
        )}
      </div>
    </div>
  )
}
