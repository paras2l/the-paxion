'use strict'

function configureBroker(state, input) {
  const broker = {
    provider: String(input?.provider || 'paper').trim() || 'paper',
    accountId: String(input?.accountId || '').trim(),
    mode: String(input?.mode || 'paper').trim() || 'paper',
    updatedAt: new Date().toISOString(),
  }
  return {
    ok: true,
    broker,
    state: {
      ...state,
      broker,
      updatedAt: broker.updatedAt,
    },
  }
}

function previewLiveOrder(input) {
  const quantity = Math.max(0, Number(input?.quantity || 0))
  const price = Math.max(0, Number(input?.price || 0))
  const notional = quantity * price
  return {
    ok: true,
    preview: {
      provider: String(input?.provider || 'paper'),
      symbol: String(input?.symbol || '').toUpperCase(),
      side: String(input?.side || 'buy').toLowerCase(),
      quantity,
      price,
      notional,
      requiresAdminReview: true,
    },
  }
}

function executeBrokerOrder(state, input) {
  const preview = previewLiveOrder(input).preview
  const order = {
    id: `live-${Date.now().toString(36)}`,
    ...preview,
    status: 'queued-for-provider',
    createdAt: new Date().toISOString(),
  }
  return {
    ok: true,
    order,
    state: {
      ...state,
      orders: [...(Array.isArray(state?.orders) ? state.orders : []), order].slice(-200),
      updatedAt: order.createdAt,
    },
  }
}

module.exports = {
  configureBroker,
  previewLiveOrder,
  executeBrokerOrder,
}
