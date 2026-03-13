import { useState } from 'react'
import ExchPill from './ExchPill'
import { fmtCcy, fmt } from '../utils'
import { PORTFOLIO, TOTAL_PORTFOLIO } from '../data/portfolio'

const COLS = [
  { key: 'eodhd',  label: 'Ticker',   num: false },
  { key: 'name',   label: 'Name',     num: false },
  { key: 'value',  label: 'Value',    num: true  },
  { key: 'weight', label: 'Weight',   num: true  },
  { key: 'close',  label: 'Close',    num: true  },
  { key: 'pct',    label: '% Today',  num: true  },
]

function safeSort(a, b, col, dir) {
  const av = a[col]
  const bv = b[col]
  const aOk = av != null && av !== '' && !Number.isNaN(av)
  const bOk = bv != null && bv !== '' && !Number.isNaN(bv)
  if (!aOk && !bOk) return 0
  if (!aOk) return 1
  if (!bOk) return -1
  if (typeof av === 'string') return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
  return dir === 'asc' ? av - bv : bv - av
}

export default function HoldingsTab({ prices, loading }) {
  const [sortCol,    setSortCol]    = useState('value')
  const [sortDir,    setSortDir]    = useState('desc')
  const [filter,     setFilter]     = useState('')
  const [exchFilter, setExchFilter] = useState('All')

  const rows = PORTFOLIO.map(h => ({
    ...h,
    weight: (h.value / TOTAL_PORTFOLIO) * 100,
    ...(prices[h.eodhd] || {}),
  }))

  const exchanges = ['All', ...Array.from(new Set(PORTFOLIO.map(h => h.exch))).sort()]

  const filtered = rows.filter(r => {
    const q = filter.toLowerCase()
    const matchText = !q || r.eodhd.toLowerCase().includes(q) || r.name.toLowerCase().includes(q)
    const matchExch = exchFilter === 'All' || r.exch === exchFilter
    return matchText && matchExch
  })

  const sorted = [...filtered].sort((a, b) => safeSort(a, b, sortCol, sortDir))

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('desc') }
  }

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return <span style={{ color: '#cbd5e1' }}>⇅</span>
    return <span style={{ color: '#3182ce' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          placeholder="🔍  Search ticker or name…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          style={{
            flex: 1, minWidth: 200, padding: '8px 14px', borderRadius: 8,
            border: '1px solid #e2e8f0', fontSize: 13, outline: 'none',
            background: '#f7fafc', color: '#2d3748'
          }}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          {exchanges.map(ex => (
            <button key={ex} onClick={() => setExchFilter(ex)} style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
              border: exchFilter === ex ? 'none' : '1px solid #e2e8f0',
              background: exchFilter === ex ? '#3182ce' : '#fff',
              color: exchFilter === ex ? '#fff' : '#4a5568', cursor: 'pointer',
            }}>
              {ex}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 12, color: '#a0aec0', marginLeft: 'auto' }}>
          {sorted.length} of {PORTFOLIO.length} holdings
          {loading && <span style={{ marginLeft: 8, color: '#3182ce' }}>· loading prices…</span>}
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ paddingLeft: 16 }}>#</th>
              {COLS.map(c => (
                <th key={c.key} className={c.num ? 'num' : ''} onClick={() => toggleSort(c.key)}
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                  {c.label} <SortIcon col={c.key} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={r.eodhd}>
                <td style={{ color: '#cbd5e1', fontSize: 11, paddingLeft: 16 }}>{i + 1}</td>
                <td>
                  <span style={{ fontWeight: 700, fontSize: 12 }}>{r.eodhd}</span>
                  {' '}<ExchPill exch={r.exch} />
                </td>
                <td style={{ fontSize: 12, color: '#4a5568', maxWidth: 200 }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                </td>
                <td className="num" style={{ fontSize: 12, fontWeight: 600 }}>{fmtCcy(r.value)}</td>
                <td className="num" style={{ fontSize: 12 }}>
                  <span style={{ color: '#a0aec0' }}>{fmt(r.weight, 1)}%</span>
                </td>
                <td className="num" style={{ fontSize: 12 }}>
                  {r.close != null ? fmt(r.close) : <span style={{ color: '#cbd5e1' }}>—</span>}
                </td>
                <td className="num">
                  {r.ok ? (
                    <span style={{ fontWeight: 700, fontSize: 13 }}
                      className={r.pct > 0 ? 'green' : r.pct < 0 ? 'red' : 'grey'}>
                      {r.pct > 0 ? '+' : ''}{fmt(r.pct)}%
                    </span>
                  ) : (
                    <span style={{ color: '#cbd5e1', fontSize: 12 }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
