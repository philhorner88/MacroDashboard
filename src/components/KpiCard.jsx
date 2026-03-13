export default function KpiCard({ label, value, sub, subColor, bg, border }) {
  return (
    <div style={{ background: bg || '#fff', border: `1px solid ${border || '#e2e8f0'}`, borderRadius: 12, padding: '16px 20px' }}>
      <div style={{ fontSize: 11, color: '#718096', marginBottom: 5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color: '#1a202c', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: subColor || '#a0aec0', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}
