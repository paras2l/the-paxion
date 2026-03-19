# Device Expansion M1-M7 (Kickoff)

This file tracks implementation progress for cross-device assistant parity.

## Goal

Enable one policy-safe assistant experience across desktop, mobile, tablet, and smart-glass clients while preserving local policy authority.

## Phase status

- M1 Device profile and routing core: complete
- M2 Mobile and tablet productization: complete
- M3 Secure delegation pipeline: complete
- M4 Messaging and call parity: complete
- M5 Smart-glass voice mode: complete
- M6 Multilingual voice stack: complete
- M7 Observability and reliability: complete

## M1 scope (started now)

- Add shared device profile model.
- Add action routing decision helper with execution modes.
- Surface route decision in UI for active action context.
- Keep policy approval authority unchanged.

## M2 scope

- Harden PWA and mobile state recovery.
- Add tablet-adaptive control layout.
- Improve compact approvals and quick action UX.

Delivered in this slice:

- Added mobile session recovery snapshot (assistant mode, action form state, queue state, decision state).
- Added mobile companion route visibility including derived device class and recovery timestamp.

## M3 scope

- Add explicit delegated task queue lifecycle.
- Add correlation IDs linking decision, delegation, execution, and audit.
- Enforce approval requirements for delegated privileged actions.

Delivered in this slice:

- Added delegated queue model with statuses: pending-approval, approved, executing, completed, failed.
- Added correlation IDs for delegated requests.
- Added audit linkage for delegated queue events and approval use.
- Added operator controls for approve/run and fail transitions in control panel.

## M4 scope

- Unify call and channel intents into one device-aware routing layer.
- Add fallback chain between direct, provider, and delegated execution.

Delivered in this slice:

- Added unified intent decision helper for call and channel intent classification.
- Added deterministic fallback chain previews for channel and call flows.
- Wired fallback-aware routing into selected action route resolution.

## M5 scope

- Add smart-glass mode (voice-first + glance cards).
- Add concise confirmation prompts for safety-gated actions.

Delivered in this slice:

- Added smart-glass mode state with persistence and voice-mode auto-arming.
- Added concise confirmation gate before approval-sensitive execution in smart-glass mode.
- Surfaced smart-glass and M4 routing status in control surfaces.

## M6 scope

- Add language-aware STT, response, and TTS selection pipeline.
- Add per-session language memory and fallback language rules.

Delivered in this slice:

- Added shared language pipeline model with supported language options and fallback chains.
- Wired STT input language and TTS output language selection with runtime fallback behavior.
- Added per-session language memory with persisted selection and control-surface visibility.

## M7 scope

- Add per-device telemetry and reliability metrics.
- Add anomaly patterns for remote command abuse and retry storms.
- Add crash-safe resume for delegated workflows.

Delivered in this slice:

- Added reliability telemetry model for per-device route counts and delegated lifecycle counters.
- Added audit anomaly detection for delegated remote abuse bursts and retry-storm patterns.
- Added crash-safe delegated queue snapshot and resume recovery handling after restart.
- Surfaced reliability counters and recent reliability signals in active control surfaces.
- Added retry budgets with backoff and jitter for relay/bridge network operations.
- Added burst-throttle routing guard plus operator reset controls.
- Added reconnect replay controls (retry all, replay safe-only, clear failed) for delegated workflows.

## Acceptance criteria

- Same command intent works across all devices with deterministic route mode.
- Desktop-only actions from mobile or smart-glass delegate safely.
- Delegated privileged actions require approval and write audit trails.
- Mobile and tablet keep responsive interaction quality under network variance.
- Smart-glass can complete voice command and confirmation cycles.
- Mobile-origin delegated actions survive disconnect and replay safely on reconnect.
