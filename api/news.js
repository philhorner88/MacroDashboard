export default async function handler(req, res) {
  const tickers = (req.query.t || '').split(',').filter(Boolean).slice(0, 10)
  const API_KEY = '69b3289b708b82.41254265'

  const fetchNews = async (ticker) => {
    try {
      const url = `https://eodhd.com/api/news?s=${ticker}&api_token=${API_KEY}&limit=5&fmt=json`
      const r = await fetch(url)
      const data = await r.json()
      return Array.isArray(data) ? data : []
    } catch {
      return []
    }
  }

  // If no tickers, fetch general market news
  const fetchGeneral = async () => {
    try {
      const url = `https://eodhd.com/api/news?api_token=${API_KEY}&limit=30&fmt=json`
      const r = await fetch(url)
      const data = await r.json()
      return Array.isArray(data) ? data : []
    } catch {
      return []
    }
  }

  const items = tickers.length
    ? (await Promise.all(tickers.map(fetchNews))).flat()
    : await fetchGeneral()

  // Deduplicate by link, sort by date desc
  const seen = new Set()
  const unique = items
    .filter(n => { if (seen.has(n.link)) return false; seen.add(n.link); return true })
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 40)

  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate')
  res.setHeader('Access-Control-Allow-Origin', '*')
  return res.status(200).json(unique)
}
