import { useState, useEffect, useCallback } from 'react'
import { PORTFOLIO } from '../data/portfolio'

const TOP_TICKERS = PORTFOLIO.sort((a, b) => b.value - a.value).slice(0, 10).map(h => h.eodhd)

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

function SentimentBadge({ sentiment }) {
  if (!sentiment) return null
  const p = sentiment.polarity || ''
  const map = { positive: ['#f0fff4','#38a169','↑'], negative: ['#fff5f5','#e53e3e','↓'], neutral: ['#f7fafc','#718096','–'] }
  const [bg, color, icon] = map[p] || map.neutral
  return <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:10, background:bg, color }}>{icon} {p}</span>
}

export default function NewsTab() {
  const [news, setNews] = useState([])
  const [loading, setLoading] = useState(true)
  const [ticker, setTicker] = useState('all')
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const t = ticker === 'all' ? TOP_TICKERS.join(',') : ticker
      const res = await fetch(`/api/news?t=${t}`)
      const data = await res.json()
      setNews(Array.isArray(data) ? data : [])
    } catch { setError('Could not load news.') }
    finally { setLoading(false) }
  }, [ticker])

  useEffect(() => { load() }, [load])

  return (
    <>
      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
        <span style={{ fontSize:13, fontWeight:700, color:'#4a5568' }}>Filter:</span>
        {['all', ...TOP_TICKERS].map(t => (
          <button key={t} onClick={() => setTicker(t)} style={{
            padding:'6px 14px', borderRadius:20, fontSize:12, fontWeight:600,
            border: ticker===t ? 'none' : '1px solid #e2e8f0',
            background: ticker===t ? '#3182ce' : '#fff',
            color: ticker===t ? '#fff' : '#4a5568', cursor:'pointer',
          }}>{t === 'all' ? 'Top 10' : t.split('.')[0]}</button>
        ))}
        <button onClick={load} disabled={loading} style={{ marginLeft:'auto', padding:'6px 14px', borderRadius:8, fontSize:12, fontWeight:600, border:'1px solid #e2e8f0', background:'#fff', color:'#3182ce', cursor:'pointer' }}>↺ Refresh</button>
      </div>
      {loading ? (
        <div style={{ textAlign:'center', padding:60, color:'#a0aec0' }}><div className="spinner" style={{ margin:'0 auto 12px' }} />Loading news…</div>
      ) : error ? (
        <div style={{ textAlign:'center', padding:40, color:'#e53e3e' }}>{error}</div>
      ) : news.length === 0 ? (
        <div style={{ textAlign:'center', padding:40, color:'#a0aec0' }}>No news found</div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {news.map((item, i) => (
            <a key={i} href={item.link} target="_blank" rel="noopener noreferrer" style={{ textDecoration:'none' }}>
              <div className="card" style={{ padding:'14px 18px', cursor:'pointer' }}>
                <div style={{ fontWeight:700, fontSize:14, color:'#2d3748', marginBottom:6, lineHeight:1.4 }}>{item.title}</div>
                <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                  <span style={{ fontSize:11, color:'#a0aec0' }}>{timeAgo(item.date)}</span>
                  {item.symbols?.slice(0,4).map(s => (
                    <span key={s} style={{ fontSize:10, fontWeight:700, padding:'1px 7px', borderRadius:10, background:'#ebf8ff', color:'#2b6cb0' }}>{s.split('.')[0]}</span>
                  ))}
                  <SentimentBadge sentiment={item.sentiment} />
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </>
  )
}
