export async function fetchAllPrices(tickers) {
  const BATCH_SIZE = 30
  const batches = []
  for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
    batches.push(tickers.slice(i, i + BATCH_SIZE))
  }
  const results = await Promise.all(
    batches.map(b =>
      fetch(`/api/prices?s=${b.join(',')}`)
        .then(r => r.json())
        .catch(() => ({}))
    )
  )
  return Object.assign({}, ...results)
}
