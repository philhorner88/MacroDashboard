export default async function handler(req, res) {
  const tickers = (req.query.t || '').split(',').filter(Boolean)

  if (!tickers.length) {
    return res.status(400).json({ error: 'No tickers provided' })
  }

  const API_KEY = '69b3289b708b82.41254265'
  const to   = new Date().toISOString().split('T')[0]
  const from = new Date(Date.now() - 10 * 86400000).toISOString().split('T')[0]

  const fetchOne = async (ticker) => {
    try {
      const url = `https://eodhd.com/api/eod/${ticker}?api_token=${API_KEY}&fmt=json&from=${from}&to=${to}`
      const resp = await fetch(url)
      const data = await resp.json()
      if (!Array.isArray(data) || data.length === 0) return [ticker, { ok: false }]
      const sorted = [...data].sort((a, b) => new Date(b.date) - new Date(a.date))
      const latest = sorted[0]
      const prev   = sorted[1]
      const pct    = prev ? ((latest.close - prev.close) / prev.close) * 100 : 0
      return [ticker, { ok: true, close: latest.close, prev: prev?.close ?? null, pct, date: latest.date }]
    } catch {
      return [ticker, { ok: false }]
    }
  }

  const results = await Promise.all(tickers.map(fetchOne))
  const out = Object.fromEntries(results)

  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate')
  res.setHeader('Access-Control-Allow-Origin', '*')
  return res.status(200).json(out)
}
