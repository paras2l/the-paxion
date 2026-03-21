import React, { useEffect, useState } from 'react';
import './Marketplace.css';

interface AgentPlugin {
  id: string;
  name: string;
  description: string;
  manifest: any;
}

export const ManageAgentsPanel: React.FC = () => {
  const [agents, setAgents] = useState<AgentPlugin[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchAgents() {
      setLoading(true);
      setError('');
      try {
        // @ts-ignore
        const res = await window.raizen.ecosystem.list();
        if (res.ok && Array.isArray(res.plugins)) {
          // Only show agent-type plugins
          setAgents(res.plugins.filter((p: any) => p.manifest?.type === 'agent'));
        } else {
          setError(res.reason || 'Failed to load agents.');
        }
      } catch (e) {
        setError('Error loading agents.');
      } finally {
        setLoading(false);
      }
    }
    fetchAgents();
  }, []);

  const handleRemove = async (id: string) => {
    if (!window.confirm('Remove this agent?')) return;
    setLoading(true);
    setError('');
    try {
      // @ts-ignore
      const res = await window.raizen.ecosystem.remove(id);
      if (res.ok) {
        setAgents((prev: AgentPlugin[]) => prev.filter((a: AgentPlugin) => a.id !== id));
        // @ts-ignore
        window.raizen?.analytics?.log?.({ type: 'agent_removed', payload: { id } });
      } else {
        setError(res.reason || 'Failed to remove agent.');
      }
    } catch (e) {
      setError('Error removing agent.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="marketplace-container">
      <header className="marketplace-header">
        <h1>Manage Agents</h1>
        <p>View, review, and remove your custom agents.</p>
      </header>
      {loading && <p>Loading...</p>}
      {error && <p className="lib-error">{error}</p>}
      <div className="marketplace-grid">
        {agents.length === 0 && !loading ? (
          <p className="muted">No custom agents found.</p>
        ) : (
          agents.map((agent: AgentPlugin) => (
            <div key={agent.id} className="plugin-card">
              <div className="plugin-icon" style={{ background: agent.manifest?.color || '#6C63FF' }}>
                {agent.name[0]}
              </div>
              <div className="plugin-info">
                <h3>{agent.name}</h3>
                <p>{agent.description}</p>
                <p style={{ fontSize: '0.8em', color: '#888' }}>ID: {agent.id}</p>
                <div style={{ marginTop: 8 }}>
                  <label style={{ marginRight: 16 }}>
                    <input type="checkbox" checked={agent.enabled !== false} onChange={() => handleToggleEnable(agent.id)} />
                    Enabled
                  </label>
                  <button style={{ marginRight: 8, background: '#444', color: '#fff', border: 'none', borderRadius: 6, padding: '0.3em 0.8em', cursor: 'pointer' }} onClick={() => handleShowAudit(agent.id)}>Audit Log</button>
                  <button
                    className="install-btn installed"
                    style={{ background: '#c22', color: '#fff' }}
                    onClick={() => handleRemove(agent.id)}
                    disabled={loading}
                  >
                    Remove
                  </button>
                </div>
                {/* Admin-only controls (stub) */}
                {/* {isAdmin && <button>Reset Agent</button>} */}
              </div>
            </div>
          ))
        )}
      </div>
      {/* Audit Log Modal */}
      {auditAgentId && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#23234a', borderRadius: 12, padding: 32, minWidth: 320 }}>
            <h3>Audit Log for Agent</h3>
            <ul style={{ color: '#fff', fontSize: '1em', marginBottom: 16 }}>
              {auditLogs.map((log, i) => (
                <li key={i}>{log.timestamp}: {log.action}</li>
              ))}
            </ul>
            <button style={{ background: '#444', color: '#fff', border: 'none', borderRadius: 6, padding: '0.4em 1em', cursor: 'pointer' }} onClick={handleCloseAudit}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
};
