'use strict'

const Database = require('better-sqlite3')
const path = require('path')
const { app } = require('electron')

// Initialize DB in userData folder
const dbPath = path.join(app.getPath('userData'), 'paxion-memory.db')
const db = new Database(dbPath)
db.pragma('journal_mode = WAL')

// Setup Schema
function initializeDatabase() {
    db.exec(`
    CREATE TABLE IF NOT EXISTS learning_logs (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      detail TEXT,
      source TEXT,
      newSkills TEXT,
      timestamp TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      eventType TEXT NOT NULL,
      hash TEXT NOT NULL,
      payload TEXT,
      timestamp TEXT
    );

    CREATE TABLE IF NOT EXISTS learning_v2_skills (
      skill TEXT PRIMARY KEY,
      confidence REAL NOT NULL,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS learning_v2_hypotheses (
      id TEXT PRIMARY KEY,
      skill TEXT NOT NULL,
      goal TEXT,
      recommendation TEXT,
      createdAt TEXT
    );

    CREATE TABLE IF NOT EXISTS learning_v2_skills_history (
      id TEXT PRIMARY KEY,
      skill TEXT NOT NULL,
      confidence REAL NOT NULL,
      version INTEGER NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS checkpoints (
      id TEXT PRIMARY KEY,
      scriptId TEXT NOT NULL,
      code TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS analytics_events (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      payload TEXT,
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS voice_settings (
      id TEXT PRIMARY KEY,
      voice TEXT,
      pitch REAL,
      rate REAL
    );

    CREATE TABLE IF NOT EXISTS plugins (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      manifest TEXT NOT NULL
    );

  `)
}

initializeDatabase()

// --- Learning Logs API ---
function insertLearningLog(entry) {
    const stmt = db.prepare('INSERT INTO learning_logs (id, title, detail, source, newSkills, timestamp) VALUES (?, ?, ?, ?, ?, ?)')
    stmt.run(
        entry.id,
        entry.title,
        entry.detail || '',
        entry.source || '',
        JSON.stringify(entry.newSkills || []),
        entry.timestamp
    )
}

function getLearningLogs(limit = 600) {
    const stmt = db.prepare('SELECT * FROM learning_logs ORDER BY timestamp ASC LIMIT ?')
    return stmt.all().map(row => ({
        ...row,
        newSkills: JSON.parse(row.newSkills)
    }))
}

// --- Learning V2 API ---
function upsertSkillConfidence(skill, confidence, updatedAt) {
    const current = db.prepare('SELECT version FROM learning_v2_skills_history WHERE skill = ? ORDER BY version DESC LIMIT 1').get(skill)
    const nextV = current ? current.version + 1 : 1

    // Deactivate previous
    db.prepare('UPDATE learning_v2_skills_history SET active = 0 WHERE skill = ?').run(skill)

    const stmt = db.prepare(`
    INSERT INTO learning_v2_skills_history (id, skill, confidence, version, active, updatedAt) 
    VALUES (?, ?, ?, ?, 1, ?) 
    `)
    stmt.run(`${skill}-v${nextV}`, skill, confidence, nextV, updatedAt)
}

function getAllSkillsConfidence() {
    const stmt = db.prepare('SELECT * FROM learning_v2_skills_history WHERE active = 1')
    const rows = stmt.all()
    const map = {}
    for (const row of rows) {
        map[row.skill] = row.confidence
    }
    return map
}

function rollbackSkill(skill) {
    const activeRow = db.prepare('SELECT version FROM learning_v2_skills_history WHERE skill = ? AND active = 1').get(skill)
    if (!activeRow || activeRow.version <= 1) return false

    db.prepare('DELETE FROM learning_v2_skills_history WHERE skill = ? AND version = ?').run(skill, activeRow.version)
    db.prepare('UPDATE learning_v2_skills_history SET active = 1 WHERE skill = ? AND version = ?').run(skill, activeRow.version - 1)
    return true
}

// Analytics API
function createAnalyticsEvent(type, payload) {
    const stmt = db.prepare('INSERT INTO analytics_events (id, type, payload, timestamp) VALUES (?, ?, ?, ?)');
    const id = `${type}-${Date.now()}`;
    stmt.run(id, type, JSON.stringify(payload || {}), new Date().toISOString());
    return { ok: true, id };
}

// Voice Settings API
function setVoiceSettings({ voice, pitch, rate }) {
    const id = 'default';
    const stmt = db.prepare('INSERT OR REPLACE INTO voice_settings (id, voice, pitch, rate) VALUES (?, ?, ?, ?)');
    stmt.run(id, voice || null, pitch || null, rate || null);
    return { ok: true };
}

function getVoiceSettings() {
    const stmt = db.prepare('SELECT * FROM voice_settings WHERE id = ?');
    return stmt.get('default') || {};
}

// Plugin Marketplace API
function registerPlugin({ id, name, description, manifest }) {
    const stmt = db.prepare('INSERT OR REPLACE INTO plugins (id, name, description, manifest) VALUES (?, ?, ?, ?)');
    stmt.run(id, name, description || '', JSON.stringify(manifest || {}));
    return { ok: true, id };
}

function listPlugins() {
    const stmt = db.prepare('SELECT id, name, description, manifest FROM plugins');
    return stmt.all().map(row => ({ ...row, manifest: JSON.parse(row.manifest) }));
}


// Checkpoint API
function createCheckpoint(scriptId, code) {
    const stmt = db.prepare('INSERT INTO checkpoints (id, scriptId, code, createdAt) VALUES (?, ?, ?, ?)');
    const id = `${scriptId}-${Date.now()}`;
    stmt.run(id, scriptId, code, new Date().toISOString());
    return { ok: true, id };
}

function getCheckpoints(scriptId) {
    const stmt = db.prepare('SELECT * FROM checkpoints WHERE scriptId = ? ORDER BY createdAt DESC');
    return stmt.all({ scriptId });
}
}

function insertV2Hypotheses(hypotheses) {
    db.exec('DELETE FROM learning_v2_hypotheses')
    if (!hypotheses || hypotheses.length === 0) return

    const insert = db.prepare('INSERT INTO learning_v2_hypotheses (id, skill, goal, recommendation, createdAt) VALUES (?, ?, ?, ?, ?)')
    const insertMany = db.transaction((hyps) => {
        for (const h of hyps) insert.run(h.id, h.skill, h.goal, h.recommendation, h.createdAt)
    })
    insertMany(hypotheses)
}

function getV2Hypotheses() {
    const stmt = db.prepare('SELECT * FROM learning_v2_hypotheses ORDER BY createdAt DESC')
    return stmt.all()
}

// --- Audit API ---
function insertAuditLog(entry) {
    const stmt = db.prepare('INSERT INTO audit_logs (id, eventType, hash, payload, timestamp) VALUES (?, ?, ?, ?, ?)')
    stmt.run(
        entry.id,
        entry.type || entry.eventType || 'unknown',
        entry.hash || '',
        JSON.stringify(entry.payload || {}),
        entry.timestamp || new Date().toISOString()
    )
}

function getAuditLogs(limit = 1000) {
    const stmt = db.prepare('SELECT * FROM audit_logs ORDER BY timestamp ASC LIMIT ?')
    return stmt.all().map(row => ({
        ...row,
        type: row.eventType,
        payload: JSON.parse(row.payload)
    }))
}

module.exports = {
    db,
    insertLearningLog,
    getLearningLogs,
    upsertSkillConfidence,
    getAllSkillsConfidence,
    insertV2Hypotheses,
    getV2Hypotheses,
    insertAuditLog,
    getAuditLogs,
    rollbackSkill,
    createAnalyticsEvent,
    getAnalyticsEvents,
    setVoiceSettings,
    getVoiceSettings,
    registerPlugin,
    listPlugins,
    createCheckpoint,
    getCheckpoints
};
