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

## Pivot Final Verification (F/G/H)
- Tool execution path uses privileged pipeline for approval-required actions.
- Privileged execution uses bounded timeout and audit linkage.
- Queue and audit traces include pipeline + queue reference data.
- Per-channel memory normalization is active for derived session memory.
- Audit anomaly signal emits `threat_detected` entries under repeated denied patterns.
- Audit timeline supports search, filter, pagination, and export.
- Cloud relay is denied when `cloudRelayEnabled` flag is false.
- Desktop adapter is denied when `desktopAdapterEnabled` flag is false.
- Local policy remains final authority for relay ingress and completion paths.

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
- v0.15.0-readiness-foundations: target workflow packs, execution session verification/rollback, observation capture, cross-app mission plans, learning graph snapshots, staged self-evolution pipelines, local vision/OCR jobs, and node:test coverage for pure readiness logic.
- v0.16.0-ocr-evidence: local OCR execution pipeline (Electron + Tesseract), OCR processing controls in Workspace, and hashed evidence artifact generation linked to execution sessions.
- v0.17.0-native-evidence-governance: native execution IPC engine with deterministic selector recovery, automatic per-step evidence hooks (state + screenshot + transcript), signed attestation chain records, universal rollback transaction executor, paginated graph query API, versioned target-pack compatibility profiles, governance signature gates for self-evolution promotion, and expanded readiness integration tests.
- v0.18.0-readiness-closure: automatic DOM extraction fallback in evidence hooks, attestation key status/rotation APIs, full operator controls for native action execution + rollback execution + graph paging queries + governance signature gates, version-aware target pack metadata inputs, and workspace-scale operational controls for long-running supervised sessions.
- v0.19.0-safe-domain-expansion-bootstrap: jurisdiction-aware compliance engine integration into main policy flow, secure device control-plane APIs (register/list/revoke), autonomous learning v2 update+hypothesis endpoints, trading backtest and paper-order endpoints, medical safety/confidence review endpoint, media generation queue endpoint, and expanded node:test coverage for new engines.
- v0.20.0-pivot-fgh-core: privileged-vs-normal execution pipeline split with timeout controls, feature-flag gated cloud relay and desktop adapter, relay local-policy ingress checks, per-channel memory normalization, searchable/exportable audit timeline, and anomaly-driven `threat_detected` audit signaling.
