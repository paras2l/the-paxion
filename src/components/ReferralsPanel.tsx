import { useState } from 'react';

function generateReferralCode(userId: string) {
  return `${userId}-${Math.random().toString(36).slice(2, 10)}`;
}

const DEMO_USER_ID = 'user001';

export function ReferralsPanel() {
  const [referralCode] = useState(() => generateReferralCode(DEMO_USER_ID));
  const [referred, setReferred] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(`${window.location.origin}/signup?ref=${referralCode}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  function simulateReferral() {
    setReferred((prev) => [...prev, `user${100 + prev.length}`]);
  }

  return (
    <div style={{ padding: 32, maxWidth: 420, margin: '0 auto' }}>
      <h2>Referral Program</h2>
      <p>Invite friends and earn rewards for every successful signup.</p>
      <div style={{ margin: '18px 0' }}>
        <label style={{ fontWeight: 500 }}>Your Referral Link:</label>
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <input
            type="text"
            value={`${window.location.origin}/signup?ref=${referralCode}`}
            readOnly
            style={{ flex: 1, padding: 6, borderRadius: 6, border: '1px solid #444', background: '#222', color: '#fff' }}
          />
          <button onClick={handleCopy} style={{ borderRadius: 6, padding: '0 14px', background: '#635bff', color: '#fff', border: 'none', cursor: 'pointer' }}>
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>
      <div style={{ margin: '18px 0' }}>
        <label style={{ fontWeight: 500 }}>Referred Users:</label>
        {referred.length === 0 ? (
          <div style={{ color: '#aaa', fontSize: 15 }}>No referrals yet.</div>
        ) : (
          <ul style={{ margin: '8px 0 0 0', padding: 0, listStyle: 'none' }}>
            {referred.map((u, i) => (
              <li key={u} style={{ color: '#fff', fontSize: 15, background: '#181828', borderRadius: 6, padding: 6, marginBottom: 4 }}>{u}</li>
            ))}
          </ul>
        )}
        <button onClick={simulateReferral} style={{ marginTop: 10, borderRadius: 6, padding: '0 14px', background: '#2fa', color: '#222', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
          Simulate Referral
        </button>
      </div>
      <div style={{ margin: '18px 0' }}>
        <label style={{ fontWeight: 500 }}>Rewards:</label>
        <div style={{ color: '#ffd700', fontSize: 16, marginTop: 6 }}>
          {referred.length * 5} credits earned
        </div>
        <div style={{ color: '#aaa', fontSize: 13, marginTop: 2 }}>
          (5 credits per referral)
        </div>
      </div>
      <div style={{ fontSize: 15, color: '#aaa', marginTop: 18 }}>
        <p>Demo only. Integrate with backend for real tracking.</p>
      </div>
    </div>
  );
}
