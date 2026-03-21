# Raizen Plugin & Agent API Guide

This document explains how to create, register, and manage plugins, skills, and agents in the Raizen platform.

---

## 1. Plugin/Agent Manifest Structure

Each plugin, skill, or agent is described by a manifest object:

```
{
  "id": "unique-id",
  "name": "Display Name",
  "description": "What this plugin/agent does.",
  "manifest": {
    "type": "agent" | "skill" | "tool" | "script",
    "entry": "main.js|ts|py|...",
    // For agents:
    "trigger": "command" | "event" | "schedule",
    "command": "optional-command-name",
    "logic": "function run(context) { ... }",
    "color": "#RRGGBB"
  }
}
```

- **type**: `agent` for user agents, `skill` for skills, `tool` for utilities, `script` for automation scripts.
- **entry**: Main file or function for the plugin/agent.
- **trigger**: (Agents) How the agent is activated.
- **command**: (Agents) Command string for command-triggered agents.
- **logic**: (Agents) JavaScript/TypeScript function body as a string.
- **color**: (Agents) UI accent color.

---

## 2. Registering Plugins/Agents/Skills

Use the Raizen API to register a new plugin/agent/skill:

```
window.raizen.ecosystem.register({
  id: 'my-agent-123',
  name: 'My Custom Agent',
  description: 'Does something useful.',
  manifest: {
    type: 'agent',
    trigger: 'command',
    command: 'myagent',
    logic: 'function run(context) { /* ... */ }',
    color: '#6C63FF'
  }
})
```

- Returns `{ ok: true }` on success.

---

## 3. Listing and Removing Agents/Skills

- **List all plugins/agents/skills:**
  ```
  window.raizen.ecosystem.list()
  // Returns: { ok: true, plugins: [ ... ] }
  ```
- **Remove by ID:**
  ```
  window.raizen.ecosystem.remove('my-agent-123')
  // Returns: { ok: true }
  ```

---

## 4. Skill Installation

Skills are installed from the Install Skills panel or via API:

```
window.raizen.ecosystem.register({
  id: 'web-research-skill',
  name: 'Web Research Skill',
  description: 'Enables advanced Google/Bing search.',
  manifest: {
    type: 'skill',
    entry: 'web-research-skill.js'
  }
})
```

---

## 5. Agent Logic Example

```
logic: `function run(context) {
  // context contains input, state, and utilities
  return { result: 'Hello, world!' };
}`
```

---

## 6. UI Integration

- Use the Create Agent wizard (Plugins tab) to build new agents visually.
- Use the Manage Agents panel to review and remove agents.
- Use the Install Skills panel to add new skills.

---

## 7. Best Practices

- Use unique IDs for each agent/skill.
- Keep logic functions simple and stateless when possible.
- Document your agent/skill for the community.
- Test agent logic in the wizard before saving.

---

For advanced customization, see the source code or contact the Raizen community.
