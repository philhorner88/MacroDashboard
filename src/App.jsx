import { useState, useEffect, useCallback } from 'react'
import OverviewTab        from './components/OverviewTab'
import ExposureTab        from './components/ExposureTab'
import HoldingsTab        from './components/HoldingsTab'
import NewsTab            from './components/NewsTab'
import PerformanceTab     from './components/PerformanceTab'
import SessionWrapTab     from './components/SessionWrapTab'
import SharesightImporter from './components/SharesightImporter'
import PassiveTab        from './components/PassiveTab'
import { PORTFOLIO as DEFAULT_PORTFOLIO, TOTAL_PORTFOLIO as DEFAULT_TOTAL } from './data/portfolio'
import { fetchAllPrices } from './data/api'

const TABS = [
  { id: 'overview',    label: 'Overview',    icon: 'dashboard'             },
  { id: 'exposure',    label: 'Exposure',    icon: 'pie_chart'             },
  { id: 'holdings',    label: 'Holdings',    icon: 'account_balance_wallet'},
  { id: 'passive',     label: 'Passive',     icon: 'account_balance'       },
  { id: 'news',        label: 'News',        icon: 'article'               },
  { id: 'performance', label: 'Performance', icon: 'monitoring'            },
  { id: 'wrap',        label: 'Session',     icon: 'flag'                  },
]

const SK_DELETED   = 'deleted_tickers'
const SK_PORTFOLIO = 'sharesight_portfolio'
const SK_TOTAL     = 'sharesight_total'
const SK_DATE      = 'sharesight_snapshot_date'

const TODAY = new Date().toLocaleDateString('en-AU', {
  weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
})

function lsGet(key) { try { return localStorage.getItem(key) } catch { return null } }
function lsSet(key, val) { try { localStorage.setItem(key, val) } catch {} }

function loadPortfolio() {
  const s = lsGet(SK_PORTFOLIO)
  if (s) try { return JSON.parse(s) } catch {}
  return null
}

export default function App() {
  const stored = loadPortfolio()

  const [tab,        setTab]       = useState('overview')
  const [prices,     setPrices]    = useState({})
  const [loading,    setLoading]   = useState(true)
  const [lastFetch,  setLastFetch] = useState(null)
  const [showImport, setShowImport]= useState(false)

  const [portfolio,  setPortfolio] = useState(() => stored || DEFAULT_PORTFOLIO)
  const [totalValue, setTotalValue]= useState(() => { const s = lsGet(SK_TOTAL); return s ? parseFloat(s) : DEFAULT_TOTAL })
  const [snapDate,   setSnapDate]  = useState(() => lsGet(SK_DATE))

  const [deleted, setDeleted] = useState(() => {
    const s = lsGet(SK_DELETED)
    try { return new Set(JSON.parse(s || '[]')) } catch { return new Set() }
  })

  useEffect(() => { lsSet(SK_DELETED, JSON.stringify([...deleted])) }, [deleted])

  const deleteTicker  = (t) => setDeleted(prev => new Set([...prev, t]))
  const restoreTicker = (t) => setDeleted(prev => { const s = new Set(prev); s.delete(t); return s })
  const restoreAll    = ()  => setDeleted(new Set())

  const handleImport = useCallback((holdings, total, snapshotDate) => {
    setPortfolio(holdings)
    setTotalValue(total)
    setSnapDate(snapshotDate || null)
    setDeleted(new Set())
    setPrices({})
    setLoading(true)
    lsSet(SK_PORTFOLIO, JSON.stringify(holdings))
    lsSet(SK_TOTAL, String(total))
    lsSet(SK_DATE, snapshotDate || '')
  }, [])

  const loadPrices = useCallback(async () => {
    setLoading(true)
    try {
      const tickers = portfolio.map(h => h.eodhd)
      const result  = await fetchAllPrices(tickers)
      setPrices(result)
      setLastFetch(new Date().toLocaleTimeString('en-AU'))
    } catch (err) {
      console.error('Price fetch error', err)
    } finally {
      setLoading(false)
    }
  }, [portfolio])

  useEffect(() => { loadPrices() }, [loadPrices])

  const loaded      = Object.values(prices).filter(p => p?.ok).length
  const total       = portfolio.length
  const deletedProps = { deleted, deleteTicker, restoreTicker, restoreAll }
  const portfolioProps = { portfolio, totalValue }

  return (
    <div className="min-h-screen bg-background text-on-surface font-sans">

      {showImport && (
        <SharesightImporter
          onImport={handleImport}
          onClose={() => setShowImport(false)}
          currentPortfolio={portfolio}
        />
      )}

      {/* ── Header ── */}
      <header className="bg-surface sticky top-0 z-40 border-b border-outline-variant/15">
        <div className="flex justify-between items-center px-4 md:px-6 py-3 md:py-4">
          {/* Brand */}
          <div className="flex items-center gap-2 md:gap-3">
            <span className="material-symbols-outlined text-[#4F8EF7] text-xl">signal_cellular_alt</span>
            <h1 className="text-base md:text-xl font-black bg-gradient-to-br from-primary to-primary-container bg-clip-text text-transparent tracking-tight">
              Ultimate Wealth
            </h1>
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-0.5 ml-4">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-2 text-sm transition-colors whitespace-nowrap ${
                  tab === t.id
                    ? 'text-primary border-b-2 border-primary font-bold'
                    : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface font-medium'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-2 md:gap-3">
            {/* ShareSight import */}
            <button
              onClick={() => setShowImport(true)}
              className="hidden md:flex items-center gap-2 border border-outline-variant/25 hover:border-primary/40 bg-surface-container-low hover:bg-surface-container px-3 py-1.5 rounded text-xs transition-all group"
            >
              <span className="material-symbols-outlined text-sm text-on-surface-variant group-hover:text-primary transition-colors">upload_file</span>
              <span className="text-on-surface-variant group-hover:text-on-surface transition-colors">
                {snapDate ? `ShareSight · ${snapDate}` : 'Import ShareSight'}
              </span>
            </button>

            {/* Status — mobile shows loaded count only */}
            {lastFetch && (
              <span className="text-[10px] text-on-surface-variant tabular hidden sm:block">
                {loaded}/{total}
              </span>
            )}

            {/* Refresh */}
            <button
              onClick={loadPrices}
              className="flex items-center gap-1.5 bg-surface-container-high hover:bg-surface-variant px-3 py-2 text-xs font-bold text-on-surface-variant transition-colors rounded"
            >
              <span className="material-symbols-outlined text-sm">refresh</span>
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {/* Mobile import icon */}
            <button onClick={() => setShowImport(true)} className="md:hidden text-on-surface-variant hover:text-primary transition-colors p-1">
              <span className="material-symbols-outlined text-xl">upload_file</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Content ── */}
      <main className="pb-20 md:pb-0">
        {tab === 'overview'    && <OverviewTab    {...portfolioProps} {...deletedProps} prices={prices} loading={loading} today={TODAY} />}
        {tab === 'exposure'    && <ExposureTab    {...portfolioProps} {...deletedProps} prices={prices} loading={loading} />}
        {tab === 'holdings'    && <HoldingsTab    {...portfolioProps} {...deletedProps} prices={prices} loading={loading} />}
        {tab === 'passive'     && <PassiveTab     {...portfolioProps} prices={prices} loading={loading} />}
        {tab === 'news'        && <NewsTab        {...portfolioProps} />}
        {tab === 'performance' && <PerformanceTab {...portfolioProps} prices={prices} />}
        {tab === 'wrap'        && <SessionWrapTab {...portfolioProps} {...deletedProps} prices={prices} loading={loading} />}
      </main>

      {/* ── Footer (desktop only) ── */}
      <footer className="hidden md:block w-full py-5 px-6 text-center bg-surface-container-lowest">
        <p className="text-xs font-light text-on-surface-variant">
          Data via EODHD · Prices are intraday · {TODAY}
          {snapDate && ` · ShareSight snapshot ${snapDate}`}
        </p>
      </footer>

      {/* ── Mobile bottom nav ── */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full z-40 bg-surface border-t border-outline-variant/15 pb-safe">
        <div className="flex justify-around items-center pt-2 pb-1">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 transition-colors min-w-0 flex-1 ${
                tab === t.id ? 'text-primary' : 'text-on-surface-variant'
              }`}
            >
              <span
                className="material-symbols-outlined text-[22px]"
                style={{ fontVariationSettings: tab === t.id ? "'FILL' 1" : "'FILL' 0" }}
              >
                {t.icon}
              </span>
              <span className="text-[9px] font-bold tracking-wide uppercase truncate w-full text-center">
                {t.label}
              </span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
