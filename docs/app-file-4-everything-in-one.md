# App File 4 - Everything In One

This document is the one-file project reference for The Paxion pivot work. It is designed as a fast handoff context for future coding sessions and coding agents.

## 1) Product Snapshot

- Product: The Paxion
- Goal: Build a secure, policy-bound, modular assistant platform with premium control UI, multi-model routing, and multi-channel gateway support.
- Strategy: Preserve the existing immutable policy spine and rewrite/upgrade UI plus gateway in phased rollout.
- Naming: Product naming for the pivot remains intentionally deferred.

## 2) Non-Negotiable Rules

- The boundary policy source remains immutable.
- All sensitive or privileged actions stay policy-gated and audit-linked.
- New modules stay behind feature flags until parity and regressions pass.
- Keep backward compatibility while migration shims exist.
- Remove legacy paths only after verified parity.

## 3) Current Architecture Direction

Primary service boundaries being used:

- control-ui: dashboard and operator surfaces
- orchestrator: request orchestration and flow control
- model-router: provider abstraction, routing profiles, fallback logic
- channel-gateway: channel adapter contracts and normalization
- audit-memory: append-only logs, retrieval/session memory, anomaly signals

Cross-cutting enforcement layers:

- policy adapter over existing policy core
- approval ticket gate for privileged actions
- capability registry gates
- append-only audit chain

## 4) UI Rewrite Target (Full Rewrite Mode)

Old shell is being replaced:

- Remove old five-tab shell: Chat, Library, Logs, Workspace, Access
- Replace with modular control surfaces: Overview, Channels, Models, Policy, Audit

Expected UI behaviors:

- Card-based operational status surfaces
- Approval queue panel
- Policy decision preview panel
- Searchable audit timeline panel
- Responsive desktop/mobile behavior

## 5) Model Router MVP

Core requirements:

- Provider abstraction with persistent user-supplied key config
- Routing profile selection logic
- Fallback chain on provider outage/failure
- Provider health checks
- Redacted provider status in UI (never expose secrets)

## 6) Channel Gateway MVP

Canonical gateway requirements:

- Canonical message event schema
- Stable adapter contracts
- Required first adapters: WebChat, Telegram, Discord, WhatsApp
- Channel allowlists and mention controls
- Session isolation by channel/context

## 7) Privileged Execution Pipeline

Required behavior:

- Privileged actions require approval-ticket checks
- Execution uses a bounded queue with timeout handling
- Every privileged execution links to audit records
- Normal response flow and privileged execution flow are separated

## 8) Memory and Audit Hardening

Required behavior:

- Normalize per-channel session memory format
- Keep append-only audit semantics
- Add anomaly alerting over audit/behavior signals
- Expose searchable audit timeline in control UI

## 9) Optional Hybrid Relay and Desktop Experimental Adapter

Rules:

- Local policy authority remains final decision gate
- Optional cloud relay can forward ingress only, no bypass rights
- Desktop ChatGPT direct control remains disabled-by-default experimental module

## 10) Security and Compliance Baseline

Must remain true after each milestone:

- Protected path policy decisions match pre-pivot outcomes
- Boundary folder protections stay untouched
- Approval-gated actions cannot bypass policy
- Audit remains append-only and traceable
- Compliance/legal-aware checks still run in policy path

## 11) Verification Checklist (Release Gate)

- Security baseline regression passes
- Frontend modular dashboard + approval queue renders without runtime break
- Router health and fallback verified with at least two providers
- Channel normalization verified for all enabled adapters
- Privileged action requires ticket and writes full audit trail
- Hybrid relay cannot execute privileged action without local policy approval

## 12) Implementation Status Model

Use this status model in planning and commits:

- A: Security spine freeze
- B: Modular architecture bootstrap
- C: Premium frontend foundation
- D: Model router MVP
- E: Channel gateway MVP
- F: Tool queue and policy-bound approvals
- G: Memory and audit hardening
- H: Optional relay and desktop experimental adapter

Current working assumption from latest planning:

- A-E: completed or near-complete
- F-G: remaining core implementation
- H: remaining optional implementation
- Final checks/docs: remaining

## 13) File Responsibility Map

- src/security/policy.ts: policy behavior and stable adapter surface
- boundary/policy-boundary.cjs: immutable protected policy boundary source
- src/App.tsx: modular view containers and UI state domains
- src/App.css: design-token-driven premium layout system
- src/paxion.d.ts: typed API contracts for router and gateway
- relay/server.cjs: gateway coordinator endpoints
- docs/paxion-master-brief.md: source-of-truth product direction
- docs/development-checkpoints.md: milestone checkpoint log and continuity

## 14) Feature Flag and Migration Rules

- New modules default to feature-flag off until validated.
- Keep migration shim path to avoid breaking old entry paths during rollout.
- Only remove legacy paths after parity evidence is recorded.

## 15) Commit and Push Policy

Milestone workflow:

1. Finish one logical milestone slice.
2. Run checks and targeted regression tests.
3. Update docs if architecture or direction changed.
4. Commit with clear milestone scope.
5. Push and confirm remote commit exists.

Suggested milestone commit scopes for remaining work:

- milestone: phase-f privileged queue and approval pipeline
- milestone: phase-g memory and audit hardening
- milestone: phase-h optional relay and desktop experimental toggle
- milestone: final regression gates and docs parity

## 16) Quick Start for New Coding Sessions

When starting a new session, do this first:

1. Read this file fully.
2. Read docs/paxion-master-brief.md for product constraints.
3. Read docs/development-checkpoints.md for latest milestone state.
4. Inspect feature flags and migration shims before any refactor.
5. Confirm policy and boundary behavior are unchanged before merging.

## 17) Scope Guardrails

Out of scope unless explicitly approved:

- Any bypass of immutable boundary protections
- Ungated privileged execution paths
- Silent autonomous external actions without approval/audit
- Unreviewed removal of migration compatibility before parity

## 18) Update Rule For This File

Update this file whenever one of the following changes:

- architecture boundaries
- required channel list
- model router behavior
- security gates or approval flow
- milestone status A-H
- release verification criteria

This file should stay concise, accurate, and implementation-oriented so any future coding agent can immediately understand the system and continue safely.

## 19) Device Expansion (M1-M7) Kickoff

Cross-device parity rollout has started with a dedicated tracker:

- docs/device-expansion-m1-m7.md

Current state:

- M1 started in code: shared device profile derivation and action routing mode decisions.
- M2-M7 staged: mobile/tablet hardening, secure delegation queue, call/channel parity, smart-glass mode, multilingual voice, observability.

Execution model for cross-device requests:

- direct: action executes locally on current device.
- delegated-desktop: action is routed to desktop worker runtime.
- provider-backed: action uses configured provider or cloud path.
- denied: blocked by capability/feature/policy constraints.
