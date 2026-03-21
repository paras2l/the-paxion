import React, { useState } from 'react';
import './Marketplace.css';

const SKILL_MARKET: Array<{
  id: string;
  name: string;
  description: string;
  manifest: any;
}> = [
  {
    id: 'web-research-skill',
    name: 'Web Research Skill',
    description: 'Enables advanced Google/Bing search and result summarization.',
    manifest: { type: 'skill', entry: 'web-research-skill.js' },
  },
  {
    id: 'excel-processing-skill',
    name: 'Excel Processing Skill',
    description: 'Adds spreadsheet parsing and data extraction capabilities.',
    manifest: { type: 'skill', entry: 'excel-processing-skill.js' },
  },
  {
    id: 'pdf-extraction-skill',
    name: 'PDF Extraction Skill',
    description: 'Extracts text and tables from PDF files using OCR.',
    manifest: { type: 'skill', entry: 'pdf-extraction-skill.js' },
  },
  {
    id: 'ai-prompt-engineering',
    name: 'AI Prompt Engineering',
    description: 'Improves LLM prompt design and reasoning traceability.',
    manifest: { type: 'skill', entry: 'ai-prompt-engineering.js' },
  },
];

export const InstallSkillPanel: React.FC = () => {
  const [installing, setInstalling] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const handleInstall = async (skill: typeof SKILL_MARKET[0]) => {
    setInstalling(skill.id);
    setMessage('');
    try {
      // @ts-ignore
      const res = await window.raizen.ecosystem.register(skill);
      if (res.ok) {
        setMessage(`${skill.name} installed successfully!`);
      } else {
        setMessage(res.reason || 'Failed to install skill.');
      }
    } catch (e) {
      setMessage('Error installing skill.');
    } finally {
      setInstalling(null);
    }
  };

  return (
    <div className="marketplace-container">
      <header className="marketplace-header">
        <h1>Install Skills</h1>
        <p>Browse and install new skills to expand Raizen's intelligence.</p>
      </header>
      {message && <p className="lib-error">{message}</p>}
      <div className="marketplace-grid">
        {SKILL_MARKET.map((skill) => (
          <div key={skill.id} className="plugin-card">
            <div className="plugin-icon" style={{ background: '#2a7cff' }}>{skill.name[0]}</div>
            <div className="plugin-info">
              <h3>{skill.name}</h3>
              <p>{skill.description}</p>
            </div>
            <button
              className="install-btn"
              onClick={() => handleInstall(skill)}
              disabled={installing === skill.id}
            >
              {installing === skill.id ? 'Installing...' : 'Install'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
