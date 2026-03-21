import React, { useState } from 'react';

const quickStartOptions = [
  {
    id: 'social',
    label: 'Grow social media',
    description: 'Automate posts, analyze engagement, and grow your online presence.'
  },
  {
    id: 'study',
    label: 'Study assistant',
    description: 'Organize notes, schedule study sessions, and get smart reminders.'
  },
  {
    id: 'work',
    label: 'Automate work',
    description: 'Automate repetitive tasks, manage projects, and boost productivity.'
  },
  {
    id: 'build',
    label: 'Build agents',
    description: 'Create, customize, and publish your own AI agents.'
  }
];

export const QuickStartWizard: React.FC<{ onComplete: (selected: string) => void }> = ({ onComplete }) => {
  const [selected, setSelected] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleStart = async () => {
    if (!selected) return;
    setLoading(true);
    // Simulate agent install/setup
    setTimeout(() => {
      setLoading(false);
      setSuccess(true);
      setTimeout(() => onComplete(selected), 1200);
    }, 1200);
  };

  return (
    <div style={{ maxWidth: 420, margin: '48px auto', background: '#fff', borderRadius: 12, boxShadow: '0 4px 32px #0002', padding: 32 }}>
      <h2 style={{ marginBottom: 24 }}>Welcome to Raizen!</h2>
      {step === 1 && (
        <>
          <p style={{ marginBottom: 16 }}>What do you want Raizen to do?</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {quickStartOptions.map(opt => (
              <button
                key={opt.id}
                onClick={() => setSelected(opt.id)}
                style={{
                  padding: '16px 20px',
                  borderRadius: 8,
                  border: selected === opt.id ? '2px solid #1976d2' : '1px solid #ccc',
                  background: selected === opt.id ? '#e3f2fd' : '#fafbfc',
                  fontWeight: 500,
                  textAlign: 'left',
                  cursor: 'pointer',
                  boxShadow: selected === opt.id ? '0 2px 8px #1976d222' : 'none'
                }}
              >
                <div style={{ fontSize: 18 }}>{opt.label}</div>
                <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>{opt.description}</div>
              </button>
            ))}
          </div>
          <button
            onClick={handleStart}
            disabled={!selected || loading}
            style={{ marginTop: 32, width: '100%', padding: '12px 0', borderRadius: 8, background: '#1976d2', color: '#fff', border: 'none', fontSize: 17, fontWeight: 600, cursor: selected && !loading ? 'pointer' : 'not-allowed', opacity: selected ? 1 : 0.7 }}
          >
            {loading ? 'Setting up...' : 'Get Started'}
          </button>
        </>
      )}
      {success && (
        <div style={{ marginTop: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🎉</div>
          <div style={{ fontSize: 18, fontWeight: 500 }}>Raizen just set up your first workflow!</div>
        </div>
      )}
    </div>
  );
};
