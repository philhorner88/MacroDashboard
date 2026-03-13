import { useState, useEffect, useCallback } from 'react'
import OverviewTab    from './components/OverviewTab'
import ExposureTab    from './components/ExposureTab'
import HoldingsTab    from './components/HoldingsTab'
import NewsTab        from './components/NewsTab'
import PerformanceTab from './components/PerformanceTab'
import { PORTFOLIO }  from './data/portfolio'
import { fetchAllPrices } from './data/api'

const TABS = [
  { id: 'overview',    label: '📊  Overview'    },
  { id: 'exposure',    label: '🥧  Exposure'    },
  { id: 'holdings',    label: '📋  Holdings'    },
  { id: 'news',        label: '📰  News'        },
  { id: 'performance', label: '📈  Performance' },
]

const TODAY = new Date().toLocaleDateString('en-AU', {
  weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
})

export default function App() {
  const [tab,       setTab]       = useState('overview')
  const [prices,    setPrices]    = useState({})
  const [loading,   setLoading]   = useState(true)
  const [lastFetch, setLastFetch] = useState(null)

  const loadPrices = useCallback(async () => {
    setLoading(true)
    try {
      const tickers = PORTFOLIO.map(h => h.eodhd)
      const result  = await fetchAllPrices(tickers)
      setPrices(result)
      setLastFetch(new Date().toLocaleTimeString('en-AU'))
    } catch (err) {
      console.error('Price fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadPrices() }, [loadPrices])

  const loaded = Object.values(prices).filter(p => p?.ok).length
  const total  = PORTFOLIO.length

  return (
    <div style={{ minHeight: '100vh', background: '#f0f4f8', fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>

      {/* Header */}
      <div style={{
        background: '#fff', borderBottom: '1px solid #e2e8f0',
        padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 0' }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #3182ce, #805ad5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
          }}>💼</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17, color: '#2d3748', letterSpacing: '-.3px' }}>
              Ultimate Wealth
            </div>
            <div style={{ fontSize: 11, color: '#a0aec0' }}>Portfolio Dashboard · {TODAY}</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#3182ce' }}>
              <div className="spinner" />
              <span>Loading ({loaded}/{total})…</span>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: '#a0aec0' }}>
              ✓ {loaded}/{total} prices
              {lastFetch && <> · {lastFetch}</>}
            </div>
          )}
          <button onClick={loadPrices} disabled={loading} style={{
            padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            border: '1px solid #e2e8f0', background: loading ? '#f7fafc' : '#fff',
            color: loading ? '#a0aec0' : '#3182ce', cursor: loading ? 'not-allowed' : 'pointer',
          }}>
            ↺ Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        background: '#fff', borderBottom: '1px solid #e2e8f0',
        padding: '0 32px', display: 'flex', gap: 4,
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`tab-btn${tab === t.id ? ' active' : ''}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto' }}>
        {tab === 'overview'    && <OverviewTab    prices={prices} loading={loading} />}
        {tab === 'exposure'    && <ExposureTab />}
        {tab === 'holdings'    && <HoldingsTab    prices={prices} loading={loading} />}
        {tab === 'news'        && <NewsTab />}
        {tab === 'performance' && <PerformanceTab prices={prices} />}
      </div>

      <div style={{
        textAlign: 'center', padding: '20px 32px', fontSize: 11, color: '#cbd5e1',
        borderTop: '1px solid #e2e8f0', background: '#fff', marginTop: 16,
      }}>
        Data via EODHD · Prices are intraday · Values from Sharesight snapshot 13 Mar 2026
      </div>
    </div>
  )
}
