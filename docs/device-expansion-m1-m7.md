# Device Expansion M1-M7 (Kickoff)

This file tracks implementation progress for cross-device assistant parity.

## Goal

Enable one policy-safe assistant experience across desktop, mobile, tablet, and smart-glass clients while preserving local policy authority.

## Phase status

- M1 Device profile and routing core: in progress (started)
- M2 Mobile and tablet productization: planned
- M3 Secure delegation pipeline: planned
- M4 Messaging and call parity: planned
- M5 Smart-glass voice mode: planned
- M6 Multilingual voice stack: planned
- M7 Observability and reliability: planned

## M1 scope (started now)

- Add shared device profile model.
- Add action routing decision helper with execution modes.
- Surface route decision in UI for active action context.
- Keep policy approval authority unchanged.

## M2 scope

- Harden PWA and mobile state recovery.
- Add tablet-adaptive control layout.
- Improve compact approvals and quick action UX.

## M3 scope

- Add explicit delegated task queue lifecycle.
- Add correlation IDs linking decision, delegation, execution, and audit.
- Enforce approval requirements for delegated privileged actions.

## M4 scope

- Unify call and channel intents into one device-aware routing layer.
- Add fallback chain between direct, provider, and delegated execution.

## M5 scope

- Add smart-glass mode (voice-first + glance cards).
- Add concise confirmation prompts for safety-gated actions.

## M6 scope

- Add language-aware STT, response, and TTS selection pipeline.
- Add per-session language memory and fallback language rules.

## M7 scope

- Add per-device telemetry and reliability metrics.
- Add anomaly patterns for remote command abuse and retry storms.
- Add crash-safe resume for delegated workflows.

## Acceptance criteria

- Same command intent works across all devices with deterministic route mode.
- Desktop-only actions from mobile or smart-glass delegate safely.
- Delegated privileged actions require approval and write audit trails.
- Mobile and tablet keep responsive interaction quality under network variance.
- Smart-glass can complete voice command and confirmation cycles.
