import React, { useState } from 'react'
import './TradingLab.css'

interface BacktestResult {
    totalReturn: number
    tradesSimulated: number
    risk: {
        sharpe: number
        maxDrawdown: number
        var95: number
    }
}

interface PaperOrder {
    id: string
    symbol: string
    side: string
    quantity: number
    price: number
    notional: number
    status: string
    executedAt: string
}

export const TradingLab: React.FC = () => {
    const [pricesText, setPricesText] = useState('')
    const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null)

    const [orderSymbol, setOrderSymbol] = useState('BTC')
    const [orderSide, setOrderSide] = useState<'buy' | 'sell'>('buy')
    const [orderQty, setOrderQty] = useState('1')
    const [orderPrice, setOrderPrice] = useState('50000')
    const [orders, setOrders] = useState<PaperOrder[]>([])
    const [status, setStatus] = useState('')

    const runBacktest = async () => {
        const prices = pricesText.split(',').map(p => parseFloat(p.trim())).filter(p => !isNaN(p))
        if (prices.length < 2) {
            setStatus('Enter at least 2 comma-separated prices.')
            return
        }
        // @ts-ignore
        const res = await window.raizen?.trading?.backtest?.({ prices })
        if (res?.ok && res.backtest) {
            setBacktestResult(res.backtest as unknown as BacktestResult)
            setStatus('')
        } else {
            setStatus(res?.reason || 'Backtest failed — check the backend is running.')
        }
    }

    const placePaperOrder = async () => {
        const qty = parseFloat(orderQty)
        const price = parseFloat(orderPrice)
        if (isNaN(qty) || isNaN(price) || qty <= 0 || price <= 0) {
            setStatus('Invalid quantity or price.')
            return
        }
        // @ts-ignore
        const res = await window.raizen?.trading?.paperOrder?.({
            symbol: orderSymbol.toUpperCase(),
            side: orderSide,
            quantity: qty,
            price,
        })
        if (res?.ok && res.order) {
            const order = res.order as unknown as PaperOrder
            setOrders(prev => [order, ...prev].slice(0, 30))
            setStatus(`Paper order ${order.id} placed.`)
        } else {
            setStatus(res?.reason || 'Order placement failed.')
        }
    }

    const fmt = (n: number) => (n * 100).toFixed(2) + '%'

    return (
        <div className="trading-container">
            <header className="trading-header">
                <h1>Quantitative Trading Lab</h1>
                <p>Backtest strategies and simulate paper orders in a safe sandbox.</p>
            </header>

            <div className="trading-grid">
                <section className="trading-card">
                    <h3>Strategy Backtester</h3>
                    <textarea
                        className="trading-textarea"
                        placeholder="Paste comma-separated prices, e.g: 100,102,98,107,115,110"
                        rows={4}
                        value={pricesText}
                        onChange={e => setPricesText(e.target.value)}
                    />
                    <button className="trading-btn" onClick={() => void runBacktest()}>Run Backtest</button>

                    {backtestResult && (
                        <div className="backtest-results">
                            <div className="backtest-metric">
                                <span>Total Return</span>
                                <strong style={{ color: backtestResult.totalReturn >= 0 ? '#22c55e' : '#ef4444' }}>
                                    {fmt(backtestResult.totalReturn)}
                                </strong>
                            </div>
                            <div className="backtest-metric">
                                <span>Trades Simulated</span>
                                <strong>{backtestResult.tradesSimulated}</strong>
                            </div>
                            <div className="backtest-metric">
                                <span>Sharpe Ratio</span>
                                <strong>{backtestResult.risk.sharpe.toFixed(3)}</strong>
                            </div>
                            <div className="backtest-metric">
                                <span>Max Drawdown</span>
                                <strong style={{ color: '#ef4444' }}>{fmt(backtestResult.risk.maxDrawdown)}</strong>
                            </div>
                            <div className="backtest-metric">
                                <span>VaR 95%</span>
                                <strong>{fmt(Math.abs(backtestResult.risk.var95))}</strong>
                            </div>
                        </div>
                    )}
                </section>

                <section className="trading-card">
                    <h3>Paper Order Desk</h3>
                    <div className="order-form">
                        <input className="trading-input" placeholder="Symbol (BTC, AAPL...)" value={orderSymbol} onChange={e => setOrderSymbol(e.target.value)} />
                        <select className="trading-select" value={orderSide} onChange={e => setOrderSide(e.target.value as 'buy' | 'sell')}>
                            <option value="buy">Buy</option>
                            <option value="sell">Sell</option>
                        </select>
                        <input className="trading-input" placeholder="Quantity" type="number" value={orderQty} onChange={e => setOrderQty(e.target.value)} />
                        <input className="trading-input" placeholder="Price (USD)" type="number" value={orderPrice} onChange={e => setOrderPrice(e.target.value)} />
                        <button className="trading-btn" onClick={() => void placePaperOrder()}>Place Paper Order</button>
                    </div>

                    <div className="order-log">
                        {orders.length === 0 && <p className="trading-muted">No orders yet.</p>}
                        {orders.map(o => (
                            <div key={o.id} className="order-row">
                                <span className={`order-side ${o.side}`}>{o.side.toUpperCase()}</span>
                                <span className="order-symbol">{o.symbol}</span>
                                <span>{o.quantity} @ ${o.price.toLocaleString()}</span>
                                <span className="order-status">{o.status}</span>
                            </div>
                        ))}
                    </div>
                </section>
            </div>

            {status && <p className="trading-status">{status}</p>}
        </div>
    )
}
