export default async function handler(req, res) {
  const tickers = (req.query.t || '').split(',').filter(Boolean)
  if (!tickers.length) return res.status(400).json({ error: 'No tickers' })

  const API_KEY = '69b3289b708b82.41254265'

  // EODHD bulk real-time: first ticker in path, rest in ?s= param (up to 50 per call)
  const fetchBatch = async (batch) => {
    const [first, ...rest] = batch
    const extra = rest.length ? `&s=${rest.join(',')}` : ''
    const url = `https://eodhd.com/api/real-time/${first}?api_token=${API_KEY}&fmt=json${extra}`
    try {
      const resp = await fetch(url)
      const data = await resp.json()
      const rows = Array.isArray(data) ? data : [data]
      return rows.map(r => [r.code, {
        ok: true,
        close: r.close,
        prev: r.previousClose,
        pct: r.change_p,
        timestamp: r.timestamp,
      }])
    } catch {
      return batch.map(t => [t, { ok: false }])
    }
  }

  // Batch into groups of 50
  const batches = []
  for (let i = 0; i < tickers.length; i += 50) {
    batches.push(tickers.slice(i, i + 50))
  }

  const results = await Promise.all(batches.map(fetchBatch))
  const out = Object.fromEntries(results.flat())

  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Access-Control-Allow-Origin', '*')
  return res.status(200).json(out)
}
