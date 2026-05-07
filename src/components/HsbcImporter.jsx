import { useState, useCallback, useRef } from 'react'

// HSBC Singapore Wealth Dashboard — Active Equities + Passive ETFs
// Auto-classifies tickers we already know about.
const PASSIVE_TICKERS = new Set([
  'IDEF','QQQM','TLT','LQD','SHYG','AOA','IHAK','IAU','VCRB','VT',
])

const KNOWN_NAMES = {
  GOOG:  'Alphabet',
  AMZN:  'Amazon.com Inc.',
  AXP:   'American Express Co.',
  IDEF:  'BlackRock Defined Outcome ETF',
  FIG:   'Figma Inc',
  QQQM:  'Invesco NASDAQ 100 ETF',
  TLT:   'iShares 20+ Year Treasury Bond ETF',
  LQD:   'iShares iBoxx Corp Bond ETF',
  SHYG:  'iShares 0-5 HY Corp Bond ETF',
  AOA:   'iShares Core 80/20 ETF',
  IHAK:  'iShares Cybersec & Tech ETF',
  IAU:   'iShares Gold Trust',
  META:  'Meta Platforms Inc',
  MU:    'Micron Technology',
  MSFT:  'Microsoft Corporation',
  NVDA:  'NVIDIA Corp',
  SHOP:  'Shopify Inc',
  SPOT:  'Spotify Technology S.A.',
  VCRB:  'Vanguard Core Bond ETF',
  VT:    'Vanguard Total World Stock ETF',
  TSM:   'Taiwan Semiconductor Manufacturing - ADR',
}

// ─── PDF.js loader ──────────────────────────────────────────────────────────
function loadPdfJs() {
  return new Promise((resolve, reject) => {
    if (window.pdfjsLib) return resolve(window.pdfjsLib)
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
    s.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
      resolve(window.pdfjsLib)
    }
    s.onerror = () => reject(new Error('Could not load PDF.js'))
    document.head.appendChild(s)
  })
}

// ─── Parser ─────────────────────────────────────────────────────────────────
// Extracts holdings from HSBC text. Format observed:
//   "Alphabet / USD / GOOG"
//   "USD 19,453.20"
//   "58.0000 units @ USD 335.4000"
function parseHsbcText(rawText) {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean)
  const holdings = []

  for (let i = 0; i < lines.length; i++) {
    // Look for "Name / USD / TICKER" pattern
    const m = lines[i].match(/^(.+?)\s*\/\s*(USD|HKD|EUR|GBP|SGD|AUD)\s*\/\s*([A-Z][A-Z0-9.\-]+)\s*$/)
    if (!m) continue

    const [, name, ccy, ticker] = m

    // Look in the next ~5 lines for the market value
    let marketValue = null
    let units = null
    for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
      // Match "USD 19,453.20" — the market value line
      const valMatch = lines[j].match(/^(USD|HKD|EUR|GBP|SGD|AUD)\s+([\d,]+\.\d{2})\s*$/)
      if (valMatch && marketValue === null) {
        marketValue = parseFloat(valMatch[2].replace(/,/g, ''))
        continue
      }
      // Match "58.0000 units @ USD 335.4000"
      const unitMatch = lines[j].match(/^([\d,]+\.?\d*)\s*units?\s*@\s*(USD|HKD|EUR|GBP|SGD|AUD)\s+([\d,]+\.\d+)/i)
      if (unitMatch) {
        units = parseFloat(unitMatch[1].replace(/,/g, ''))
      }
    }

    if (marketValue !== null && marketValue > 0) {
      holdings.push({ ticker, name, ccy, marketValue, units })
    }
  }

  return holdings
}

// ─── FX rate fetcher ────────────────────────────────────────────────────────
async function fetchFxRate(from, to) {
  try {
    // Free, no-auth FX API
    const res = await fetch(`https://api.frankfurter.dev/v1/latest?base=${from}&symbols=${to}`)
    const data = await res.json()
    return data?.rates?.[to] ?? null
  } catch {
    return null
  }
}

// ─── Component ──────────────────────────────────────────────────────────────
export default function HsbcImporter({ onImport, onClose, currentPortfolio }) {
  const fileRef = useRef()
  const [dragging, setDragging] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)
  const [parsed,   setParsed]   = useState(null)
  const [fxRate,   setFxRate]   = useState(null)

  const processFile = useCallback(async (file) => {
    if (!file) return
    setLoading(true); setError(null); setParsed(null)
    try {
      const ext = file.name.split('.').pop().toLowerCase()
      if (ext !== 'pdf') {
        throw new Error('Please upload a PDF — image OCR not supported. Export the HSBC Wealth Dashboard as PDF.')
      }

      const pdfjs = await loadPdfJs()

      const arrayBuffer = await file.arrayBuffer()
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise

      let allText = ''
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const content = await page.getTextContent()
        // Reconstruct lines based on Y position
        const lines = {}
        content.items.forEach(item => {
          const y = Math.round(item.transform[5])
          if (!lines[y]) lines[y] = []
          lines[y].push({ x: item.transform[4], text: item.str })
        })
        const sortedY = Object.keys(lines).map(Number).sort((a, b) => b - a)
        sortedY.forEach(y => {
          const sortedX = lines[y].sort((a, b) => a.x - b.x)
          allText += sortedX.map(t => t.text).join(' ') + '\n'
        })
      }

      const holdings = parseHsbcText(allText)
      if (holdings.length === 0) {
        throw new Error('Could not find any holdings in the PDF. Make sure this is the HSBC Wealth Dashboard report (page 2-5 should list Investment Holdings).')
      }

      // Fetch FX rate
      const usdHoldings = holdings.filter(h => h.ccy === 'USD')
      let rate = 1
      if (usdHoldings.length > 0) {
        rate = await fetchFxRate('USD', 'AUD')
        if (!rate) {
          rate = 1.55  // fallback
        }
      }
      setFxRate(rate)

      // Convert to portfolio entries
      const entries = holdings.map(h => {
        const tickerKey = h.ticker.toUpperCase()
        const eodhd = `${tickerKey}.US`
        const isPassive = PASSIVE_TICKERS.has(tickerKey)
        const audValue = h.ccy === 'AUD' ? h.marketValue : h.marketValue * rate
        return {
          eodhd,
          name:    KNOWN_NAMES[tickerKey] || h.name,
          value:   Math.round(audValue * 100) / 100,
          exch:    'US',
          source:  'hsbc',
          ...(isPassive ? { passive: true } : {}),
          _meta: {
            originalCcy: h.ccy,
            originalValue: h.marketValue,
            ticker: tickerKey,
          },
        }
      })

      setParsed({
        entries,
        rate,
        count: entries.length,
        usdTotal: usdHoldings.reduce((s, h) => s + h.marketValue, 0),
        audTotal: entries.reduce((s, h) => s + h.value, 0),
        fileName: file.name,
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleApply = () => {
    if (!parsed) return
    onImport(parsed.entries, parsed.rate)
    onClose()
  }

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false)
    processFile(e.dataTransfer.files[0])
  }, [processFile])

  // Diff vs current portfolio
  const diff = parsed && currentPortfolio ? (() => {
    const existing = Object.fromEntries(
      currentPortfolio.filter(h => h.source === 'hsbc').map(h => [h.eodhd, h])
    )
    const incoming = Object.fromEntries(parsed.entries.map(h => [h.eodhd, h]))
    return {
      added:   parsed.entries.filter(h => !existing[h.eodhd]),
      changed: parsed.entries.filter(h => existing[h.eodhd] && Math.abs(existing[h.eodhd].value - h.value) > 1),
      removed: Object.values(existing).filter(h => !incoming[h.eodhd]),
    }
  })() : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-surface-container rounded-xl border border-outline-variant/20 shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-outline-variant/15 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#DB0011]/10 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-[#DB0011] text-lg">account_balance</span>
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight">Import HSBC Singapore</h2>
              <p className="text-[11px] text-on-surface-variant mt-0.5">
                Wealth Dashboard PDF · auto FX conversion · only updates HSBC holdings
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-on-surface-variant hover:text-error transition-colors p-1">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Instructions */}
          {!parsed && !loading && (
            <div className="bg-surface-container-low rounded-lg p-4 border border-outline-variant/10 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3">How to export from HSBC</p>
              {[
                ['HSBC Online Banking → Wealth Dashboard', ''],
                ['Click "Print" or "Download Report"', 'should produce a PDF'],
                ['Drop the PDF here', 'we parse Investment Holdings'],
                ['Review the preview', 'confirm before applying'],
              ].map(([step, hint], i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-5 h-5 bg-primary/10 text-primary text-[10px] font-black rounded-full flex items-center justify-center flex-shrink-0">{i+1}</span>
                  <span className="text-xs text-on-surface-variant">
                    <span className="text-on-surface font-medium">{step}</span>
                    {hint && <span> — {hint}</span>}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Drop zone */}
          {!parsed && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => !loading && fileRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all select-none ${
                dragging ? 'border-primary bg-primary/5 scale-[1.01]'
                         : 'border-outline-variant/30 hover:border-primary/50 hover:bg-surface-container-low'
              } ${loading ? 'pointer-events-none' : ''}`}
            >
              <input ref={fileRef} type="file" accept=".pdf" className="hidden"
                onChange={e => { processFile(e.target.files[0]); e.target.value = '' }} />
              {loading ? (
                <div className="flex flex-col items-center gap-3">
                  <span className="material-symbols-outlined text-4xl text-primary animate-spin">progress_activity</span>
                  <p className="text-sm text-on-surface-variant">Parsing PDF…</p>
                  <p className="text-xs text-on-surface-variant/60">Extracting holdings · fetching FX rate</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <span className={`material-symbols-outlined text-5xl transition-colors ${dragging ? 'text-primary' : 'text-on-surface-variant/30'}`}>upload_file</span>
                  <div>
                    <p className="font-bold text-on-surface">Drop your HSBC Wealth Dashboard PDF</p>
                    <p className="text-sm text-on-surface-variant mt-1">or click to browse · PDF only</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-error/10 border border-error/20 rounded-lg p-4 flex gap-3">
              <span className="material-symbols-outlined text-error flex-shrink-0 mt-0.5">error</span>
              <div className="text-sm">
                <p className="font-bold text-error mb-1">Import failed</p>
                <p className="text-on-surface-variant whitespace-pre-wrap text-xs leading-relaxed">{error}</p>
                <button onClick={() => setError(null)}
                  className="mt-3 text-primary text-xs font-bold hover:underline">Try again</button>
              </div>
            </div>
          )}

          {/* Result */}
          {parsed && (
            <div className="space-y-4">
              {/* Success bar */}
              <div className="flex items-center justify-between bg-secondary/5 border border-secondary/20 rounded-lg px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-secondary">check_circle</span>
                  <div className="text-sm">
                    <span className="font-bold text-on-surface">{parsed.count} holdings parsed</span>
                    <span className="text-on-surface-variant ml-2">· FX rate {fxRate?.toFixed(4)}</span>
                  </div>
                </div>
                <button onClick={() => setParsed(null)} className="text-xs font-bold text-on-surface-variant hover:text-primary transition-colors">
                  Different file
                </button>
              </div>

              {/* FX summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-surface-container-low rounded-lg p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">USD Total</p>
                  <p className="text-xl font-bold tabular">${parsed.usdTotal.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
                </div>
                <div className="bg-surface-container-low rounded-lg p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">FX Rate</p>
                  <p className="text-xl font-bold tabular">{fxRate?.toFixed(4)}</p>
                  <p className="text-[10px] text-on-surface-variant mt-1">USD → AUD (live)</p>
                </div>
                <div className="bg-surface-container-low rounded-lg p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">AUD Total</p>
                  <p className="text-xl font-bold tabular text-primary">${parsed.audTotal.toLocaleString('en-AU', { maximumFractionDigits: 0 })}</p>
                </div>
              </div>

              {/* Diff */}
              {diff && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-secondary/10 text-secondary text-center py-2 rounded text-xs font-bold">
                    + {diff.added.length} added
                  </div>
                  <div className="bg-primary/10 text-primary text-center py-2 rounded text-xs font-bold">
                    ↻ {diff.changed.length} changed
                  </div>
                  <div className="bg-error/10 text-error text-center py-2 rounded text-xs font-bold">
                    − {diff.removed.length} removed
                  </div>
                </div>
              )}

              {/* Holdings table */}
              <div className="max-h-64 overflow-y-auto rounded-lg border border-outline-variant/10">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-container-high sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-[10px] font-bold uppercase text-on-surface-variant">Ticker</th>
                      <th className="px-3 py-2 text-[10px] font-bold uppercase text-on-surface-variant">Type</th>
                      <th className="px-3 py-2 text-[10px] font-bold uppercase text-on-surface-variant text-right">USD</th>
                      <th className="px-3 py-2 text-[10px] font-bold uppercase text-on-surface-variant text-right">AUD</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10 bg-surface-container-low">
                    {parsed.entries.map(h => (
                      <tr key={h.eodhd}>
                        <td className="px-3 py-2 font-bold text-primary">{h.eodhd.split('.')[0]}</td>
                        <td className="px-3 py-2">
                          {h.passive
                            ? <span className="bg-[#B76DFF]/10 text-[#B76DFF] text-[9px] font-bold uppercase px-1.5 py-0.5 rounded">Passive</span>
                            : <span className="bg-primary/10 text-primary text-[9px] font-bold uppercase px-1.5 py-0.5 rounded">Active</span>}
                        </td>
                        <td className="px-3 py-2 text-right tabular text-on-surface-variant">
                          ${h._meta.originalValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                        </td>
                        <td className="px-3 py-2 text-right tabular font-medium">
                          ${h.value.toLocaleString('en-AU', { maximumFractionDigits: 0 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Note */}
              <div className="bg-primary/5 border border-primary/15 rounded-lg p-3 text-xs text-on-surface-variant">
                <span className="material-symbols-outlined text-primary text-sm align-middle mr-1">info</span>
                This will only replace HSBC holdings. Your ShareSight, Stake, and other holdings stay untouched.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-outline-variant/15 flex-shrink-0">
          <button onClick={onClose} className="px-5 py-2 text-sm font-bold text-on-surface-variant hover:bg-surface-container-high rounded transition-colors">
            Cancel
          </button>
          <button onClick={handleApply} disabled={!parsed}
            className="px-6 py-2.5 bg-primary text-on-primary text-sm font-bold rounded hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">download_done</span>
            Apply HSBC Holdings
          </button>
        </div>
      </div>
    </div>
  )
}
