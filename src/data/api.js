import { API_KEY } from './portfolio'

const fromDate = (() => {
  const d = new Date()
  d.setDate(d.getDate() - 8)
  return d.toISOString().slice(0, 10)
})()
const toDate = new Date().toISOString().slice(0, 10)

export async function fetchTicker(ticker) {
  try {
    const url = `https://eodhd.com/api/eod/${ticker}?api_token=${API_KEY}&fmt=json&from=${fromDate}&to=${toDate}`
    const res = await fetch(url)
    const data = await res.json()
    if (Array.isArray(data) && data.length >= 2) {
      const prev = data[data.length - 2]
      const curr = data[data.length - 1]
      const pct = ((curr.close - prev.close) / prev.close) * 100
      return { ticker, close: curr.close, prev: prev.close, pct: Math.round(pct * 100) / 100, date: curr.date, ok: true }
    }
    return { ticker, ok: false }
  } catch {
    return { ticker, ok: false }
  }
}

export async function fetchAllPrices(tickers) {
  const results = await Promise.all(tickers.map(fetchTicker))
  return results.reduce((map, r) => {
    if (r.ok) map[r.ticker] = r
    return map
  }, {})
}
