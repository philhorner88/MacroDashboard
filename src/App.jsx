import { useState, useEffect, useCallback, useMemo } from 'react'
import OverviewTab        from './components/OverviewTab'
import ExposureTab        from './components/ExposureTab'
import HoldingsTab        from './components/HoldingsTab'
import NewsTab            from './components/NewsTab'
import PerformanceTab     from './components/PerformanceTab'
import SessionWrapTab     from './components/SessionWrapTab'
import PassiveTab         from './components/PassiveTab'
import SharesightImporter from './components/SharesightImporter'
import HsbcImporter       from './components/HsbcImporter'
import { PORTFOLIO as DEFAULT_PORTFOLIO } from './data/portfolio'
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

// Per-source overrides — each is a {ticker: holding} dict
const SK_OVERRIDES_SHARESIGHT = 'overrides_sharesight'
const SK_OVERRIDES_HSBC       = 'overrides_hsbc'
const SK_DELETED              = 'deleted_tickers'
const SK_DATE_SHARESIGHT      = 'sharesight_snapshot_date'
const SK_DATE_HSBC            = 'hsbc_snapshot_date'
const SK_FX_RATE              = 'hsbc_fx_rate'

const TODAY = new Date().toLocaleDateString('en-AU', {
  weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
})

function lsGet(key) { try { return localStorage.getItem(key) } catch { return null } }
function lsSet(key, val) { try { localStorage.setItem(key, val) } catch {} }
function lsGetJSON(key, fallback) {
  const s = lsGet(key)
  if (!s) return fallback
  try { return JSON.parse(s) } catch { return fallback }
}

// ─── Build merged portfolio ──────────────────────────────────────────────────
// Start with portfolio.js as base, then layer on per-source overrides.
function buildPortfolio(overridesSharesight, overridesHsbc) {
  const merged = {}

  // 1. Seed with portfolio.js (base)
  DEFAULT_PORTFOLIO.forEach(h => {
    merged[h.eodhd] = { ...h }
  })

  // 2. Apply ShareSight overrides — replaces the sharesight portion
  // First, remove any holdings tagged as 'sharesight' that aren't in the new override
  if (overridesSharesight && Object.keys(overridesSharesight).length > 0) {
    Object.keys(merged).forEach(eodhd => {
      if (merged[eodhd].source === 'sharesight' && !overridesSharesight[eodhd]) {
        delete merged[eodhd]
      }
    })
    Object.values(overridesSharesight).forEach(h => {
      merged[h.eodhd] = { ...h, source: 'sharesight' }
    })
  }

  // 3. Apply HSBC overrides
  if (overridesHsbc && Object.keys(overridesHsbc).length > 0) {
    Object.keys(merged).forEach(eodhd => {
      if (merged[eodhd].source === 'hsbc' && !overridesHsbc[eodhd]) {
        delete merged[eodhd]
      }
    })
    Object.values(overridesHsbc).forEach(h => {
      merged[h.eodhd] = { ...h, source: 'hsbc' }
    })
  }

  return Object.values(merged).sort((a, b) => b.value - a.value)
}

export default function App() {
  const [tab,        setTab]       = useState('overview')
  const [prices,     setPrices]    = useState({})
  const [loading,    setLoading]   = useState(true)
  const [lastFetch,  setLastFetch] = useState(null)

  const [showShareSightImport, setShowShareSightImport] = useState(false)
  const [showHsbcImport,       setShowHsbcImport]       = useState(false)

  // Per-source overrides loaded from localStorage
  const [overridesSharesight, setOverridesSharesight] = useState(() =>
    lsGetJSON(SK_OVERRIDES_SHARESIGHT, {}))
  const [overridesHsbc, setOverridesHsbc] = useState(() =>
    lsGetJSON(SK_OVERRIDES_HSBC, {}))

  const [sharesightDate, setSharesightDate] = useState(() => lsGet(SK_DATE_SHARESIGHT))
  const [hsbcDate,       setHsbcDate]       = useState(() => lsGet(SK_DATE_HSBC))
  const [hsbcFxRate,     setHsbcFxRate]     = useState(() => lsGet(SK_FX_RATE))

  // Merged portfolio — recomputed when overrides change
  const portfolio = useMemo(
    () => buildPortfolio(overridesSharesight, overridesHsbc),
    [overridesSharesight, overridesHsbc]
  )
  const totalValue = useMemo(
    () => portfolio.reduce((s, h) => s + h.value, 0),
    [portfolio]
  )

  const [deleted, setDeleted] = useState(() => {
    const s = lsGet(SK_DELETED)
    try { return new Set(JSON.parse(s || '[]')) } catch { return new Set() }
  })
  useEffect(() => { lsSet(SK_DELETED, JSON.stringify([...deleted])) }, [deleted])

  const deleteTicker  = (t) => setDeleted(prev => new Set([...prev, t]))
  const restoreTicker = (t) => setDeleted(prev => { const s = new Set(prev); s.delete(t); return s })
  const restoreAll    = ()  => setDeleted(new Set())

  // ShareSight import handler — replaces sharesight overrides only
  const handleSharesightImport = useCallback((holdings, total, snapshotDate) => {
    const map = {}
    holdings.forEach(h => { map[h.eodhd] = { ...h, source: 'sharesight' } })
    setOverridesSharesight(map)
    setSharesightDate(snapshotDate || null)
    lsSet(SK_OVERRIDES_SHARESIGHT, JSON.stringify(map))
    lsSet(SK_DATE_SHARESIGHT, snapshotDate || '')
    setPrices({})
    setLoading(true)
  }, [])

  // HSBC import handler — replaces HSBC overrides only
  const handleHsbcImport = useCallback((entries, fxRate) => {
    const map = {}
    entries.forEach(h => {
      const { _meta, ...rest } = h
      map[h.eodhd] = { ...rest, source: 'hsbc' }
    })
    setOverridesHsbc(map)
    const today = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
    setHsbcDate(today)
    setHsbcFxRate(String(fxRate))
    lsSet(SK_OVERRIDES_HSBC, JSON.stringify(map))
    lsSet(SK_DATE_HSBC, today)
    lsSet(SK_FX_RATE, String(fxRate))
    setPrices({})
    setLoading(true)
  }, [])

  // Load prices
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

  const loaded         = Object.values(prices).filter(p => p?.ok).length
  const total          = portfolio.length
  const deletedProps   = { deleted, deleteTicker, restoreTicker, restoreAll }
  const portfolioProps = { portfolio, totalValue }

  return (
    <div className="min-h-screen bg-background text-on-surface font-sans">

      {showShareSightImport && (
        <SharesightImporter
          onImport={handleSharesightImport}
          onClose={() => setShowShareSightImport(false)}
          currentPortfolio={portfolio.filter(h => h.source === 'sharesight')}
        />
      )}

      {showHsbcImport && (
        <HsbcImporter
          onImport={handleHsbcImport}
          onClose={() => setShowHsbcImport(false)}
          currentPortfolio={portfolio}
        />
      )}

      {/* Header */}
      <header className="bg-surface sticky top-0 z-40 border-b border-outline-variant/15">
        <div className="flex justify-between items-center px-4 md:px-6 py-3 md:py-4">
          <div className="flex items-center gap-2 md:gap-3">
            <span className="material-symbols-outlined text-[#4F8EF7] text-xl">signal_cellular_alt</span>
            <h1 className="text-base md:text-xl font-black bg-gradient-to-br from-primary to-primary-container bg-clip-text text-transparent tracking-tight">
              Ultimate Wealth
            </h1>
          </div>

          <nav className="hidden md:flex items-center gap-0.5 ml-4">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`px-4 py-2 text-sm transition-colors whitespace-nowrap ${
                  tab === t.id
                    ? 'text-primary border-b-2 border-primary font-bold'
                    : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface font-medium'
                }`}>
                {t.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2 md:gap-3">
            {/* ShareSight import */}
            <button onClick={() => setShowShareSightImport(true)}
              className="hidden md:flex items-center gap-2 border border-outline-variant/25 hover:border-primary/40 bg-surface-container-low hover:bg-surface-container px-3 py-1.5 rounded text-xs transition-all group">
              <span className="material-symbols-outlined text-sm text-on-surface-variant group-hover:text-primary transition-colors">upload_file</span>
              <span className="text-on-surface-variant group-hover:text-on-surface transition-colors">
                {sharesightDate ? `ShareSight · ${sharesightDate}` : 'Import ShareSight'}
              </span>
            </button>

            {/* HSBC import */}
            <button onClick={() => setShowHsbcImport(true)}
              className="hidden md:flex items-center gap-2 border border-outline-variant/25 hover:border-[#DB0011]/40 bg-surface-container-low hover:bg-surface-container px-3 py-1.5 rounded text-xs transition-all group">
              <span className="material-symbols-outlined text-sm text-on-surface-variant group-hover:text-[#DB0011] transition-colors">account_balance</span>
              <span className="text-on-surface-variant group-hover:text-on-surface transition-colors">
                {hsbcDate ? `HSBC · ${hsbcDate}` : 'Import HSBC'}
              </span>
            </button>

            {lastFetch && (
              <span className="text-[10px] text-on-surface-variant tabular hidden sm:block">
                {loaded}/{total}
              </span>
            )}

            <button onClick={loadPrices}
              className="flex items-center gap-1.5 bg-surface-container-high hover:bg-surface-variant px-3 py-2 text-xs font-bold text-on-surface-variant transition-colors rounded">
              <span className="material-symbols-outlined text-sm">refresh</span>
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {/* Mobile import dropdown */}
            <div className="md:hidden flex items-center gap-2">
              <button onClick={() => setShowShareSightImport(true)} className="text-on-surface-variant hover:text-primary transition-colors p-1">
                <span className="material-symbols-outlined text-xl">upload_file</span>
              </button>
              <button onClick={() => setShowHsbcImport(true)} className="text-on-surface-variant hover:text-[#DB0011] transition-colors p-1">
                <span className="material-symbols-outlined text-xl">account_balance</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="pb-20 md:pb-0">
        {tab === 'overview'    && <OverviewTab    {...portfolioProps} {...deletedProps} prices={prices} loading={loading} today={TODAY} />}
        {tab === 'exposure'    && <ExposureTab    {...portfolioProps} {...deletedProps} prices={prices} loading={loading} />}
        {tab === 'holdings'    && <HoldingsTab    {...portfolioProps} {...deletedProps} prices={prices} loading={loading} />}
        {tab === 'passive'     && <PassiveTab     {...portfolioProps} prices={prices} loading={loading} />}
        {tab === 'news'        && <NewsTab        {...portfolioProps} />}
        {tab === 'performance' && <PerformanceTab {...portfolioProps} prices={prices} />}
        {tab === 'wrap'        && <SessionWrapTab {...portfolioProps} {...deletedProps} prices={prices} loading={loading} />}
      </main>

      <footer className="hidden md:block w-full py-5 px-6 text-center bg-surface-container-lowest">
        <p className="text-xs font-light text-on-surface-variant">
          Data via EODHD · {TODAY}
          {sharesightDate && ` · ShareSight ${sharesightDate}`}
          {hsbcDate && ` · HSBC ${hsbcDate}`}
          {hsbcFxRate && ` · USD/AUD ${parseFloat(hsbcFxRate).toFixed(4)}`}
        </p>
      </footer>

      <nav className="md:hidden fixed bottom-0 left-0 w-full z-40 bg-surface border-t border-outline-variant/15 pb-safe">
        <div className="flex justify-around items-center pt-2 pb-1">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 transition-colors min-w-0 flex-1 ${
                tab === t.id ? 'text-primary' : 'text-on-surface-variant'
              }`}>
              <span className="material-symbols-outlined text-[20px]"
                style={{ fontVariationSettings: tab === t.id ? "'FILL' 1" : "'FILL' 0" }}>
                {t.icon}
              </span>
              <span className="text-[8px] font-bold tracking-wide uppercase truncate w-full text-center">
                {t.label}
              </span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
