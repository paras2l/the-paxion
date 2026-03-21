import { useState } from 'react';

const DEMO_USER_ID = 'user001';
const DEMO_ITEMS = [
  { id: 'agent-1', label: 'GitHub Auto-Committer' },
  { id: 'skill-1', label: 'Excel Parsing Skill' },
  { id: 'doc-1', label: 'AI Prompt Engineering Guide' },
];

export function SharingPanel() {
  const [selected, setSelected] = useState(DEMO_ITEMS[0].id);
  const [sharedLinks, setSharedLinks] = useState<{ id: string; url: string }[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function handleShare() {
    const url = `${window.location.origin}/share/${selected}?from=${DEMO_USER_ID}`;
    setSharedLinks((prev) => [...prev, { id: selected, url }]);
  }

  function handleCopy(url: string, id: string) {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1200);
  }

  return (
    <div style={{ padding: 32, maxWidth: 480, margin: '0 auto' }}>
      <h2>Sharing Center</h2>
      <p>Generate shareable links for your agents, skills, or knowledge items.</p>
      <div style={{ margin: '18px 0' }}>
        <label style={{ fontWeight: 500 }}>Select Item to Share:</label>
        <select
          value={selected}
          onChange={e => setSelected(e.target.value)}
          style={{ marginLeft: 10, padding: 6, borderRadius: 6, border: '1px solid #444', background: '#222', color: '#fff' }}
        >
          {DEMO_ITEMS.map(item => (
            <option key={item.id} value={item.id}>{item.label}</option>
          ))}
        </select>
        <button
          onClick={handleShare}
          style={{ marginLeft: 14, borderRadius: 6, padding: '0 14px', background: '#635bff', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}
        >
          Generate Link
        </button>
      </div>
      <div style={{ margin: '18px 0' }}>
        <label style={{ fontWeight: 500 }}>Your Shareable Links:</label>
        {sharedLinks.length === 0 ? (
          <div style={{ color: '#aaa', fontSize: 15 }}>No links generated yet.</div>
        ) : (
          <ul style={{ margin: '8px 0 0 0', padding: 0, listStyle: 'none' }}>
            {sharedLinks.map((link, i) => (
              <li key={link.id + i} style={{ color: '#fff', fontSize: 15, background: '#181828', borderRadius: 6, padding: 6, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ flex: 1 }}>{link.url}</span>
                <button onClick={() => handleCopy(link.url, link.id + i)} style={{ borderRadius: 6, padding: '0 10px', background: '#2fa', color: '#222', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                  {copiedId === link.id + i ? 'Copied!' : 'Copy'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div style={{ fontSize: 15, color: '#aaa', marginTop: 18 }}>
        <p>Demo only. Integrate with backend for real sharing and access control.</p>
      </div>
    </div>
  );
}
