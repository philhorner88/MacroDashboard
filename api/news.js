export default async function handler(req, res) {
  const apiKey  = process.env.EODHD_API_KEY || '69b3289b708b82.41254265'
  if (!apiKey) return res.status(500).json({ error: 'Missing EODHD_API_KEY' })

  const tickers = (req.query?.s || '').split(',').filter(Boolean).slice(0, 10)

  const fetchNews = async (ticker) => {
    try {
      const url  = `https://eodhd.com/api/news?s=${ticker}&api_token=${apiKey}&limit=5&fmt=json`
      const r    = await fetch(url)
      const data = await r.json()
      return Array.isArray(data) ? data : []
    } catch { return [] }
  }

  const items = tickers.length
    ? (await Promise.all(tickers.map(fetchNews))).flat()
    : (() => fetch(`https://eodhd.com/api/news?api_token=${apiKey}&limit=30&fmt=json`).then(r => r.json()).catch(() => []))()

  const seen   = new Set()
  const unique = (Array.isArray(items) ? items : [])
    .filter(n => { if (seen.has(n.link)) return false; seen.add(n.link); return true })
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 40)

  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate')
  res.setHeader('Access-Control-Allow-Origin', '*')
  return res.status(200).json(unique)
}
