export default async function handler(req, res) {
  const tickers = (req.query.t || '').split(',').filter(Boolean)
  const from    = req.query.from || ''
  const to      = req.query.to   || new Date().toISOString().split('T')[0]

  if (!tickers.length || !from) {
    return res.status(400).json({ error: 'tickers and from date required' })
  }

  const API_KEY = '69b3289b708b82.41254265'

  const fetchOne = async (ticker) => {
    try {
      const url = `https://eodhd.com/api/eod/${ticker}?api_token=${API_KEY}&fmt=json&from=${from}&to=${to}&period=d`
      const r = await fetch(url)
      const data = await r.json()
      if (!Array.isArray(data)) return [ticker, []]
      return [ticker, data.map(d => ({ date: d.date, close: d.adjusted_close ?? d.close }))]
    } catch {
      return [ticker, []]
    }
  }

  // Batch 10 at a time to avoid overwhelming EODHD
  const out = {}
  for (let i = 0; i < tickers.length; i += 10) {
    const batch   = tickers.slice(i, i + 10)
    const results = await Promise.all(batch.map(fetchOne))
    results.forEach(([t, data]) => { out[t] = data })
  }

  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate')
  res.setHeader('Access-Control-Allow-Origin', '*')
  return res.status(200).json(out)
}
