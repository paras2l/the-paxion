# Development Checkpoints

Use this file to protect continuity and prevent missing work.

## Repository
- Remote: https://github.com/paras2l/the-paxion.git
- Default branch: main

## Push policy
1. Complete a logical milestone.
2. Run quality checks.
3. Commit with a clear scope message.
4. Push to main or feature branch.
5. Confirm remote has the new commit.

## Minimum checkpoint checklist
- Build passes.
- Lint passes.
- Required docs updated.
- Changelog/release note entry added when needed.
- Git push succeeds.

## Fresh machine recovery
1. Clone repository.
2. Install Node.js 20.18+ (or newer LTS).
3. Run npm install.
4. Run npm run dev for web shell.
5. Run npm run desktop for packaged-mode desktop boot.

## Current milestone log
- v0.1.0-foundation: React + TypeScript + Electron base, five-tab shell, policy framing docs.
- v0.2.0-security-core: immutable policy guardrails, approval ticketing, and hash-chained audit logs wired into Access and Logs tabs.
- v0.3.0-library: persistent audit via IPC + Library document ingestion UI.
- v0.4.0-chat: local-first chat tab with Library retrieval context.
- v0.5.0-paxion-brain: no external API model path; local PaxionBrain and dark mission UI.
- v0.6.0-workspace-mvp: admin session hardening, atomic main-process decision+execution+audit flow, persisted approvals, and workspace mission executor queue.
- v0.7.0-access-voice: persisted capability registry in Access tab with policy blocking, plus local voice input/output controls in Chat.
- v0.8.0-knowledge-growth: persisted Library memory state and chunk-indexed PaxionBrain retrieval so capability scales with ingested books/documents.
- v0.9.0-desktop-relay: no-API ChatGPT/Google desktop relay added with admin session + capability gating.
- v0.10.0-skill-growth: learning timeline persistence, inferred skill acquisition, relay capture ingestion, and admin-gated growth capabilities.
- v0.11.0-video-and-bridges: allowlisted workspace tool runner, VS Code command bridge, media adapter job artifacts, and YouTube segmented learning planner with parallel batch opening.
- v0.12.0-automation-recorder: strict task-specific UI adapters, observe+learn templates by app type, and execution recorder panel with simple-language skill gain logs.
- v0.13.0-profiles-replay-suggest: real app adapter profiles, execution recorder replay mode, and skill-to-capability auto-suggestion engine.
- v0.13.1-automation-operability: profile variable injection, one-click replay record selection, and direct capability enable flow from suggestions.
- v0.14.0-automation-readiness: saved automation presets, replay preview approval tokens with step diffs, and ranked capability suggestions with prerequisite checks.
