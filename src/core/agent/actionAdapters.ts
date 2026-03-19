import type { PlannedTask } from './commandOrchestrator'
import type { IntegrationKey, IntegrationState } from './platformFeatures'

export type TaskExecutionStatus =
  | 'queued'
  | 'blocked-permission'
  | 'blocked-integration'
  | 'simulated'
  | 'executed'
  | 'failed'

export type TaskExecutionResult = {
  taskId: string
  actionId: string
  status: TaskExecutionStatus
  detail: string
}

type LiveExecutionOptions = {
  enabled?: boolean
  adminCodeword?: string
}

type ParsedPhoneTarget = {
  number?: string
  contact?: string
}

type ParsedEmailTarget = {
  recipient?: string
  subject?: string
  body?: string
}

type ParsedMessageTarget = {
  recipient?: string
  body?: string
}

type ParsedSocialPost = {
  platform?: string
  body?: string
}

type ParsedHomeCommand = {
  action?: string
  target?: string
  value?: string
}

type ParsedVoiceCommand = {
  mode: 'call' | 'voice-generation'
  number?: string
  contact?: string
  prompt?: string
}

type ParsedMusicCommand = {
  prompt: string
  genre?: string
  mood?: string
}

const MAX_RESULT_DETAIL_LENGTH = 320
const MAX_PARALLEL_TASKS = 3
const MAX_TASKS_PER_BATCH = 40
const CONNECTOR_CIRCUIT_BREAKER_THRESHOLD = 3
const RETRYABLE_FAILURE_REGEX = /(timed out|unexpectedly|unavailable|failed to execute|failed while|bridge)/i

const connectorToIntegration: Record<string, IntegrationKey | null> = {
  whatsapp: 'whatsapp',
  instagram: 'instagram',
  email: 'email',
  browser: 'browserAutomation',
  phone: 'phoneCalls',
  social: 'google',
  workspace: null,
  image: null,
  video: null,
  music: null,
  voice: null,
  home: 'homeAssistant',
  learning: null,
}

export function simulateTaskExecution(
  tasks: PlannedTask[],
  integrations: IntegrationState,
): TaskExecutionResult[] {
  return tasks.map((task) => {
    if (task.blockedByPermission) {
      return {
        taskId: task.id,
        actionId: task.request.actionId,
        status: 'blocked-permission',
        detail: 'Permission is required before this action can run.',
      }
    }

    const integrationKey = connectorToIntegration[task.connector]
    if (integrationKey && !integrations[integrationKey]) {
      return {
        taskId: task.id,
        actionId: task.request.actionId,
        status: 'blocked-integration',
        detail: `Integration ${integrationKey} is disabled in settings.`,
      }
    }

    return {
      taskId: task.id,
      actionId: task.request.actionId,
      status: 'queued',
      detail: 'Task accepted and queued for execution.',
    }
  })
}

function integrationForTask(task: PlannedTask): IntegrationKey | null {
  return connectorToIntegration[task.connector] ?? null
}

function compactText(input: string | undefined): string {
  return (input ?? '').replace(/\s+/g, ' ').trim()
}

function redactSensitiveFragments(text: string): string {
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(/\b\+?\d[\d\s\-()]{7,}\d\b/g, '[redacted-phone]')
    .replace(/\b(api[_-]?key|token|secret|password)\s*[:=]\s*[^\s|,;]+/gi, '$1=[redacted]')
}

function buildTaskSignature(task: PlannedTask): string {
  const detail = compactText(task.request.detail).toLowerCase()
  return `${task.connector}|${task.request.actionId}|${detail}`
}

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function submitRelayWithRetry(
  request: Record<string, unknown>,
): Promise<{ ok: boolean; reason?: string }> {
  if (!window.paxion?.relay?.submit) {
    return { ok: false, reason: 'Relay bridge is unavailable.' }
  }

  const maxAttempts = 2
  let lastReason = 'Relay request failed.'

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const relayResponse = await Promise.race([
        window.paxion.relay.submit({ request }),
        new Promise<null>((resolve) => {
          setTimeout(() => resolve(null), 8000)
        }),
      ])

      if (relayResponse?.ok) {
        return { ok: true }
      }

      lastReason = relayResponse?.reason ?? 'Relay request timed out.'
    } catch {
      lastReason = 'Relay request failed unexpectedly.'
    }
  }

  return { ok: false, reason: lastReason }
}

function parseBrowserQuery(detail: string | undefined): string {
  const text = compactText(detail)
  if (!text) {
    return 'latest updates'
  }

  const stripped = text
    .replace(/^(please\s+)?(search|research|browse|google|find|look up)\s+/i, '')
    .replace(/^for\s+/i, '')
    .trim()

  return stripped || text
}

function parsePhoneTarget(detail: string | undefined): ParsedPhoneTarget {
  const text = compactText(detail)
  const phone = text.match(/(\+?\d[\d\s\-()]{7,}\d)/)

  const contactMatch = text.match(/(?:call|phone|ring|dial)\s+([a-z][a-z\s.'-]{1,40})/i)
  const contact = contactMatch?.[1]?.trim()

  return {
    number: phone?.[1]?.replace(/\s+/g, '') ?? undefined,
    contact,
  }
}

function parseEmailTarget(detail: string | undefined): ParsedEmailTarget {
  const text = compactText(detail)
  const recipientMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  const subjectMatch = text.match(/subject\s*:\s*([^.;\n]+)/i)
  const bodyMatch = text.match(/(?:body|message)\s*:\s*(.+)$/i)

  return {
    recipient: recipientMatch?.[0],
    subject: subjectMatch?.[1]?.trim(),
    body: bodyMatch?.[1]?.trim(),
  }
}

function parseMessageTarget(detail: string | undefined): ParsedMessageTarget {
  const text = compactText(detail)
  const recipientMatch = text.match(/(?:to|for|reply to|message)\s+([a-z0-9_.@+\-\s]{2,50})/i)
  const bodyMatch = text.match(/(?:body|message|text)\s*:\s*(.+)$/i)

  const inferredBody = text
    .replace(/^(please\s+)?(send|reply|message|dm|whatsapp|instagram)\s+/i, '')
    .replace(/^(to|for)\s+[a-z0-9_.@+\-\s]{2,50}\s*/i, '')
    .trim()

  return {
    recipient: recipientMatch?.[1]?.trim(),
    body: bodyMatch?.[1]?.trim() ?? inferredBody,
  }
}

function parseSocialPost(detail: string | undefined): ParsedSocialPost {
  const text = compactText(detail)
  const platformMatch = text.match(/(?:linkedin|twitter|x|facebook|instagram)/i)
  const bodyMatch = text.match(/(?:post|publish|tweet)\s*(?::)?\s*(.+)$/i)

  return {
    platform: platformMatch?.[0]?.toLowerCase(),
    body: bodyMatch?.[1]?.trim() ?? text,
  }
}

function buildEmailExecutionDetail(detail: string | undefined): string {
  const parsed = parseEmailTarget(detail)
  const source = compactText(detail)
  const recipient = parsed.recipient ?? 'unknown-recipient'
  const subject = parsed.subject ?? 'No subject provided'
  const body = parsed.body ?? source
  return `Send email | to=${recipient} | subject=${subject} | body=${body}`
}

function buildMessageExecutionDetail(
  detail: string | undefined,
  channel: 'whatsapp' | 'instagram',
): string {
  const parsed = parseMessageTarget(detail)
  const recipient = parsed.recipient ?? 'unknown-recipient'
  const body = parsed.body ?? compactText(detail)
  return `Send ${channel} message | to=${recipient} | body=${body}`
}

function buildSocialExecutionDetail(detail: string | undefined): string {
  const parsed = parseSocialPost(detail)
  const platform = parsed.platform ?? 'general'
  const body = parsed.body ?? compactText(detail)
  return `Publish social post | platform=${platform} | body=${body}`
}

function parseHomeCommand(detail: string | undefined): ParsedHomeCommand {
  const text = compactText(detail)
  if (!text) {
    return {}
  }

  const sceneMatch = text.match(/(?:run|activate|start)\s+(?:scene|routine)\s+(.+)$/i)
  if (sceneMatch?.[1]) {
    return {
      action: 'run-scene',
      target: sceneMatch[1].trim(),
    }
  }

  const setMatch = text.match(/(?:set|adjust)\s+(.+?)\s+(?:to|at)\s+(.+)$/i)
  if (setMatch?.[1]) {
    return {
      action: 'set-value',
      target: setMatch[1].trim(),
      value: setMatch[2]?.trim(),
    }
  }

  const onMatch = text.match(/(?:turn on|switch on|enable|start)\s+(.+)$/i)
  if (onMatch?.[1]) {
    return {
      action: 'turn-on',
      target: onMatch[1].trim(),
    }
  }

  const offMatch = text.match(/(?:turn off|switch off|disable|stop)\s+(.+)$/i)
  if (offMatch?.[1]) {
    return {
      action: 'turn-off',
      target: offMatch[1].trim(),
    }
  }

  const targetMatch = text.match(/(?:light|lights|fan|ac|heater|thermostat|garage|door|sprinkler|camera|alarm)(?:\s+[a-z0-9\-]+){0,6}/i)
  return {
    action: 'control-device',
    target: targetMatch?.[0]?.trim() ?? text,
  }
}

function buildHomeExecutionDetail(detail: string | undefined): string {
  const parsed = parseHomeCommand(detail)
  const action = parsed.action ?? 'control-device'
  const target = parsed.target ?? compactText(detail)
  const value = parsed.value ? ` | value=${parsed.value}` : ''
  return `Home automation action | action=${action} | target=${target}${value}`
}

function buildWorkspacePlan(detail: string | undefined): Array<Record<string, unknown>> {
  const text = compactText(detail)
  if (!text) {
    return []
  }

  const normalized = text
    .replace(/\band\s+then\b/gi, ';')
    .replace(/\bthen\b/gi, ';')
    .replace(/\s*->\s*/g, ';')

  const segments = normalized
    .split(/;|\n|\./)
    .map((part) => part.trim())
    .filter(Boolean)

  return segments.slice(0, 12).map((segment, index) => ({
    id: `workspace-step-${index + 1}`,
    kind: 'task',
    title: segment,
    status: 'queued',
  }))
}

function parseVoiceCommand(detail: string | undefined): ParsedVoiceCommand {
  const text = compactText(detail)
  const callTarget = parsePhoneTarget(detail)
  const wantsCall = /\b(call|dial|phone|ring)\b/i.test(text)

  if (wantsCall && (callTarget.number || callTarget.contact)) {
    return {
      mode: 'call',
      number: callTarget.number,
      contact: callTarget.contact,
    }
  }

  const prompt = text
    .replace(/^(please\s+)?(speak|say|narrate|voice|read out|read)\s+/i, '')
    .trim()

  return {
    mode: 'voice-generation',
    prompt: prompt || text || 'Generate a short spoken response.',
  }
}

function parseMusicPrompt(detail: string | undefined): ParsedMusicCommand {
  const text = compactText(detail)
  const genreMatch = text.match(/\b(lofi|hip hop|hip-hop|jazz|edm|ambient|classical|rock|pop|cinematic|trap)\b/i)
  const moodMatch = text.match(/\b(calm|energetic|uplifting|dark|focus|happy|sad|epic|relaxed)\b/i)

  const prompt = text
    .replace(/^(please\s+)?(create|compose|generate|make|produce)\s+/i, '')
    .replace(/^music\s*(for|about)?\s*/i, '')
    .trim()

  return {
    prompt: prompt || text || 'Compose an instrumental music idea.',
    genre: genreMatch?.[1]?.toLowerCase(),
    mood: moodMatch?.[1]?.toLowerCase(),
  }
}

function parseMediaPrompt(detail: string | undefined, kind: 'image' | 'video' | 'voice'): string {
  const text = compactText(detail)
  if (!text) {
    if (kind === 'image') {
      return 'Generate a high quality image concept.'
    }
    if (kind === 'video') {
      return 'Generate a short video concept.'
    }
    return 'Generate a natural voice response.'
  }

  return text
    .replace(/^(please\s+)?(create|generate|make|produce)\s+/i, '')
    .replace(new RegExp(`^${kind}s?\\s*(of|about)?\\s*`, 'i'), '')
    .trim() || text
}

function parseLearningPayload(detail: string | undefined): { title: string; body: string } {
  const text = compactText(detail)
  if (!text) {
    return {
      title: 'Learning note',
      body: 'No learning detail was provided.',
    }
  }

  const title = text.length > 72 ? `${text.slice(0, 69).trim()}...` : text
  return {
    title,
    body: text,
  }
}

async function executeBrowserTask(task: PlannedTask): Promise<TaskExecutionResult> {
  const response = await window.paxion!.integrations.googleSearch({
    query: parseBrowserQuery(task.request.detail),
  })

  if (!response?.ok) {
    return {
      taskId: task.id,
      actionId: task.request.actionId,
      status: 'failed',
      detail: response?.reason ?? 'Browser relay failed to execute.',
    }
  }

  return {
    taskId: task.id,
    actionId: task.request.actionId,
    status: 'executed',
    detail: 'Browser action executed via Google relay.',
  }
}

async function executePhoneTask(task: PlannedTask): Promise<TaskExecutionResult> {
  const target = parsePhoneTarget(task.request.detail)
  if (!target.number && !target.contact) {
    return {
      taskId: task.id,
      actionId: task.request.actionId,
      status: 'failed',
      detail: 'Phone task needs a number or contact name in the command.',
    }
  }

  const response = await window.paxion!.voice.call({
    number: target.number,
    contact: target.contact,
    provider: 'desktop-relay',
    message: task.request.detail,
  })

  if (!response?.ok) {
    return {
      taskId: task.id,
      actionId: task.request.actionId,
      status: 'failed',
      detail: response?.reason ?? 'Phone relay failed to execute.',
    }
  }

  return {
    taskId: task.id,
    actionId: task.request.actionId,
    status: 'executed',
    detail: response.emergency
      ? 'Emergency call executed via voice relay.'
      : 'Phone call executed via voice relay.',
  }
}

async function executeMessageTask(
  task: PlannedTask,
  options: LiveExecutionOptions | undefined,
  channel: 'whatsapp' | 'instagram',
): Promise<TaskExecutionResult> {
  const parsed = parseMessageTarget(task.request.detail)
  if (!parsed.body) {
    return {
      taskId: task.id,
      actionId: task.request.actionId,
      status: 'failed',
      detail: `${channel} task needs message text in the command.`,
    }
  }

  const execution = await window.paxion!.action.execute({
    request: {
      ...task.request,
      detail: buildMessageExecutionDetail(task.request.detail, channel),
    },
    adminCodeword: options?.adminCodeword,
  })

  if (execution.finalDecision.allowed && execution.execution.executed) {
    return {
      taskId: task.id,
      actionId: task.request.actionId,
      status: 'executed',
      detail: `${channel} message executed in ${execution.execution.mode} mode.`,
    }
  }

  return {
    taskId: task.id,
    actionId: task.request.actionId,
    status: 'failed',
    detail: execution.finalDecision.reason,
  }
}

async function executeWhatsAppTask(
  task: PlannedTask,
  options?: LiveExecutionOptions,
): Promise<TaskExecutionResult> {
  const parsed = parseMessageTarget(task.request.detail)
  if (!parsed.body) {
    return {
      taskId: task.id,
      actionId: task.request.actionId,
      status: 'failed',
      detail: 'whatsapp task needs message text in the command.',
    }
  }

  if (!window.paxion?.relay?.submit) {
    return executeMessageTask(task, options, 'whatsapp')
  }

  const relayResponse = await submitRelayWithRetry({
    connector: 'whatsapp',
    action: 'send-message',
    recipient: parsed.recipient ?? null,
    body: parsed.body,
    raw: compactText(task.request.detail),
    source: 'control-shell-agent',
    actionId: task.request.actionId,
  })

  if (relayResponse?.ok) {
    return {
      taskId: task.id,
      actionId: task.request.actionId,
      status: 'executed',
      detail: 'WhatsApp message submitted to cloud relay provider queue.',
    }
  }

  // Fallback: keep compatibility with local policy execution when relay is unavailable.
  return executeMessageTask(task, options, 'whatsapp')
}

async function executeInstagramTask(
  task: PlannedTask,
  options?: LiveExecutionOptions,
): Promise<TaskExecutionResult> {
  const parsed = parseMessageTarget(task.request.detail)
  if (!parsed.body) {
    return {
      taskId: task.id,
      actionId: task.request.actionId,
      status: 'failed',
      detail: 'instagram task needs message text in the command.',
    }
  }

  if (!window.paxion?.relay?.submit) {
    return executeMessageTask(task, options, 'instagram')
  }

  const relayResponse = await submitRelayWithRetry({
    connector: 'instagram',
    action: 'send-dm',
    recipient: parsed.recipient ?? null,
    body: parsed.body,
    raw: compactText(task.request.detail),
    source: 'control-shell-agent',
    actionId: task.request.actionId,
  })

  if (relayResponse?.ok) {
    return {
      taskId: task.id,
      actionId: task.request.actionId,
      status: 'executed',
      detail: 'Instagram DM submitted to cloud relay provider queue.',
    }
  }

  // Fallback: keep compatibility with local policy execution when relay is unavailable.
  return executeMessageTask(task, options, 'instagram')
}

async function executeEmailTask(
  task: PlannedTask,
  options?: LiveExecutionOptions,
): Promise<TaskExecutionResult> {
  const parsed = parseEmailTarget(task.request.detail)
  const subject = parsed.subject ?? 'No subject provided'
  const body = parsed.body ?? compactText(task.request.detail)

  if (!parsed.recipient) {
    return {
      taskId: task.id,
      actionId: task.request.actionId,
      status: 'failed',
      detail: 'Email task needs a recipient address in the command.',
    }
  }

  if (!window.paxion?.relay?.submit) {
    return executeViaPolicyEngine(task, options)
  }

  const relayResponse = await submitRelayWithRetry({
    connector: 'email',
    action: 'send-email',
    to: parsed.recipient,
    subject,
    body,
    raw: compactText(task.request.detail),
    source: 'control-shell-agent',
    actionId: task.request.actionId,
  })

  if (relayResponse?.ok) {
    return {
      taskId: task.id,
      actionId: task.request.actionId,
      status: 'executed',
      detail: 'Email request submitted to cloud relay provider queue.',
    }
  }

  // Fallback: keep compatibility with local policy execution when relay is unavailable.
  return executeViaPolicyEngine(task, options)
}

async function executeSocialTask(
  task: PlannedTask,
  options?: LiveExecutionOptions,
): Promise<TaskExecutionResult> {
  const parsed = parseSocialPost(task.request.detail)
  if (!parsed.body) {
    return {
      taskId: task.id,
      actionId: task.request.actionId,
      status: 'failed',
      detail: 'Social task needs post content in the command.',
    }
  }

  if (!window.paxion?.relay?.submit) {
    return executeViaPolicyEngine(
      {
        ...task,
        request: {
          ...task.request,
          detail: buildSocialExecutionDetail(task.request.detail),
        },
      },
      options,
    )
  }

  const platform = parsed.platform === 'x' ? 'twitter' : parsed.platform ?? 'general'
  const relayResponse = await submitRelayWithRetry({
    connector: 'social',
    action: 'publish-post',
    platform,
    body: parsed.body,
    raw: compactText(task.request.detail),
    source: 'control-shell-agent',
    actionId: task.request.actionId,
  })

  if (relayResponse?.ok) {
    return {
      taskId: task.id,
      actionId: task.request.actionId,
      status: 'executed',
      detail: `Social post submitted to cloud relay provider queue for ${platform}.`,
    }
  }

  // Fallback: keep compatibility with local policy execution when relay is unavailable.
  return executeViaPolicyEngine(
    {
      ...task,
      request: {
        ...task.request,
        detail: buildSocialExecutionDetail(task.request.detail),
      },
    },
    options,
  )
}

async function executeHomeTask(
  task: PlannedTask,
  options?: LiveExecutionOptions,
): Promise<TaskExecutionResult> {
  const parsed = parseHomeCommand(task.request.detail)
  if (!parsed.target) {
    return {
      taskId: task.id,
      actionId: task.request.actionId,
      status: 'failed',
      detail: 'Home task needs a target device or scene in the command.',
    }
  }

  if (!window.paxion?.relay?.submit) {
    return executeViaPolicyEngine(
      {
        ...task,
        request: {
          ...task.request,
          detail: buildHomeExecutionDetail(task.request.detail),
        },
      },
      options,
    )
  }

  const action = parsed.action ?? 'control-device'
  const relayResponse = await submitRelayWithRetry({
    connector: 'home',
    action,
    target: parsed.target,
    value: parsed.value ?? null,
    raw: compactText(task.request.detail),
    source: 'control-shell-agent',
    actionId: task.request.actionId,
  })

  if (relayResponse?.ok) {
    return {
      taskId: task.id,
      actionId: task.request.actionId,
      status: 'executed',
      detail: `Home automation request submitted to cloud relay provider queue (${action}).`,
    }
  }

  // Fallback: keep compatibility with local policy execution when relay is unavailable.
  return executeViaPolicyEngine(
    {
      ...task,
      request: {
        ...task.request,
        detail: buildHomeExecutionDetail(task.request.detail),
      },
    },
    options,
  )
}

async function executeWorkspaceTask(task: PlannedTask): Promise<TaskExecutionResult> {
  if (!window.paxion?.workspace?.save) {
    return {
      taskId: task.id,
      actionId: task.request.actionId,
      status: 'failed',
      detail: 'Workspace bridge is unavailable for plan persistence.',
    }
  }

  const goal = compactText(task.request.detail)
  const plan = buildWorkspacePlan(task.request.detail)
  const response = await window.paxion.workspace.save({
    goal: goal || 'Untitled workspace mission',
    plan,
  })

  if (response?.ok) {
    return {
      taskId: task.id,
      actionId: task.request.actionId,
      status: 'executed',
      detail: `Workspace mission saved with ${plan.length} planned step(s).`,
    }
  }

  return {
    taskId: task.id,
    actionId: task.request.actionId,
    status: 'failed',
    detail: response?.reason ?? 'Workspace mission save failed.',
  }
}

async function executeLearningTask(
  task: PlannedTask,
  options?: LiveExecutionOptions,
): Promise<TaskExecutionResult> {
  if (!window.paxion?.learning?.record) {
    return executeViaPolicyEngine(task, options)
  }

  const payload = parseLearningPayload(task.request.detail)
  const response = await window.paxion.learning.record({
    title: payload.title,
    detail: payload.body,
    source: 'control-shell-agent',
  })

  if (response?.ok) {
    return {
      taskId: task.id,
      actionId: task.request.actionId,
      status: 'executed',
      detail: 'Learning memory recorded through desktop learning bridge.',
    }
  }

  return executeViaPolicyEngine(task, options)
}

async function executeMediaTask(
  task: PlannedTask,
  type: 'image' | 'video' | 'voice',
  options?: LiveExecutionOptions,
): Promise<TaskExecutionResult> {
  if (!window.paxion?.media?.generate) {
    return executeViaPolicyEngine(task, options)
  }

  const prompt = parseMediaPrompt(task.request.detail, type)
  const response = await window.paxion.media.generate({
    type,
    prompt,
  })

  if (response?.ok) {
    const label = type.charAt(0).toUpperCase() + type.slice(1)
    return {
      taskId: task.id,
      actionId: task.request.actionId,
      status: 'executed',
      detail: `${label} generation job submitted via media bridge.`,
    }
  }

  return executeViaPolicyEngine(task, options)
}

async function executeVoiceTask(
  task: PlannedTask,
  options?: LiveExecutionOptions,
): Promise<TaskExecutionResult> {
  const parsed = parseVoiceCommand(task.request.detail)

  if (parsed.mode === 'call') {
    if (!window.paxion?.voice?.call) {
      return executeViaPolicyEngine(task, options)
    }

    const response = await window.paxion.voice.call({
      number: parsed.number,
      contact: parsed.contact,
      provider: 'desktop-relay',
      message: task.request.detail,
    })

    if (response?.ok) {
      return {
        taskId: task.id,
        actionId: task.request.actionId,
        status: 'executed',
        detail: 'Voice call executed via voice bridge.',
      }
    }

    return executeViaPolicyEngine(task, options)
  }

  return executeMediaTask(
    {
      ...task,
      request: {
        ...task.request,
        detail: parsed.prompt,
      },
    },
    'voice',
    options,
  )
}

async function executeMusicTask(
  task: PlannedTask,
  options?: LiveExecutionOptions,
): Promise<TaskExecutionResult> {
  const parsed = parseMusicPrompt(task.request.detail)
  const composedPrompt = [
    parsed.prompt,
    parsed.genre ? `genre=${parsed.genre}` : null,
    parsed.mood ? `mood=${parsed.mood}` : null,
  ]
    .filter(Boolean)
    .join(' | ')

  if (window.paxion?.relay?.submit) {
    const relayResponse = await submitRelayWithRetry({
      connector: 'music',
      action: 'compose-track',
      prompt: composedPrompt,
      genre: parsed.genre ?? null,
      mood: parsed.mood ?? null,
      raw: compactText(task.request.detail),
      source: 'control-shell-agent',
      actionId: task.request.actionId,
    })

    if (relayResponse?.ok) {
      return {
        taskId: task.id,
        actionId: task.request.actionId,
        status: 'executed',
        detail: 'Music composition request submitted to cloud relay provider queue.',
      }
    }
  }

  if (window.paxion?.media?.generate) {
    const mediaResponse = await window.paxion.media.generate({
      type: 'voice',
      prompt: `Music concept draft: ${composedPrompt}`,
    })

    if (mediaResponse?.ok) {
      return {
        taskId: task.id,
        actionId: task.request.actionId,
        status: 'executed',
        detail: 'Music concept generated via media bridge voice artifact.',
      }
    }
  }

  return executeViaPolicyEngine(task, options)
}

async function executeViaPolicyEngine(
  task: PlannedTask,
  options?: LiveExecutionOptions,
): Promise<TaskExecutionResult> {
  const request =
    task.connector === 'email'
      ? {
          ...task.request,
          detail: buildEmailExecutionDetail(task.request.detail),
        }
      : task.request

  const execution = await window.paxion!.action.execute({
    request,
    adminCodeword: options?.adminCodeword,
  })

  if (execution.finalDecision.allowed && execution.execution.executed) {
    return {
      taskId: task.id,
      actionId: task.request.actionId,
      status: 'executed',
      detail: `Executed in ${execution.execution.mode} mode.`,
    }
  }

  return {
    taskId: task.id,
    actionId: task.request.actionId,
    status: 'failed',
    detail: execution.finalDecision.reason,
  }
}

async function executeSingleTaskLive(
  task: PlannedTask,
  integrations: IntegrationState,
  options?: LiveExecutionOptions,
): Promise<TaskExecutionResult> {
  if (task.blockedByPermission) {
    return {
      taskId: task.id,
      actionId: task.request.actionId,
      status: 'blocked-permission',
      detail: 'Permission is required before this action can run.',
    }
  }

  const integrationKey = integrationForTask(task)
  if (integrationKey && !integrations[integrationKey]) {
    return {
      taskId: task.id,
      actionId: task.request.actionId,
      status: 'blocked-integration',
      detail: `Integration ${integrationKey} is disabled in settings.`,
    }
  }

  if (!options?.enabled || typeof window === 'undefined' || !window.paxion) {
    return {
      taskId: task.id,
      actionId: task.request.actionId,
      status: 'queued',
      detail: 'Task accepted and queued for execution.',
    }
  }

  try {
    if (task.connector === 'browser' && integrations.google) {
      return executeBrowserTask(task)
    }

    if (task.connector === 'phone') {
      return executePhoneTask(task)
    }

    if (task.connector === 'whatsapp') {
      return executeWhatsAppTask(task, options)
    }

    if (task.connector === 'instagram') {
      return executeInstagramTask(task, options)
    }

    if (task.connector === 'email') {
      return executeEmailTask(task, options)
    }

    if (task.connector === 'social') {
      return executeSocialTask(task, options)
    }

    if (task.connector === 'home') {
      return executeHomeTask(task, options)
    }

    if (task.connector === 'workspace') {
      return executeWorkspaceTask(task)
    }

    if (task.connector === 'learning') {
      return executeLearningTask(task, options)
    }

    if (task.connector === 'image') {
      return executeMediaTask(task, 'image', options)
    }

    if (task.connector === 'video') {
      return executeMediaTask(task, 'video', options)
    }

    if (task.connector === 'voice') {
      return executeVoiceTask(task, options)
    }

    if (task.connector === 'music') {
      return executeMusicTask(task, options)
    }

    return executeViaPolicyEngine(task, options)
  } catch {
    return {
      taskId: task.id,
      actionId: task.request.actionId,
      status: 'failed',
      detail: 'Execution failed unexpectedly while calling desktop bridge.',
    }
  }
}

async function executeTaskWithTimeout(
  task: PlannedTask,
  integrations: IntegrationState,
  options?: LiveExecutionOptions,
): Promise<TaskExecutionResult> {
  const normalize = (result: TaskExecutionResult): TaskExecutionResult => {
    const detail = compactText(result.detail)
    const normalizedDetail =
      detail.length > MAX_RESULT_DETAIL_LENGTH
        ? `${detail.slice(0, MAX_RESULT_DETAIL_LENGTH - 3).trim()}...`
        : detail || 'Execution finished with no detail message.'

    return {
      taskId: result.taskId || task.id,
      actionId: result.actionId || task.request.actionId,
      status: result.status,
      detail: `[${task.connector}] ${redactSensitiveFragments(normalizedDetail)}`,
    }
  }

  const attemptExecute = (): Promise<TaskExecutionResult> => {
    return Promise.race([
      executeSingleTaskLive(task, integrations, options),
      new Promise<TaskExecutionResult>((resolve) => {
        setTimeout(() => {
          resolve({
            taskId: task.id,
            actionId: task.request.actionId,
            status: 'failed',
            detail: 'Execution timed out while waiting for bridge response.',
          })
        }, 12000)
      }),
    ])
  }

  try {
    let result = await attemptExecute()

    if (result.status === 'failed' && RETRYABLE_FAILURE_REGEX.test(result.detail)) {
      await waitMs(250)
      result = await attemptExecute()
    }

    return normalize(result)
  } catch {
    return normalize({
      taskId: task.id,
      actionId: task.request.actionId,
      status: 'failed',
      detail: 'Execution failed unexpectedly while applying task timeout guard.',
    })
  }
}

export async function executeTaskExecution(
  tasks: PlannedTask[],
  integrations: IntegrationState,
  options?: LiveExecutionOptions,
): Promise<TaskExecutionResult[]> {
  if (tasks.length === 0) {
    return []
  }

  const results: TaskExecutionResult[] = new Array(tasks.length)
  const cappedTasks = tasks.slice(0, MAX_TASKS_PER_BATCH)

  if (tasks.length > MAX_TASKS_PER_BATCH) {
    for (let index = MAX_TASKS_PER_BATCH; index < tasks.length; index += 1) {
      const task = tasks[index]
      results[index] = {
        taskId: task.id,
        actionId: task.request.actionId,
        status: 'failed',
        detail: `[${task.connector}] Batch limit exceeded: max ${MAX_TASKS_PER_BATCH} tasks per command.`,
      }
    }
  }

  const signatureToIndex = new Map<string, number>()
  const executionQueue: number[] = []

  cappedTasks.forEach((task, index) => {
    const signature = buildTaskSignature(task)
    const firstIndex = signatureToIndex.get(signature)

    if (firstIndex !== undefined) {
      results[index] = {
        taskId: task.id,
        actionId: task.request.actionId,
        status: 'simulated',
        detail: `[${task.connector}] Duplicate task merged with ${cappedTasks[firstIndex].id}.`,
      }
      return
    }

    signatureToIndex.set(signature, index)
    executionQueue.push(index)
  })
  let cursor = 0
  const connectorFailureStreak: Record<string, number> = {}

  const workers = Array.from(
    { length: Math.min(MAX_PARALLEL_TASKS, executionQueue.length) },
    async () => {
    while (true) {
      const index = cursor
      cursor += 1

      if (index >= executionQueue.length) {
        return
      }

      const taskIndex = executionQueue[index]
      const task = cappedTasks[taskIndex]
      const streak = connectorFailureStreak[task.connector] ?? 0

      if (streak >= CONNECTOR_CIRCUIT_BREAKER_THRESHOLD) {
        results[taskIndex] = {
          taskId: task.id,
          actionId: task.request.actionId,
          status: 'failed',
          detail: `[${task.connector}] Circuit breaker open after repeated failures; task skipped.`,
        }
        continue
      }

      const result = await executeTaskWithTimeout(task, integrations, options)
      results[taskIndex] = result

      connectorFailureStreak[task.connector] =
        result.status === 'failed' ? streak + 1 : 0
    }
    },
  )

  await Promise.all(workers)

  for (let index = 0; index < results.length; index += 1) {
    if (!results[index]) {
      const task = tasks[index]
      results[index] = {
        taskId: task.id,
        actionId: task.request.actionId,
        status: 'failed',
        detail: `[${task.connector}] Execution result was not produced due to a scheduling guard.`,
      }
    }
  }

  return results
}

export function summarizeExecution(results: TaskExecutionResult[]): string {
  if (results.length === 0) {
    return 'No tasks were generated from this command.'
  }

  const queued = results.filter((result) => result.status === 'queued').length
  const executed = results.filter((result) => result.status === 'executed').length
  const failed = results.filter((result) => result.status === 'failed').length
  const blockedPermission = results.filter((result) => result.status === 'blocked-permission').length
  const blockedIntegration = results.filter((result) => result.status === 'blocked-integration').length

  return `Execution summary: executed ${executed}, queued ${queued}, failed ${failed}, permission blocks ${blockedPermission}, integration blocks ${blockedIntegration}.`
}
