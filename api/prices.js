export default async function handler(req, res) {
  const apiKey  = process.env.EODHD_API_KEY || '69b3289b708b82.41254265'
  if (!apiKey) return res.status(500).json({ error: 'Missing EODHD_API_KEY' })

  const s = req.query?.s || ''
  const tickers = s.split(',').map(t => t.trim()).filter(Boolean)
  if (!tickers.length) return res.status(400).json({ error: 'No tickers' })

  const fetchBatch = async (batch) => {
    const [first, ...rest] = batch
    const extra = rest.length ? `&s=${rest.join(',')}` : ''
    const url   = `https://eodhd.com/api/real-time/${first}?api_token=${apiKey}&fmt=json${extra}`
    try {
      const r    = await fetch(url)
      const data = await r.json()
      const rows = Array.isArray(data) ? data : [data]
      return rows.map(row => [row.code, {
        ok:    true,
        close: row.close,
        prev:  row.previousClose,
        pct:   row.change_p,
        name:  row.name || row.code,
      }])
    } catch {
      return batch.map(t => [t, { ok: false }])
    }
  }

  const batches = []
  for (let i = 0; i < tickers.length; i += 50) batches.push(tickers.slice(i, i + 50))
  const results = await Promise.all(batches.map(fetchBatch))
  const out = Object.fromEntries(results.flat())

  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Access-Control-Allow-Origin', '*')
  return res.status(200).json(out)
}
