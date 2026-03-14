# The Paxion

Desktop-first personal AI assistant foundation.

## Current status
- Milestone: `v0.1.0-foundation`
- Stack: React + TypeScript + Vite + Electron
- Included: five-tab shell (Chat, Library, Logs, Workspace, Access), policy framing, continuity docs

## Required source-of-truth docs
- `docs/paxion-master-brief.md`
- `docs/development-checkpoints.md`

## Local development
1. Install dependencies:

```bash
npm install
```

2. Run web shell:

```bash
npm run dev
```

3. Build and run desktop shell:

```bash
npm run desktop
```

## Web and cloud deployment

Hosted web/PWA deployment and cloud relay setup are documented in [docs/web-and-cloud-deployment.md](d:/Antigravity/amazing/docs/web-and-cloud-deployment.md).

Recommended free setup:

1. Vercel for the installable web app
2. Render for the cloud relay backend

## Optional desktop dev server flow
Start Vite, then in another terminal run:

```bash
set PAXION_DEV_SERVER_URL=http://localhost:5173 && electron .
```

## Checkpoint workflow
1. Complete a milestone.
2. Run:

```bash
npm run build
npm run lint
```

3. Commit and push to the GitHub remote.
4. Update docs when requirements change.
