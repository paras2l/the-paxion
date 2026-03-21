import React, { useState } from 'react';

/**
 * PluginCertificationPanel
 *
 * This panel allows creators to submit their plugins for certification, view certification status, and see feedback from the review team.
 *
 * Features:
 * - Submission form for plugin details and upload
 * - Certification status tracking (e.g., Pending, Approved, Rejected)
 * - Review feedback display
 * - Demo logic only (no real backend)
 */

const initialCertifications = [
  {
    id: 'plugin-1',
    name: 'Super Search',
    version: '1.0.0',
    status: 'Approved',
    feedback: 'Meets all guidelines. Great job!',
  },
  {
    id: 'plugin-2',
    name: 'Auto Formatter',
    version: '0.9.2',
    status: 'Pending',
    feedback: '',
  },
];

export default function PluginCertificationPanel() {
  const [certifications, setCertifications] = useState(initialCertifications);
  const [pluginName, setPluginName] = useState('');
  const [pluginVersion, setPluginVersion] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [submitMessage, setSubmitMessage] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pluginName || !pluginVersion) {
      setSubmitMessage('Please enter plugin name and version.');
      return;
    }
    setCertifications([
      ...certifications,
      {
        id: `plugin-${Date.now()}`,
        name: pluginName,
        version: pluginVersion,
        status: 'Pending',
        feedback: '',
      },
    ]);
    setPluginName('');
    setPluginVersion('');
    setUploadFile(null);
    setSubmitMessage('Plugin submitted for certification!');
  }

  return (
    <div style={{ padding: 24 }}>
      <h2>Plugin Certification</h2>
      <p>Submit your plugin for official certification. Certified plugins are featured in the marketplace and gain user trust.</p>
      <form onSubmit={handleSubmit} style={{ marginBottom: 24 }}>
        <div style={{ marginBottom: 8 }}>
          <label>
            Plugin Name:
            <input
              type="text"
              value={pluginName}
              onChange={e => setPluginName(e.target.value)}
              style={{ marginLeft: 8 }}
              required
            />
          </label>
        </div>
        <div style={{ marginBottom: 8 }}>
          <label>
            Version:
            <input
              type="text"
              value={pluginVersion}
              onChange={e => setPluginVersion(e.target.value)}
              style={{ marginLeft: 8 }}
              required
            />
          </label>
        </div>
        <div style={{ marginBottom: 8 }}>
          <label>
            Upload File:
            <input
              type="file"
              onChange={e => setUploadFile(e.target.files ? e.target.files[0] : null)}
              style={{ marginLeft: 8 }}
            />
          </label>
        </div>
        <button type="submit">Submit for Certification</button>
        {submitMessage && <span style={{ marginLeft: 16, color: 'green' }}>{submitMessage}</span>}
      </form>
      <h3>Certification Status</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>Plugin</th>
            <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>Version</th>
            <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>Status</th>
            <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>Feedback</th>
          </tr>
        </thead>
        <tbody>
          {certifications.map(cert => (
            <tr key={cert.id}>
              <td style={{ borderBottom: '1px solid #eee' }}>{cert.name}</td>
              <td style={{ borderBottom: '1px solid #eee' }}>{cert.version}</td>
              <td style={{ borderBottom: '1px solid #eee' }}>{cert.status}</td>
              <td style={{ borderBottom: '1px solid #eee' }}>{cert.feedback || <em>—</em>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
