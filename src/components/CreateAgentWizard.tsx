import React, { useState } from 'react';
import './CreateAgentWizard.css';

const defaultAgent = {
  name: '',
  description: '',
  trigger: 'command',
  command: '',
  logic: '',
  color: '#6C63FF',
};

export const CreateAgentWizard: React.FC<{ onComplete?: () => void }> = ({ onComplete }) => {
  const [agent, setAgent] = useState(defaultAgent);
  const [step, setStep] = useState(0);
  const [darkMode, setDarkMode] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const steps = [
    'Agent Details',
    'Trigger',
    'Logic',
    'Finish',
  ];

  const handleNext = () => {
    if (step === 0 && (!agent.name.trim() || !agent.description.trim())) {
      setError('Name and description are required.');
      return;
    }
    if (step === 1 && agent.trigger === 'command' && !agent.command.trim()) {
      setError('Command is required for command trigger.');
      return;
    }
    if (step === 2 && !agent.logic.trim()) {
      setError('Logic is required.');
      return;
    }
    setError('');
    setStep(step + 1);
  };

  const handleBack = () => {
    setError('');
    setStep(step - 1);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      // Compose manifest for agent plugin
      const manifest = {
        type: 'agent',
        trigger: agent.trigger,
        command: agent.command,
        logic: agent.logic,
        color: agent.color,
      };
      const plugin = {
        id: `agent-${Date.now()}`,
        name: agent.name,
        description: agent.description,
        manifest,
      };
      // @ts-ignore
      const res = await window.raizen.ecosystem.register(plugin);
      if (res.ok) {
        if (onComplete) onComplete();
      } else {
        setError(res.reason || 'Failed to save agent.');
      }
    } catch (e) {
      setError('Error saving agent.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`create-agent-wizard${darkMode ? ' dark' : ''}`}>
      <div className="wizard-header">
        <h2>Create Agent</h2>
        <button className="mode-toggle" onClick={() => setDarkMode(!darkMode)}>
          {darkMode ? '☀️' : '🌙'}
        </button>
      </div>
      <div className="wizard-steps">
        {steps.map((label, i) => (
          <div key={label} className={`wizard-step${i === step ? ' active' : ''}`}>{label}</div>
        ))}
      </div>
      <div className="wizard-body">
        {step === 0 && (
          <>
            <label>
              Agent Name
              <input value={agent.name} onChange={e => setAgent({ ...agent, name: e.target.value })} maxLength={32} />
            </label>
            <label>
              Description
              <textarea value={agent.description} onChange={e => setAgent({ ...agent, description: e.target.value })} maxLength={120} />
            </label>
            <label>
              Accent Color
              <input type="color" value={agent.color} onChange={e => setAgent({ ...agent, color: e.target.value })} />
            </label>
          </>
        )}
        {step === 1 && (
          <>
            <label>
              Trigger Type
              <select value={agent.trigger} onChange={e => setAgent({ ...agent, trigger: e.target.value })}>
                <option value="command">Command</option>
                <option value="event">Event</option>
                <option value="schedule">Schedule</option>
              </select>
            </label>
            {agent.trigger === 'command' && (
              <label>
                Command
                <input value={agent.command} onChange={e => setAgent({ ...agent, command: e.target.value })} maxLength={32} />
              </label>
            )}
          </>
        )}
        {step === 2 && (
          <>
            <label>
              Agent Logic (JS/TS)
              <textarea value={agent.logic} onChange={e => setAgent({ ...agent, logic: e.target.value })} rows={8} placeholder="function run(context) { /* ... */ }" />
            </label>
          </>
        )}
        {step === 3 && (
          <div className="wizard-summary">
            <h3>Review</h3>
            <p><strong>Name:</strong> {agent.name}</p>
            <p><strong>Description:</strong> {agent.description}</p>
            <p><strong>Trigger:</strong> {agent.trigger} {agent.trigger === 'command' && `(${agent.command})`}</p>
            <p><strong>Logic:</strong></p>
            <pre>{agent.logic}</pre>
            <p><strong>Color:</strong> <span style={{ background: agent.color, padding: '0 1em' }}>{agent.color}</span></p>
          </div>
        )}
        {error && <div className="wizard-error">{error}</div>}
      </div>
      <div className="wizard-footer">
        {step > 0 && <button onClick={handleBack} disabled={saving}>Back</button>}
        {step < steps.length - 1 && <button onClick={handleNext} disabled={saving}>Next</button>}
        {step === steps.length - 1 && <button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Agent'}</button>}
      </div>
    </div>
  );
};
