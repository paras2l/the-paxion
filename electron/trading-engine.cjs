'use strict'

function computeReturns(prices) {
  const values = Array.isArray(prices) ? prices.map((entry) => Number(entry)).filter((entry) => Number.isFinite(entry) && entry > 0) : []
  const returns = []
  for (let index = 1; index < values.length; index += 1) {
    returns.push((values[index] - values[index - 1]) / values[index - 1])
  }
  return returns
}

function calculateRiskMetrics(returns) {
  const rows = Array.isArray(returns) ? returns : []
  if (rows.length === 0) {
    return { sharpe: 0, maxDrawdown: 0, var95: 0 }
  }

  const avg = rows.reduce((acc, entry) => acc + entry, 0) / rows.length
  const variance = rows.reduce((acc, entry) => acc + (entry - avg) ** 2, 0) / rows.length
  const std = Math.sqrt(variance)
  const sorted = [...rows].sort((a, b) => a - b)
  const var95 = sorted[Math.max(0, Math.floor(sorted.length * 0.05) - 1)] || 0

  let equity = 1
  let peak = 1
  let maxDrawdown = 0
  for (const value of rows) {
    equity *= 1 + value
    peak = Math.max(peak, equity)
    maxDrawdown = Math.max(maxDrawdown, peak === 0 ? 0 : (peak - equity) / peak)
  }

  return {
    sharpe: std === 0 ? 0 : (avg / std) * Math.sqrt(252),
    maxDrawdown,
    var95,
  }
}

function runBacktest(input) {
  const prices = Array.isArray(input?.prices) ? input.prices : []
  const returns = computeReturns(prices)
  const risk = calculateRiskMetrics(returns)
  let equity = 1
  for (const value of returns) {
    equity *= 1 + value
  }

  return {
    returns,
    risk,
    totalReturn: equity - 1,
    tradesSimulated: Math.max(0, returns.length - 1),
  }
}

function placePaperOrder(input) {
  const quantity = Math.max(0, Number(input?.quantity || 0))
  const price = Math.max(0, Number(input?.price || 0))
  const side = String(input?.side || 'buy').toLowerCase()

  return {
    id: `paper-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    symbol: String(input?.symbol || 'UNKNOWN').toUpperCase(),
    side: side === 'sell' ? 'sell' : 'buy',
    quantity,
    price,
    notional: quantity * price,
    status: 'filled-paper',
    executedAt: new Date().toISOString(),
  }
}

module.exports = {
  computeReturns,
  calculateRiskMetrics,
  runBacktest,
  placePaperOrder,
}
