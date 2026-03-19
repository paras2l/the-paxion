# The Paxion Master Brief

This file is the single source of truth for what The Paxion is and what it is being built to become.

## Product identity
- Name: The Paxion
- Owner/Admin profile: Paro the Chief
- Format: Desktop-first personal AI assistant with controlled web and local integrations
- Goal: Build a Jarvis-like personal system in phases, starting with a secure foundation

## Core boundaries
1. The assistant must follow explicit owner commands within policy constraints.
2. The assistant must not access non-approved devices, files, or platforms.
3. Friendly and concise technical interaction style.
4. Harmful or illegal actions are blocked by default; sensitive lawful security actions require admin verification.
5. The assistant must enforce legal-awareness and policy checks.
6. Permission-required actions must request approval.
7. Normal chat actions can run without repeated prompts.
8. Interaction should remain stable, neutral, and technical.
9. Development changes must be logged in simple language for admin review.
10. Logs are append-only and admin-only.

## Required app tabs
1. Chat: text and voice interface.
2. Library: add books/documents, ingest approved web links, retrieve knowledge for active tasks.
3. Logs: admin-only audit records.
4. Workspace: multi-project workflow area.
5. Access: integration permission manager with grant/revoke controls.

## Capability direction
- Phase evolution from basic controlled assistant to broader automation.
- Knowledge-first operation: learn from library, approved sources, and structured retrieval.
- Build for explainability: action previews, source citations, and traceable decisions.
- Keep local control as default and never allow silent self-escalation.

## Security enforcement baseline
- Two-codeword model: standard sensitive operations use admin codeword "paro the chief"; master-gated operations (previously permanently blocked) now require the secret master codeword "paro the master" to proceed.
- Master-gated actions include: security policy disable, audit delete, data exfiltration paths, defense disable, and any request matching harmful-operation keyword patterns.
- Without the master codeword, master-gated actions are blocked with a clear rejection message.
- Controlled self-coding upgrade: with admin verification ("paro the chief") and approval flow, the app can rewrite or implant new features across app code (for example voice generation) to expand capability.
- Immutable policy boundary is now separated into a dedicated boundary folder; boundary rules and codeword relay logic inside it cannot be rewritten by generated code under any codeword, including master codeword.
- Sensitive operations require admin verification and explicit approval ticketing.
- Audit is append-only and hash-chained to make tampering visible.
- Jurisdiction-aware compliance checks still apply for regional legal rules and review categories.

## Execution integrity baseline
- Main-process authority: sensitive action finalization is enforced in Electron main process.
- Admin session gate: sensitive operations require active admin session plus codeword verification.
- Atomic trusted flow: policy decision, execution, and audit write happen in one main-process action path.
- Approval tickets are persisted with expiry cleanup on restart.

## Workspace mission baseline
- Workspace includes mission planning with generated execution steps.
- Supports dry-run policy preview before execution.
- Supports per-step execution and queue execution through guarded main-process action endpoint.
- Step timeline shows status and execution outcomes for each mission step.

## Access and voice baseline
- Access tab now controls a persisted capability registry (enable/disable execution abilities).
- Policy decisions can be blocked by disabled capabilities (admin-managed).
- Chat includes local voice input/output controls (no external API dependency).
- Voice features respect Access capability toggles.
- New assistant runtime controls now include Chat Mode <-> Voice Mode switching.
- Voice mode now supports continuous wake-driven command flow with configurable wake phrase (default: "paxion wakeup").
- Close-to-tray runtime keeps Paxion alive in background so wake phrase listening continues when window is closed.
- Emergency call relay capability is now available for voice commands (desktop dialer relay first; provider-backed telephony can be added later).
- Voice command execution still passes through admin/policy gates for sensitive actions.

## Mobile companion baseline
- Paxion can now run as a browser-based companion on mobile devices (responsive web runtime).
- Mobile companion supports voice/chat interactions where browser speech APIs are available.
- Desktop-only capabilities (tray runtime, native automation, system dialer relay) stay in Electron runtime for safety and OS integration.
- Mobile installability baseline is now enabled through a web manifest + service worker companion profile.

## Pro orchestration baseline
- Voice call system now supports provider routing modes: desktop relay, SIP client handoff, and Twilio direct API call mode.
- Call provider state is persisted and admin-configurable; emergency voice call relay remains capability-gated and auditable.
- Twilio/SIP provider credentials now have encrypted-at-rest storage using OS secure storage primitives.
- Workflow engine now generates AI workflow plans directly from owner-provided knowledge and goal statements.
- Terminal orchestration now includes command planning + guarded execution through safe allowlists and policy-signed custom command packs.
- Creative lab now generates cross-domain research hypotheses and next-step experiment loops from supplied knowledge corpora.
- All new orchestration paths are still policy-bound, audit-anchored, and designed for iterative knowledge growth over time.

## Secure mobile bridge baseline
- Mobile-to-desktop command bridge is now available as an admin-controlled local server endpoint.
- Remote commands from phone enter a pending queue and require approval-ticket confirmation before execution.
- Bridge requests include lifecycle status (pending/approved/rejected/executed) and remain auditable.
- Bridge runtime has start/stop/status controls with shared secret protection and persisted configuration.
- Bridge secret rotation and one-time remote command tokens are now available for tighter remote-session control.

## Pivot F/G/H hardening baseline
- Sensitive actions now run through a distinct privileged execution pipeline with bounded timeout handling.
- Queue-to-audit linkage now carries pipeline context and queue references for traceability.
- Cloud relay and desktop adapter pathways are now feature-flag gated and default to disabled for safer rollout.
- Relay ingress now includes explicit local-policy checks before queueing remote requests.
- Audit timeline now supports search/filter/pagination/export, and anomaly patterns emit threat-detected audit events.
- Per-channel session memory now uses a normalized schema for consistent retrieval context.

## Cross-device parity kickoff baseline
- Device-aware routing core now classifies runtime as desktop, mobile, tablet, or smart-glass.
- Action route planning now emits deterministic execution mode (direct, delegated-desktop, provider-backed, denied).
- Mobile companion now surfaces active route mode visibility so operators can see when desktop delegation is required.
- M2-M7 execution remains staged: tablet UX hardening, secure delegation lifecycle, channel/call parity, smart-glass voice mode, multilingual voice stack, and reliability telemetry.

## Cross-device parity M2/M3 kickoff baseline
- Mobile companion now has persisted session recovery for key assistant and action context state.
- Delegated desktop execution queue now tracks lifecycle states with correlation IDs for traceability.
- Delegated approval path now enforces admin session + codeword verification before running privileged queued actions.
- Delegated queue transitions are audit-linked for later timeline analysis.

## Advanced autonomy foundations
- Advanced governance now includes policy-diff simulation, staged canary rollout planning, and anomaly-driven rollback recommendations.
- Live broker module foundation now includes provider configuration, live-order preview, and gated broker order execution staging.
- Clinical validation module now supports evidence bundles and external reviewer validation records.
- Science toolchain now supports theorem planning, simulation planning, and combined research-program synthesis.
- Voice quality stack now tracks duplex mode, interruption strategy, persona memory profile, and prosody profile.
- Native wake-word adapter foundation now exists as a configurable runtime layer separate from browser speech APIs.
- Long-horizon planner/executor foundation now supports multi-horizon plans and validation-loop cycles.
- Device ecosystem layer now supports secure adapter registration for phones, IoT, car, and wearables.
- Robotics layer now supports actuator registration and safety-first actuation planning.
- Secret vault abstraction now supports future enterprise vault/HSM provider registration beyond local secure storage.
- Multimodal perception foundation now supports scene graph generation and realtime grounding records.

## Knowledge growth baseline
- Library ingestion is now persisted locally so learned documents survive restarts.
- Brain retrieval now scans ranked text chunks across top-matched documents for better recall.
- Library tab shows growth telemetry (docs, words, chunk index estimate, last sync).
- Capability growth is tied directly to owner-provided books/documents.

## Optional external connectors
- No API connector mode: ChatGPT and Google access run through desktop browser relay only.
- Paxion opens ChatGPT/Google pages with explicit permission and active admin session.
- User performs the same human flow (read/search/chat), then pastes approved knowledge back into Library/Chat.
- Local mode remains primary and always available.

## Skill growth and evolution baseline
- Paxion tracks learned skills from documents, relay captures, and research actions.
- Learning timeline is logged in simple language (example: acquired skill, learned from source).
- Growth capabilities are admin-gated (workspace tooling, VS Code bridge, media generation, self-evolution).
- Self-evolution currently creates controlled capability proposals/artifacts under approved workspace paths.

## Video learning baseline
- YouTube learning is permission-gated and admin-session gated.
- Paxion can split a recommended video into configurable segments (for example 2, 5, 10 minutes, or custom).
- Workspace can open segment batches in parallel slots for faster supervised study flow.
- Each segment can be marked learned with simple summary + skill tags, then stored in learning logs.

## App automation baseline
- Desktop app and web app automation are capability-gated and admin controlled.
- Current implementation generates deterministic automation playbooks and launch relays with full logs.
- Purpose is command-driven execution on user's behalf with explicit permission and traceability.

## Automation adapters and recorder baseline
- Task-specific UI automation adapters are implemented with strict step allowlists.
- Current adapters include supervised browser form fill and click-flow execution.
- Observe+Learn templates exist for code editor, CMS, and design app workflows.
- Execution recorder captures intended step, performed step, result, and new skill gained in simple language.
- Adapter profiles now include real target workflows (example CMS update, design export flow, PR review prep).
- Adapter profiles support variable placeholders so one template can be reused for real WordPress, design, and repo targets.
- Profile presets persist repeated target values so real workflows can be reloaded without retyping variables.
- Recorder replay mode is available with explicit permission and admin session.
- Replay now requires a preview token with step-diff visibility before rerun, so the operator sees exactly what will be replayed.
- Skill-to-capability suggestion engine recommends next capability unlocks based on learned skills.
- Suggestions can be applied directly from the workspace panel, and recent execution records can be selected for replay without manual ID copy.
- Capability suggestions are now ranked by confidence and blocked until prerequisite capabilities are enabled.

## Readiness foundation systems
- Target workflow packs now exist for real browser/editor/design targets with explicit verification and rollback checklists.
- Execution sessions persist prepared steps, evidence, verification notes, and rollback status.
- Observation capture stores visible app state, screenshot path, and inferred skills for later learning.
- Cross-app mission planning now creates multi-surface phases with recommended workflow packs.
- Learning graph snapshots connect logs, execution records, observations, vision jobs, and skills.
- Self-evolution now runs through staged pipelines: proposal, scaffold, test, review, and deploy.
- Vision/OCR jobs now exist as local review queue items with extracted text and review status.
- Pure readiness helper logic is covered by executable node:test coverage for suggestion ranking, replay preview grouping, mission planning, and graph linking.
- These systems remain permission-gated, admin-gated, and local-first rather than silent autonomous execution.

## OCR and evidence pipeline
- Local OCR execution is now integrated through an Electron-side OCR runner (no remote OCR API dependency).
- Vision jobs can be processed into extracted text with confidence capture and skill inference.
- Execution sessions can produce hashed evidence artifacts (`evidence.json` + `evidence.md`) with integrity hash, optional screenshot hash, and session linkage.
- Evidence artifact generation appends audit entries and learning logs to preserve traceability.
- OCR and evidence flows remain admin-gated and capability-gated.

## Native execution, attestation, and governance hardening
- Native action execution engine is available through guarded IPC with deterministic selector + fallback paths and supervised command execution allowlists.
- Automatic step evidence hooks now run at session-step boundaries (state snapshot, command transcript, and best-effort auto screenshot capture).
- Automatic DOM extraction fallback now runs from target session URL when explicit DOM snapshot is not supplied.
- Evidence and governance actions are anchored into a signed attestation hash chain with persisted signer fingerprint metadata.
- Attestation key lifecycle now includes admin-gated key status inspection and controlled key rotation anchored in the custody chain.
- Rollback now supports transaction execution across rollback step lists with per-step outcomes and captured rollback evidence.
- Learning graph now has paginated query/index APIs to support larger histories without full graph payload fetch every time.
- Target workflow packs include versioned compatibility profiles with selector fallback packs per platform family.
- Self-evolution promotion now enforces stronger gates (test thresholds, lint/build checks, and governance policy signatures) before deploy-stage advancement.
- Workspace operators now have direct controls for native action execution, rollback execution, graph query pagination, governance signing, and attestation operations in one panel for long sessions.

## Safe full-scope expansion bootstrap
- Policy evaluation now includes jurisdiction-aware compliance checks and signed policy snapshot hash linkage.
- Harmful or illegal cyber operation patterns remain blocked by immutable policy regardless of request.
- Device control-plane bootstrap is now available with trusted device register/list/revoke APIs for secure multi-device groundwork.
- Autonomous learning v2 bootstrap APIs now support skill-confidence evolution and supervised hypothesis generation.
- Trading bootstrap APIs now support deterministic backtesting and paper-order simulation under admin gate.
- Medical bootstrap APIs now support contraindication and confidence-threshold safety review workflows.
- Media bootstrap APIs now support auditable generation-job queueing with provenance watermark metadata.
- These additions are foundational program steps toward phase-by-phase completion and remain admin-gated, auditable, and policy-bound.

## Out of scope for v1
- Unrestricted autonomous operations.
- Unrestricted web crawling.
- Illegal or offensive cyber operations.

## Continuity rule
- Every milestone must be committed and pushed to the GitHub repository.
- This file must be updated when major direction changes.
