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

## Out of scope for v1
- Unrestricted autonomous operations.
- Unrestricted web crawling.
- Illegal or offensive cyber operations.

## Continuity rule
- Every milestone must be committed and pushed to the GitHub repository.
- This file must be updated when major direction changes.
