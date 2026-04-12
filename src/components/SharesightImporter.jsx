import { useState, useCallback, useRef } from 'react'

// ─── Derived from real ShareSight Exposure Report analysis ────────────────────
// Hard exclude: fund wrappers, carbon/risk ETFs, stale tickers
const HARD_EXCLUDE = new Set([
  // ASX ETF wrappers
  'VAS','VDHG','VGS','VTS','VVLU','WDMF','NDQ','IXJ','QUAL','CRED',
  'ASIA','IIND','DFND','VBLD','CETF','HACK','MOAT',
  // NYSE ETFs
  'RPAR','KRBN',
  // Stale / renamed tickers (META is already held directly)
  'FB',
  // Gold / govt bond ETFs — treat same as VAS
  'GHLD','XGOV',
])

// Bond ETFs — excluded by default, user can toggle on
const BOND_ETFS = new Set([
  'TLT','IEI','BND','AGG','VGSH', // US bond ETFs
  'GGOV','IAF',                    // ASX bond ETFs
])

// Exchange mapping: ShareSight market name → { suffix, exch }
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
  'HEL':      { suffix: '.HE',    exch: 'EU' },
  'BIT':      { suffix: '.MI',    exch: 'EU' },
  'BME':      { suffix: '.MC',    exch: 'EU' },
  'AMS':      { suffix: '.AS',    exch: 'EU' },
  'EPA':      { suffix: '.PA',    exch: 'EU' },
  // EURONEXT: Amsterdam (.AS) or Paris (.PA) depending on ticker
  'EURONEXT': { suffix: '.PA',    exch: 'EU' },
}

// Amsterdam-listed tickers on EURONEXT (all others default to Paris)
const AMS_TICKERS = new Set(['ADYEN','ASML','RAND','ING','PHIA','HEIA','ABN','AKZA','NN','WKL'])

function resolveEodhd(market, code) {
  const m = (market || '').trim().toUpperCase()
  let   c = (code   || '').trim()

  // CSE: "NOVO B" → "NOVO-B" (ShareSight uses space, EODHD uses hyphen)
  if (m === 'CSE') c = c.replace(/\s+/g, '-')

  const mapping = EXCHANGE_MAP[m]
  if (!mapping) return { eodhd: `${c}.US`, exch: 'US', guessed: true }

  let suffix = mapping.suffix
  if (m === 'EURONEXT' && AMS_TICKERS.has(c.toUpperCase())) suffix = '.AS'

  return { eodhd: `${c}${suffix}`, exch: mapping.exch, guessed: false }
}

function extractDateFromFilename(filename) {
  const m = filename.match(/(\d{4}-\d{2}-\d{2})/)
  if (!m) return null
  return new Date(m[1]).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function loadXLSX() {
  return new Promise((resolve, reject) => {
    if (window.XLSX) return resolve(window.XLSX)
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
    s.onload  = () => resolve(window.XLSX)
    s.onerror = () => reject(new Error('Could not load SheetJS — check your internet connection'))
    document.head.appendChild(s)
  })
}

async function parseXLSX(file, includeBondETFs) {
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

        // Find header row — look for Market + Code columns
        let hi = rows.findIndex(r =>
          Array.isArray(r) &&
          r.some(c => String(c || '').trim().toLowerCase() === 'market') &&
          r.some(c => String(c || '').trim().toLowerCase() === 'code')
        )
        if (hi === -1) hi = 3

        const hdr = rows[hi].map(h => String(h || '').trim().toLowerCase())
        const col = (n) => hdr.findIndex(h => h === n)

        const iMkt  = col('market')
        const iCode = col('code')
        const iName = col('name')
        const iEtf  = col('within etf')
        const iVal  = col('value')

        if (iMkt === -1 || iCode === -1 || iVal === -1) {
          throw new Error(
            `Could not find required columns.\nFound headers: ${hdr.filter(Boolean).join(', ')}\nExpected: Market, Code, Value`
          )
        }

        // Accumulate values — same ticker across multiple portfolios → sum
        const acc      = {}  // key: "MARKET::CODE" → { market, code, name, value }
        const excluded = []
        const withinEtfRows = { count: 0 }

        for (let i = hi + 1; i < rows.length; i++) {
          const row = rows[i]
          if (!row || !row[iCode]) continue

          const market   = String(row[iMkt]  || '').trim()
          const code     = String(row[iCode] || '').trim()
          const name     = String(row[iName] || code).trim()
          const withinEtf = row[iEtf]
          const rawVal   = row[iVal]

          // Skip total rows
          if (market === 'Total' || market === '') continue

          // Skip within-ETF rows — Within Etf column has a value (not null/empty)
          const isWithinEtf = withinEtf !== null && withinEtf !== undefined &&
                              withinEtf !== '' && withinEtf !== false
          if (isWithinEtf) { withinEtfRows.count++; continue }

          const val = parseFloat(String(rawVal || '0').replace(/[$,\s]/g, ''))
          if (isNaN(val) || val <= 0) continue

          const codeNorm = code.replace(/\s+/g, '-').toUpperCase()

          // Hard exclude
          if (HARD_EXCLUDE.has(codeNorm)) {
            excluded.push({ code, name, reason: 'Fund wrapper / stale ticker — excluded' })
            continue
          }

          // Bond ETF toggle
          if (BOND_ETFS.has(codeNorm) && !includeBondETFs) {
            excluded.push({ code, name, reason: 'Bond ETF (use toggle to include)' })
            continue
          }

          const key = `${market}::${code}`
          if (acc[key]) {
            acc[key].value += val
          } else {
            acc[key] = { market, code, name, value: val }
          }
        }

        const holdings = Object.values(acc)
          .map(h => {
            const { eodhd, exch, guessed } = resolveEodhd(h.market, h.code)
            return {
              eodhd,
              name:    h.name.replace(/ - Ordinary Shares.*$/i, '').replace(/ Ltd\.?\.?$/i, '').trim(),
              exch,
              value:   Math.round(h.value * 100) / 100,
              guessed,
            }
          })
          .filter(h => h.value > 0)
          .sort((a, b) => b.value - a.value)

        const total = holdings.reduce((s, h) => s + h.value, 0)

        resolve({
          holdings,
          total,
          sheetName: name,
          excluded,
          withinEtfCount: withinEtfRows.count,
          count: holdings.length,
        })
      } catch (err) {
        reject(err)
      }
    }
    reader.readAsArrayBuffer(file)
  })
}

// ─── Diff: compare incoming vs current ───────────────────────────────────────
function computeDiff(current, incoming) {
  const curMap = Object.fromEntries((current || []).map(h => [h.eodhd, h]))
  const newMap = Object.fromEntries(incoming.map(h => [h.eodhd, h]))
  return {
    added:     incoming.filter(h => !curMap[h.eodhd]),
    removed:   (current || []).filter(h => !newMap[h.eodhd]),
    changed:   incoming.filter(h => curMap[h.eodhd] && Math.abs(curMap[h.eodhd].value - h.value) > 1),
    unchanged: incoming.filter(h => curMap[h.eodhd] && Math.abs(curMap[h.eodhd].value - h.value) <= 1),
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function ExchBadge({ exch }) {
  const cls = exch === 'AU'
    ? 'bg-[#FF9F43]/10 text-[#FF9F43]'
    : exch === 'US'
      ? 'bg-[#4F8EF7]/10 text-[#4F8EF7]'
      : 'bg-[#B76DFF]/10 text-[#B76DFF]'
  return <span className={`text-[9px] px-1.5 py-0.5 rounded-sm font-black uppercase ${cls}`}>{exch}</span>
}

function DiffSection({ title, items, color, icon }) {
  const [expanded, setExpanded] = useState(false)
  if (!items.length) return null
  const show = expanded ? items : items.slice(0, 5)
  return (
    <div className="mb-3">
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`material-symbols-outlined text-sm ${color}`}>{icon}</span>
        <span className={`text-xs font-bold uppercase tracking-widest ${color}`}>{title} ({items.length})</span>
      </div>
      <div className="space-y-1">
        {show.map(h => (
          <div key={h.eodhd} className="flex items-center justify-between text-xs bg-surface-container-high/50 px-3 py-1.5 rounded">
            <div className="flex items-center gap-2">
              <span className="font-bold text-primary">{h.eodhd.split('.')[0]}</span>
              <ExchBadge exch={h.exch} />
              <span className="text-on-surface-variant truncate max-w-[150px]">{h.name}</span>
            </div>
            <span className="tabular font-medium">${h.value.toLocaleString('en-AU', { maximumFractionDigits: 0 })}</span>
          </div>
        ))}
        {items.length > 5 && (
          <button onClick={() => setExpanded(e => !e)} className="text-[10px] text-primary hover:underline pl-3">
            {expanded ? 'Show less' : `Show ${items.length - 5} more`}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SharesightImporter({ onImport, onClose, currentPortfolio }) {
  const [dragging,     setDragging]     = useState(false)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState(null)
  const [parsed,       setParsed]       = useState(null)
  const [includeBonds, setIncludeBonds] = useState(false)
  const [activeTab,    setActiveTab]    = useState('preview')
  const [currentFile,  setCurrentFile]  = useState(null)
  const fileRef = useRef()

  const diff = parsed && currentPortfolio?.length
    ? computeDiff(currentPortfolio, parsed.holdings)
    : null

  const changesCount = diff ? diff.added.length + diff.removed.length + diff.changed.length : 0

  const processFile = useCallback(async (file, bonds = includeBonds) => {
    if (!file) return
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['xlsx', 'xls'].includes(ext)) {
      setError('Please upload an Excel file (.xlsx) from ShareSight → Reports → Exposure Report → Export.')
      return
    }
    setCurrentFile(file)
    setLoading(true)
    setError(null)
    setParsed(null)
    try {
      const result = await parseXLSX(file, bonds)
      result.snapshotDate = extractDateFromFilename(file.name)
      result.fileName     = file.name
      setParsed(result)
      setActiveTab('preview')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [includeBonds])

  const toggleBonds = () => {
    const next = !includeBonds
    setIncludeBonds(next)
    if (currentFile) processFile(currentFile, next)
  }

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false)
    processFile(e.dataTransfer.files[0])
  }, [processFile])

  const handleConfirm = () => {
    if (!parsed) return
    onImport(parsed.holdings, parsed.total, parsed.snapshotDate)
    onClose()
  }

  const auCount      = parsed?.holdings.filter(h => h.exch === 'AU').length || 0
  const usCount      = parsed?.holdings.filter(h => h.exch === 'US').length || 0
  const euCount      = parsed?.holdings.filter(h => h.exch === 'EU').length || 0
  const guessCount   = parsed?.holdings.filter(h => h.guessed).length || 0

  const Tab = ({ id, label, badge }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`px-4 py-2 text-xs font-bold transition-colors flex items-center gap-1.5 ${
        activeTab === id ? 'text-primary border-b-2 border-primary' : 'text-on-surface-variant hover:text-on-surface'
      }`}
    >
      {label}
      {badge > 0 && <span className="bg-primary/10 text-primary text-[9px] px-1.5 py-0.5 rounded-full font-black">{badge}</span>}
    </button>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-surface-container rounded-xl border border-outline-variant/20 shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-outline-variant/15 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-lg">upload_file</span>
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight">Import ShareSight Holdings</h2>
              <p className="text-[11px] text-on-surface-variant mt-0.5">
                Combined sheet · direct holdings only · multi-portfolio summing
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-on-surface-variant hover:text-error transition-colors p-1">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Instructions (only before upload) */}
          {!parsed && !loading && !error && (
            <div className="bg-surface-container-low rounded-lg p-4 border border-outline-variant/10 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3">How to export from ShareSight</p>
              {[
                ['Reports', 'top nav'],
                ['Diversity → Exposure Report', ''],
                ['Select your portfolio', ''],
                ['Export → Excel', 'downloads as YYYY-MM-DD - Name - Exposure Report.xlsx'],
                ['Upload the file here', ''],
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
              <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
                onChange={e => { processFile(e.target.files[0]); e.target.value = '' }} />
              {loading ? (
                <div className="flex flex-col items-center gap-3">
                  <span className="material-symbols-outlined text-4xl text-primary animate-spin">progress_activity</span>
                  <p className="text-sm text-on-surface-variant">Parsing spreadsheet…</p>
                  <p className="text-xs text-on-surface-variant/60">Filtering within-ETF rows · summing multi-portfolio positions</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <span className={`material-symbols-outlined text-5xl transition-colors ${dragging ? 'text-primary' : 'text-on-surface-variant/30'}`}>cloud_upload</span>
                  <div>
                    <p className="font-bold text-on-surface">Drop your ShareSight Exposure Report here</p>
                    <p className="text-sm text-on-surface-variant mt-1">or click to browse · .xlsx accepted</p>
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
                <pre className="text-on-surface-variant whitespace-pre-wrap font-sans text-xs leading-relaxed">{error}</pre>
                <button onClick={() => { setError(null); setCurrentFile(null) }}
                  className="mt-3 text-primary text-xs font-bold hover:underline">Try again</button>
              </div>
            </div>
          )}

          {/* Parsed result */}
          {parsed && (
            <div className="space-y-4">

              {/* Success bar */}
              <div className="flex items-center justify-between bg-secondary/5 border border-secondary/20 rounded-lg px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-secondary">check_circle</span>
                  <div className="text-sm">
                    <span className="font-bold text-on-surface">{parsed.count} holdings parsed</span>
                    {parsed.snapshotDate && <span className="text-on-surface-variant ml-2">· snapshot {parsed.snapshotDate}</span>}
                    <span className="text-on-surface-variant ml-2">· {parsed.withinEtfCount.toLocaleString()} within-ETF rows filtered</span>
                  </div>
                </div>
                <button onClick={() => { setParsed(null); setError(null); setCurrentFile(null) }}
                  className="text-xs font-bold text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">refresh</span>Different file
                </button>
              </div>

              {/* Count cards */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { val: parsed.count, label: 'Total',  cls: 'bg-surface-container-low text-on-surface' },
                  { val: auCount,      label: 'ASX',    cls: 'bg-[#FF9F43]/10 text-[#FF9F43]' },
                  { val: usCount,      label: 'US',     cls: 'bg-[#4F8EF7]/10 text-[#4F8EF7]' },
                  { val: euCount,      label: 'EU',     cls: 'bg-[#B76DFF]/10 text-[#B76DFF]' },
                ].map(({ val, label, cls }) => (
                  <div key={label} className={`rounded-lg p-4 text-center ${cls}`}>
                    <p className="text-2xl font-black tabular">{val}</p>
                    <p className="text-[10px] uppercase tracking-widest opacity-70 mt-1">{label}</p>
                  </div>
                ))}
              </div>

              {/* Bond ETF toggle */}
              <div onClick={toggleBonds}
                className="flex items-center justify-between bg-surface-container-low border border-outline-variant/15 rounded-lg px-4 py-3 cursor-pointer hover:bg-surface-container-high transition-colors select-none">
                <div>
                  <p className="text-sm font-bold text-on-surface">Include bond ETFs</p>
                  <p className="text-xs text-on-surface-variant">TLT, IEI, BND, AGG, VGSH, GGOV, IAF — currently {includeBonds ? 'included' : 'excluded'}</p>
                </div>
                <div className={`w-11 h-6 rounded-full transition-colors relative ${includeBonds ? 'bg-primary' : 'bg-outline-variant'}`}>
                  <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${includeBonds ? 'translate-x-5' : 'translate-x-0.5'}`}></div>
                </div>
              </div>

              {/* Tabs */}
              <div className="border-b border-outline-variant/15 flex gap-1">
                <Tab id="preview"  label="Holdings"  badge={parsed.count} />
                {diff && <Tab id="diff" label="Changes" badge={changesCount} />}
                <Tab id="excluded" label="Excluded"  badge={parsed.excluded.length} />
                {guessCount > 0 && <Tab id="guessed" label="Check exchanges" badge={guessCount} />}
              </div>

              {/* Holdings preview */}
              {activeTab === 'preview' && (
                <div className="max-h-56 overflow-y-auto rounded-lg overflow-hidden border border-outline-variant/10">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-surface-container-high sticky top-0">
                      <tr>
                        <th className="px-4 py-2.5 font-bold uppercase tracking-widest text-on-surface-variant">#</th>
                        <th className="px-4 py-2.5 font-bold uppercase tracking-widest text-on-surface-variant">Ticker</th>
                        <th className="px-4 py-2.5 font-bold uppercase tracking-widest text-on-surface-variant">Name</th>
                        <th className="px-4 py-2.5 font-bold uppercase tracking-widest text-on-surface-variant text-right">Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/10 bg-surface-container-low">
                      {parsed.holdings.map((h, i) => (
                        <tr key={h.eodhd} className="hover:bg-surface-container transition-colors">
                          <td className="px-4 py-2 text-on-surface-variant">{i+1}</td>
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-primary">{h.eodhd.split('.')[0]}</span>
                              <ExchBadge exch={h.exch} />
                              {h.guessed && <span className="text-[8px] bg-error/10 text-error px-1 rounded">?exchange</span>}
                            </div>
                          </td>
                          <td className="px-4 py-2 text-on-surface-variant truncate max-w-[180px]">{h.name}</td>
                          <td className="px-4 py-2 text-right tabular font-medium">
                            ${h.value.toLocaleString('en-AU', { maximumFractionDigits: 0 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Diff */}
              {activeTab === 'diff' && diff && (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {changesCount === 0 ? (
                    <div className="text-center py-8 text-on-surface-variant text-sm">
                      <span className="material-symbols-outlined text-3xl block mb-2">check_circle</span>
                      No changes — portfolio is identical to current
                    </div>
                  ) : (
                    <>
                      <DiffSection title="New positions"  items={diff.added}   color="text-secondary" icon="add_circle"    />
                      <DiffSection title="Removed"        items={diff.removed} color="text-error"     icon="remove_circle"  />
                      <DiffSection title="Value changed"  items={diff.changed} color="text-primary"   icon="swap_vert"      />
                    </>
                  )}
                </div>
              )}

              {/* Excluded */}
              {activeTab === 'excluded' && (
                <div className="max-h-56 overflow-y-auto space-y-1">
                  <p className="text-xs text-on-surface-variant mb-2">
                    These were in the file but excluded. ETF wrappers are always excluded. Bond ETFs can be toggled above.
                  </p>
                  {parsed.excluded.map((h, i) => (
                    <div key={i} className="flex items-center justify-between text-xs bg-surface-container-low px-3 py-2 rounded">
                      <span className="font-bold text-on-surface-variant w-16">{h.code}</span>
                      <span className="text-on-surface-variant/60 truncate flex-1 mx-3">{h.name}</span>
                      <span className="text-on-surface-variant/50 italic text-[10px] flex-shrink-0">{h.reason}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Guessed exchanges */}
              {activeTab === 'guessed' && (
                <div className="max-h-56 overflow-y-auto space-y-1">
                  <p className="text-xs text-on-surface-variant mb-3">
                    These tickers had unrecognised exchanges and defaulted to US. Verify before applying.
                  </p>
                  {parsed.holdings.filter(h => h.guessed).map(h => (
                    <div key={h.eodhd} className="flex items-center justify-between text-xs bg-error/5 border border-error/10 px-3 py-2 rounded">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-primary">{h.eodhd}</span>
                        <ExchBadge exch={h.exch} />
                      </div>
                      <span className="text-on-surface-variant">{h.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-outline-variant/15 flex-shrink-0 gap-3">
          <button onClick={onClose} className="px-5 py-2 text-sm font-bold text-on-surface-variant hover:bg-surface-container-high rounded transition-colors">
            Cancel
          </button>
          <div className="flex items-center gap-3">
            {parsed && (
              <span className="text-xs text-on-surface-variant">
                Total: <span className="font-bold tabular text-on-surface">
                  ${parsed.total.toLocaleString('en-AU', { maximumFractionDigits: 0 })}
                </span>
              </span>
            )}
            <button onClick={handleConfirm} disabled={!parsed}
              className="px-6 py-2.5 bg-primary text-on-primary text-sm font-bold rounded hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">download_done</span>
              Apply {parsed ? `${parsed.count} Holdings` : 'Holdings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
