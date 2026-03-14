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
