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
- Immutable core: security policy, approval logic, and audit controls cannot be changed by generated code.
- Controlled self-coding: AI can create new code only inside approved workspace paths.
- Sensitive operations require admin verification and explicit approval ticketing.
- Audit is append-only and hash-chained to make tampering visible.
- Blocked operations remain blocked regardless of prompt context.

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

## Out of scope for v1
- Unrestricted autonomous operations.
- Unrestricted web crawling.
- Illegal or offensive cyber operations.

## Continuity rule
- Every milestone must be committed and pushed to the GitHub repository.
- This file must be updated when major direction changes.
