export async function fetchAllPrices(tickers) {
  // Split into batches of 30 to keep URLs short
  const batch = async (batch) => {
    const res = await fetch(`/api/prices?t=${batch.join(',')}`)
    return res.json()
  }

  const size    = 30
  const batches = []
  for (let i = 0; i < tickers.length; i += size) {
    batches.push(tickers.slice(i, i + size))
  }

  const results = await Promise.all(batches.map(batch))
  return Object.assign({}, ...results)
}
