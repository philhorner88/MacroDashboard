import { useState, useEffect, useCallback } from 'react'

function timeAgo(dateStr) {
  const diff  = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins  < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

function SentimentBadge({ sentiment }) {
  if (!sentiment) return null
  const p   = sentiment.polarity || ''
  const map = {
    positive: { cls: 'bg-secondary/10 border-secondary/20 text-secondary',              label: 'Positive' },
    negative: { cls: 'bg-error/10 border-error/20 text-error',                          label: 'Negative' },
    neutral:  { cls: 'bg-outline-variant/20 border-outline-variant/20 text-on-surface-variant', label: 'Neutral'  },
  }
  const s = map[p] || map.neutral
  return <span className={`px-2 py-1 text-[10px] font-black uppercase rounded-sm border ${s.cls}`}>{s.label}</span>
}

export default function NewsTab({ portfolio }) {
  const TOP_TICKERS = portfolio
    .slice().sort((a, b) => b.value - a.value)
    .slice(0, 10)
    .map(h => h.eodhd)
  const SHORT = TOP_TICKERS.map(t => t.split('.')[0])

  const [news,    setNews]    = useState([])
  const [loading, setLoading] = useState(true)
  const [ticker,  setTicker]  = useState('all')
  const [error,   setError]   = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const t   = ticker === 'all' ? TOP_TICKERS.join(',') : ticker
      const res = await fetch(`/api/news?s=${t}`)
      const d   = await res.json()
      setNews(Array.isArray(d) ? d : [])
    } catch { setError('Could not load news.') }
    finally { setLoading(false) }
  }, [ticker])

  useEffect(() => { load() }, [ticker])

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-10 pb-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold tracking-widest uppercase text-primary">Intelligence Feed</span>
            <div className="h-px w-10 bg-outline-variant/30"></div>
          </div>
          <h2 className="text-4xl font-black tracking-tight">Institutional News</h2>
          <p className="text-on-surface-variant mt-1 text-sm max-w-lg">Real-time sentiment curated for your portfolio.</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 bg-surface-container-high px-4 py-2 text-xs font-bold text-on-surface-variant hover:bg-surface-variant transition-colors rounded self-start">
          <span className="material-symbols-outlined text-sm">refresh</span>Refresh
        </button>
      </div>

      {/* Filter chips */}
      <section className="mb-8 flex flex-wrap gap-2">
        {[['all','Top 10'], ...TOP_TICKERS.map((t, i) => [t, SHORT[i]])].map(([val, label]) => (
          <button key={val} onClick={() => setTicker(val)}
            className={`px-5 py-2 rounded-sm font-bold text-xs uppercase tracking-widest transition-all ${ticker === val ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container border border-outline-variant/10 text-on-surface-variant hover:text-primary hover:bg-surface-container-high'}`}>
            {label}
          </button>
        ))}
      </section>

      {/* States */}
      {loading && (
        <div className="flex items-center justify-center py-24 text-on-surface-variant">
          <span className="material-symbols-outlined animate-spin text-3xl mr-3">progress_activity</span>Loading news…
        </div>
      )}
      {error && <div className="text-center py-12 text-error">{error}</div>}
      {!loading && !error && news.length === 0 && (
        <div className="text-center py-12 text-on-surface-variant text-sm">No news for this selection.</div>
      )}

      {/* Grid */}
      {!loading && news.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-outline-variant/10 border border-outline-variant/10 overflow-hidden">
          {news.map((a, i) => (
            <article key={i} className="bg-surface-container group hover:bg-surface-container-high transition-all p-8 flex flex-col justify-between min-h-[220px]">
              <div>
                <div className="flex justify-between items-start mb-5">
                  <div className="flex gap-1 flex-wrap">
                    {(a.symbols || []).slice(0, 3).map((s, j) => (
                      <span key={j} className="px-2 py-0.5 bg-surface-container-lowest text-on-surface-variant text-[10px] font-mono border border-outline-variant/10">
                        {s.split('.')[0]}
                      </span>
                    ))}
                  </div>
                  <SentimentBadge sentiment={a.sentiment} />
                </div>
                <a href={a.link || a.url || '#'} target="_blank" rel="noopener noreferrer"
                  className="text-xl font-bold leading-tight text-on-surface group-hover:text-primary transition-colors block mb-3">
                  {a.title}
                </a>
                {a.description && (
                  <p className="text-on-surface-variant text-sm leading-relaxed line-clamp-2">{a.description}</p>
                )}
              </div>
              <div className="flex items-center gap-3 mt-5">
                <div className="w-7 h-7 rounded-full bg-surface-container-highest flex items-center justify-center border border-outline-variant/20">
                  <span className="material-symbols-outlined text-primary text-xs">article</span>
                </div>
                <div>
                  <span className="text-xs font-bold text-on-surface block">{a.source || 'Market News'}</span>
                  <span className="text-[10px] text-on-surface-variant uppercase tracking-widest tabular">{a.date ? timeAgo(a.date) : ''}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
