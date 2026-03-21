import { useState } from 'react';

// Simulated Stripe checkout (replace with real Stripe integration in production)
export function PaymentsPanel() {
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  function handleCheckout() {
    setStatus('processing');
    setError(null);
    // Simulate async checkout
    setTimeout(() => {
      // Simulate random success/failure
      if (Math.random() > 0.15) {
        setStatus('success');
      } else {
        setStatus('error');
        setError('Payment failed. Please try again.');
      }
    }, 1500);
  }

  return (
    <div style={{ padding: 32, maxWidth: 420, margin: '0 auto' }}>
      <h2>Payments & Subscriptions</h2>
      <p>Purchase premium features, credits, or subscriptions securely.</p>
      <div style={{ margin: '24px 0' }}>
        <button
          onClick={handleCheckout}
          disabled={status === 'processing' || status === 'success'}
          style={{
            background: '#635bff',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '0.7em 2em',
            fontSize: 18,
            cursor: status === 'processing' || status === 'success' ? 'not-allowed' : 'pointer',
            opacity: status === 'processing' || status === 'success' ? 0.7 : 1,
          }}
        >
          {status === 'idle' && 'Buy Now'}
          {status === 'processing' && 'Processing...'}
          {status === 'success' && 'Payment Complete!'}
        </button>
        {status === 'error' && (
          <div style={{ color: '#e53e3e', marginTop: 12 }}>{error}</div>
        )}
        {status === 'success' && (
          <div style={{ color: '#38a169', marginTop: 12 }}>Thank you for your purchase!</div>
        )}
      </div>
      <div style={{ fontSize: 15, color: '#aaa' }}>
        <p>Demo only. Integrate with Stripe for real payments.</p>
      </div>
    </div>
  );
}
