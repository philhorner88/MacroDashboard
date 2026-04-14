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
    positive: { cls: 'bg-secondary/10 border-secondary/20 text-secondary',              label: '↑ Positive' },
    negative: { cls: 'bg-error/10 border-error/20 text-error',                          label: '↓ Negative' },
    neutral:  { cls: 'bg-outline-variant/20 border-outline-variant/20 text-on-surface-variant', label: '→ Neutral' },
  }
  const s = map[p] || map.neutral
  return <span className={`px-2 py-0.5 text-[9px] font-black uppercase rounded-sm border ${s.cls}`}>{s.label}</span>
}

export default function NewsTab({ portfolio }) {
  const TOP_TICKERS = portfolio.slice().sort((a, b) => b.value - a.value).slice(0, 10).map(h => h.eodhd)
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
    <div className="max-w-[1440px] mx-auto px-4 md:px-6 py-6 md:py-10 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl md:text-4xl font-black tracking-tight">News</h2>
        <button onClick={load} className="flex items-center gap-1.5 bg-surface-container-high px-3 py-2 text-xs font-bold text-on-surface-variant hover:bg-surface-variant transition-colors rounded">
          <span className="material-symbols-outlined text-sm">refresh</span>
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* Filter chips — horizontal scroll on mobile */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-6">
        {[['all','Top 10'], ...TOP_TICKERS.map((t, i) => [t, SHORT[i]])].map(([val, label]) => (
          <button key={val} onClick={() => setTicker(val)}
            className={`px-4 py-2 rounded-sm font-bold text-xs uppercase tracking-widest flex-shrink-0 transition-all ${
              ticker === val
                ? 'bg-primary-container text-on-primary-container'
                : 'bg-surface-container border border-outline-variant/10 text-on-surface-variant'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20 text-on-surface-variant">
          <span className="material-symbols-outlined animate-spin text-3xl mr-3">progress_activity</span>Loading…
        </div>
      )}
      {error && <div className="text-center py-12 text-error text-sm">{error}</div>}
      {!loading && !error && news.length === 0 && (
        <div className="text-center py-12 text-on-surface-variant text-sm">No news for this selection.</div>
      )}

      {/* Mobile: stacked article cards */}
      {!loading && news.length > 0 && (
        <>
          {/* Mobile list */}
          <div className="md:hidden space-y-2">
            {news.map((a, i) => (
              <a key={i} href={a.link || a.url || '#'} target="_blank" rel="noopener noreferrer"
                className="block bg-surface-container active:bg-surface-container-high transition-colors p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-primary uppercase">{a.source || 'News'}</span>
                    <span className="text-[10px] text-on-surface-variant">{a.date ? timeAgo(a.date) : ''}</span>
                  </div>
                  <SentimentBadge sentiment={a.sentiment} />
                </div>
                <p className="text-sm font-bold leading-snug text-on-surface line-clamp-3">{a.title}</p>
                {a.symbols?.length > 0 && (
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {a.symbols.slice(0, 3).map((s, j) => (
                      <span key={j} className="px-1.5 py-0.5 bg-surface-container-highest text-on-surface-variant text-[9px] font-mono border border-outline-variant/10 rounded">
                        {s.split('.')[0]}
                      </span>
                    ))}
                  </div>
                )}
              </a>
            ))}
          </div>

          {/* Desktop grid */}
          <div className="hidden md:grid grid-cols-2 gap-px bg-outline-variant/10 border border-outline-variant/10 overflow-hidden">
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
        </>
      )}
    </div>
  )
}
