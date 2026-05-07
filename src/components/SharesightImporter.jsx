import { useState, useCallback, useRef } from 'react'

const HARD_EXCLUDE = new Set([
  'FB', // renamed to META, already held directly
])

const PASSIVE_ETFS = new Set([
  'VAS','VDHG','VGS','VTS','VVLU','WDMF','NDQ','IXJ','QUAL','CRED',
  'ASIA','IIND','DFND','VBLD','CETF','HACK','MOAT','RPAR','KRBN',
  'TLT','IEI','BND','AGG','VGSH','GGOV','IAF','XGOV','GHLD',
])

const EXCHANGE_MAP = {
  'ASX':      { suffix: '.AU',    exch: 'AU' },
  'NASDAQ':   { suffix: '.US',    exch: 'US' },
  'NYSE':     { suffix: '.US',    exch: 'US' },
  'OTC':      { suffix: '.US',    exch: 'US' },
  'BATS':     { suffix: '.US',    exch: 'US' },
  'FRA':      { suffix: '.F',     exch: 'EU' },
  'XETR':     { suffix: '.XETRA', exch: 'EU' },
  'SWX':      { suffix: '.SW',    exch: 'EU' },
  'VIE':      { suffix: '.VI',    exch: 'EU' },
  'CSE':      { suffix: '.CO',    exch: 'EU' },
  'LSE':      { suffix: '.LSE',   exch: 'EU' },
  'STO':      { suffix: '.ST',    exch: 'EU' },
  'AMS':      { suffix: '.AS',    exch: 'EU' },
  'EPA':      { suffix: '.PA',    exch: 'EU' },
  'EURONEXT': { suffix: '.PA',    exch: 'EU' },
}
const AMS_TICKERS = new Set(['ADYEN','ASML','RAND','ING','PHIA','HEIA','ABN','AKZA','NN','WKL'])

function resolveEodhd(market, code) {
  const m = (market || '').trim().toUpperCase()
  let   c = (code   || '').trim()
  if (m === 'CSE') c = c.replace(/\s+/g, '-')
  const mapping = EXCHANGE_MAP[m]
  if (!mapping) return { eodhd: `${c}.US`, exch: 'US', guessed: true }
  let suffix = mapping.suffix
  if (m === 'EURONEXT' && AMS_TICKERS.has(c.toUpperCase())) suffix = '.AS'
  return { eodhd: `${c}${suffix}`, exch: mapping.exch, guessed: false }
}

function loadXLSX() {
  return new Promise((resolve, reject) => {
    if (window.XLSX) return resolve(window.XLSX)
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
    s.onload  = () => resolve(window.XLSX)
    s.onerror = () => reject(new Error('Could not load SheetJS'))
    document.head.appendChild(s)
  })
}

async function parseXLSX(file) {
  const XLSX = await loadXLSX()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.onload  = (e) => {
      try {
        const wb    = XLSX.read(new Uint8Array(e.target.result), { type: 'array' })
        const name  = wb.SheetNames.find(n => n.toLowerCase().includes('combined')) || wb.SheetNames[0]
        const sheet = wb.Sheets[name]
        const rows  = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null })

        let hi = rows.findIndex(r =>
          Array.isArray(r) &&
          r.some(c => String(c || '').trim().toLowerCase() === 'market') &&
          r.some(c => String(c || '').trim().toLowerCase() === 'code')
        )
        if (hi === -1) hi = 3

        const hdr  = rows[hi].map(h => String(h || '').trim().toLowerCase())
        const iMkt  = hdr.indexOf('market')
        const iCode = hdr.indexOf('code')
        const iName = hdr.indexOf('name')
        const iEtf  = hdr.indexOf('within etf')
        const iVal  = hdr.indexOf('value')

        if (iMkt === -1 || iCode === -1 || iVal === -1) {
          throw new Error(`Missing required columns. Found: ${hdr.filter(Boolean).join(', ')}`)
        }

        const acc = {}
        const excluded = []
        let withinEtfCount = 0

        for (let i = hi + 1; i < rows.length; i++) {
          const row = rows[i]
          if (!row || !row[iCode]) continue
          const market = String(row[iMkt]  || '').trim()
          const code   = String(row[iCode] || '').trim()
          const name   = String(row[iName] || code).trim()
          const withinEtf = row[iEtf]
          const rawVal = row[iVal]
          if (market === 'Total' || market === '') continue
          if (withinEtf !== null && withinEtf !== undefined && withinEtf !== '' && withinEtf !== false) {
            withinEtfCount++; continue
          }
          const val = parseFloat(String(rawVal || '0').replace(/[$,\s]/g, ''))
          if (isNaN(val) || val <= 0) continue
          const codeNorm = code.replace(/\s+/g, '-').toUpperCase()
          if (HARD_EXCLUDE.has(codeNorm)) {
            excluded.push({ code, name, reason: 'Stale ticker' })
            continue
          }
          const key = `${market}::${code}`
          if (acc[key]) acc[key].value += val
          else acc[key] = { market, code, name, value: val }
        }

        const holdings = Object.values(acc).map(h => {
          const { eodhd, exch, guessed } = resolveEodhd(h.market, h.code)
          const codeNorm = h.code.trim().replace(/\s+/g, '-').toUpperCase()
          const isPassive = PASSIVE_ETFS.has(codeNorm)
          return {
            eodhd,
            name:    h.name.replace(/ - Ordinary Shares.*$/i, '').replace(/ Ltd\.?\.?$/i, '').trim(),
            exch,
            value:   Math.round(h.value * 100) / 100,
            guessed,
            ...(isPassive ? { passive: true } : {}),
          }
        }).filter(h => h.value > 0).sort((a, b) => b.value - a.value)

        const total = holdings.reduce((s, h) => s + h.value, 0)
        resolve({ holdings, total, count: holdings.length, excluded, withinEtfCount })
      } catch (err) { reject(err) }
    }
    reader.readAsArrayBuffer(file)
  })
}

function extractDateFromFilename(filename) {
  const m = filename.match(/(\d{4}-\d{2}-\d{2})/)
  if (!m) return null
  return new Date(m[1]).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function SharesightImporter({ onImport, onClose, currentPortfolio }) {
  const [dragging, setDragging] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)
  const [parsed,   setParsed]   = useState(null)
  const fileRef = useRef()

  const processFile = useCallback(async (file) => {
    if (!file) return
    setLoading(true); setError(null); setParsed(null)
    try {
      const result = await parseXLSX(file)
      result.snapshotDate = extractDateFromFilename(file.name)
      setParsed(result)
    } catch (err) {
      setError(err.message)
    } finally { setLoading(false) }
  }, [])

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false)
    processFile(e.dataTransfer.files[0])
  }, [processFile])

  const handleConfirm = () => {
    if (!parsed) return
    onImport(parsed.holdings, parsed.total, parsed.snapshotDate)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-surface-container rounded-xl border border-outline-variant/20 shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-outline-variant/15 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-lg">upload_file</span>
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight">Import ShareSight</h2>
              <p className="text-[11px] text-on-surface-variant mt-0.5">
                Only updates ShareSight holdings — your HSBC and other holdings stay untouched
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-on-surface-variant hover:text-error transition-colors p-1">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {!parsed && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => !loading && fileRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
                dragging ? 'border-primary bg-primary/5' : 'border-outline-variant/30 hover:border-primary/50 hover:bg-surface-container-low'
              }`}
            >
              <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
                onChange={e => { processFile(e.target.files[0]); e.target.value = '' }} />
              {loading ? (
                <div className="flex flex-col items-center gap-3">
                  <span className="material-symbols-outlined text-4xl text-primary animate-spin">progress_activity</span>
                  <p className="text-sm text-on-surface-variant">Parsing spreadsheet…</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <span className={`material-symbols-outlined text-5xl ${dragging ? 'text-primary' : 'text-on-surface-variant/30'}`}>cloud_upload</span>
                  <p className="font-bold text-on-surface">Drop your ShareSight Exposure Report</p>
                  <p className="text-sm text-on-surface-variant">.xlsx accepted</p>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="bg-error/10 border border-error/20 rounded-lg p-4">
              <p className="font-bold text-error mb-1 text-sm">Import failed</p>
              <p className="text-on-surface-variant text-xs">{error}</p>
              <button onClick={() => setError(null)} className="mt-2 text-primary text-xs font-bold hover:underline">Try again</button>
            </div>
          )}

          {parsed && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-secondary/5 border border-secondary/20 rounded-lg px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-secondary">check_circle</span>
                  <div className="text-sm">
                    <span className="font-bold">{parsed.count} holdings parsed</span>
                    {parsed.snapshotDate && <span className="text-on-surface-variant ml-2">· {parsed.snapshotDate}</span>}
                    <span className="text-on-surface-variant ml-2">· {parsed.withinEtfCount} within-ETF rows filtered</span>
                  </div>
                </div>
                <button onClick={() => setParsed(null)} className="text-xs font-bold text-on-surface-variant hover:text-primary">Different file</button>
              </div>

              <div className="bg-primary/5 border border-primary/15 rounded-lg p-3 text-xs text-on-surface-variant">
                <span className="material-symbols-outlined text-primary text-sm align-middle mr-1">info</span>
                This import will replace ShareSight holdings only. HSBC, Stake, and other holdings stay untouched.
              </div>

              <div className="max-h-64 overflow-y-auto rounded-lg border border-outline-variant/10">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-container-high sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-[10px] font-bold uppercase">Ticker</th>
                      <th className="px-3 py-2 text-[10px] font-bold uppercase">Name</th>
                      <th className="px-3 py-2 text-[10px] font-bold uppercase text-right">AUD</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10 bg-surface-container-low">
                    {parsed.holdings.slice(0, 50).map(h => (
                      <tr key={h.eodhd}>
                        <td className="px-3 py-2 font-bold text-primary">{h.eodhd.split('.')[0]}</td>
                        <td className="px-3 py-2 truncate max-w-[200px]">{h.name}</td>
                        <td className="px-3 py-2 text-right tabular">${h.value.toLocaleString('en-AU', { maximumFractionDigits: 0 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-outline-variant/15 gap-3">
          <button onClick={onClose} className="px-5 py-2 text-sm font-bold text-on-surface-variant hover:bg-surface-container-high rounded">Cancel</button>
          <button onClick={handleConfirm} disabled={!parsed}
            className="px-6 py-2.5 bg-primary text-on-primary text-sm font-bold rounded hover:opacity-90 disabled:opacity-40 flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">download_done</span>
            Apply ShareSight Holdings
          </button>
        </div>
      </div>
    </div>
  )
}
