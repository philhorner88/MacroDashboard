export const fmtCcy = (v) =>
  v == null ? '—' : '$' + Number(v).toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

export const fmt = (v, dp = 2) =>
  v == null ? '—' : Number(v).toLocaleString('en-AU', { minimumFractionDigits: dp, maximumFractionDigits: dp })

export const fmtPct = (v) =>
  v == null ? '—' : `${v >= 0 ? '+' : ''}${fmt(v)}%`
