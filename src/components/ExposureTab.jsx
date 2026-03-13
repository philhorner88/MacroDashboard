import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import ExchPill from './ExchPill'
import { fmtCcy, fmt } from '../utils'
import { PORTFOLIO, TOTAL_PORTFOLIO } from '../data/portfolio'

const COLORS = [
  '#3182ce','#38a169','#d69e2e','#e53e3e','#805ad5',
  '#dd6b20','#319795','#d53f8c','#2b6cb0','#276749',
  '#744210','#9b2335','#553c9a','#c05621','#285e61',
]

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{
      background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
      padding: '10px 14px', fontSize: 12, boxShadow: '0 2px 12px rgba(0,0,0,.1)'
    }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{d.name}</div>
      <div style={{ color: '#718096', fontSize: 11 }}>{d.code}</div>
      <div style={{ fontWeight: 700, fontSize: 16, margin: '4px 0' }}>{fmtCcy(d.value)}</div>
      <div style={{ color: '#3182ce' }}>{fmt(d.pct)}% of portfolio</div>
    </div>
  )
}

const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, pct }) => {
  if (pct < 2.5) return null
  const R = innerRadius + (outerRadius - innerRadius) * 0.5
  const rad = (midAngle * Math.PI) / 180
  return (
    <text
      x={cx + R * Math.cos(-rad)}
      y={cy + R * Math.sin(-rad)}
      textAnchor="middle" dominantBaseline="middle"
      fill="#fff" fontSize={11} fontWeight={700}
    >
      {fmt(pct, 1)}%
    </text>
  )
}

export default function ExposureTab() {
  // Sort by value descending; top 14 get individual slices, rest = "Others"
  const sorted = [...PORTFOLIO].sort((a, b) => b.value - a.value)
  const top    = sorted.slice(0, 14)
  const rest   = sorted.slice(14)
  const othersValue = rest.reduce((s, r) => s + r.value, 0)

  const pieData = [
    ...top.map(r => ({ name: r.name, code: r.eodhd, value: r.value, pct: (r.value / TOTAL_PORTFOLIO) * 100 })),
    ...(othersValue > 0 ? [{ name: `Others (${rest.length})`, code: '', value: othersValue, pct: (othersValue / TOTAL_PORTFOLIO) * 100 }] : []),
  ]

  return (
    <>
      {/* Summary KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Total Portfolio', value: fmtCcy(TOTAL_PORTFOLIO), bg: '#ebf8ff', border: '#bee3f8' },
          { label: 'Direct Holdings', value: PORTFOLIO.length, bg: '#f0fff4', border: '#c6f6d5' },
          { label: 'Largest Holding', value: `${fmt(sorted[0]?.pct, 1)}%`, sub: sorted[0]?.name, bg: '#fffaf0', border: '#fbd38d' },
        ].map(k => (
          <div key={k.label} className="card" style={{ background: k.bg, border: `1px solid ${k.border}`, padding: '14px 18px' }}>
            <div style={{ fontSize: 11, color: '#718096', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#2d3748' }}>{k.value}</div>
            {k.sub && <div style={{ fontSize: 11, color: '#718096', marginTop: 2 }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: 16 }}>
        {/* Pie chart */}
        <div className="card">
          <div style={{ fontSize: 14, fontWeight: 700, color: '#4a5568', marginBottom: 4 }}>Top Holdings by Value</div>
          <div style={{ fontSize: 11, color: '#a0aec0', marginBottom: 16 }}>Portfolio snapshot · 13 Mar 2026</div>
          <ResponsiveContainer width="100%" height={340}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%" cy="50%"
                outerRadius={130}
                dataKey="value"
                labelLine={false}
                label={renderCustomLabel}
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                formatter={(v) => <span style={{ fontSize: 11, color: '#4a5568' }}>{v}</span>}
                iconSize={10}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Top 20 table */}
        <div className="card" style={{ overflowY: 'auto', maxHeight: 440 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#4a5568', marginBottom: 12 }}>All Holdings by Weight</div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Holding</th>
                <th className="num">Value</th>
                <th className="num">Weight</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => (
                <tr key={r.eodhd}>
                  <td style={{ color: '#cbd5e1', fontSize: 11 }}>{i + 1}</td>
                  <td>
                    <div style={{ fontWeight: 700, fontSize: 12 }}>{r.eodhd} <ExchPill exch={r.exch} /></div>
                    <div style={{ fontSize: 10, color: '#a0aec0' }}>{r.name}</div>
                  </td>
                  <td className="num" style={{ fontSize: 12 }}>{fmtCcy(r.value)}</td>
                  <td className="num">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                      <div style={{
                        width: 40, height: 6, borderRadius: 3, background: '#edf2f7', overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${Math.min(100, (r.value / sorted[0].value) * 100)}%`,
                          height: '100%', background: COLORS[i % COLORS.length], borderRadius: 3
                        }} />
                      </div>
                      <span style={{ fontSize: 11, color: '#4a5568', fontWeight: 600 }}>
                        {fmt((r.value / TOTAL_PORTFOLIO) * 100, 1)}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
