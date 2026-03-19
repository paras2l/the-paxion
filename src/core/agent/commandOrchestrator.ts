import type { ActionCategory, ActionRequest } from '../../security/types'
import type { ProviderHealth } from '../models/router'
import type { PermissionState } from './platformFeatures'
import { selectBestModel } from './platformFeatures'

export type ConnectorId =
  | 'whatsapp'
  | 'instagram'
  | 'email'
  | 'browser'
  | 'phone'
  | 'social'
  | 'workspace'
  | 'image'
  | 'video'
  | 'music'
  | 'voice'
  | 'home'
  | 'learning'

export type PlannedTask = {
  id: string
  title: string
  connector: ConnectorId
  requiresPermission: boolean
  blockedByPermission: boolean
  requestedPermission: keyof PermissionState | null
  request: ActionRequest
}

export type CommandPlan = {
  intent: string
  selectedModel: string
  multitask: boolean
  tasks: PlannedTask[]
  assistantMessage: string
}

function makeTaskId(index: number): string {
  return `${Date.now().toString(36)}-${index}-${Math.random().toString(36).slice(2, 7)}`
}

function inferCategory(connector: ConnectorId): ActionCategory {
  if (connector === 'workspace' || connector === 'learning') {
    return 'codegen'
  }
  if (connector === 'browser' || connector === 'social') {
    return 'network'
  }
  if (connector === 'phone' || connector === 'home') {
    return 'system'
  }
  if (connector === 'email' || connector === 'whatsapp' || connector === 'instagram') {
    return 'chat'
  }
  return 'knowledge'
}

function permissionForConnector(connector: ConnectorId): keyof PermissionState | null {
  switch (connector) {
    case 'whatsapp':
    case 'instagram':
      return 'sendMessages'
    case 'email':
      return 'sendEmail'
    case 'phone':
      return 'makeCalls'
    case 'browser':
      return 'browseWeb'
    case 'social':
      return 'postSocial'
    case 'workspace':
      return 'editFiles'
    case 'home':
      return 'homeAutomation'
    case 'image':
    case 'video':
    case 'music':
    case 'voice':
      return 'runTools'
    case 'learning':
      return 'runTools'
    default:
      return null
  }
}

function detectConnectors(command: string): ConnectorId[] {
  const text = command.toLowerCase()
  const connectors = new Set<ConnectorId>()

  if (/whatsapp|message|reply/.test(text)) connectors.add('whatsapp')
  if (/instagram|insta|dm/.test(text)) connectors.add('instagram')
  if (/email|mail/.test(text)) connectors.add('email')
  if (/call|phone|speak/.test(text)) connectors.add('phone')
  if (/search|research|browse|google|web/.test(text)) connectors.add('browser')
  if (/post|publish|tweet|linkedin/.test(text)) connectors.add('social')
  if (/code|repo|file|build|fix/.test(text)) connectors.add('workspace')
  if (/image|thumbnail|poster/.test(text)) connectors.add('image')
  if (/video|short|reel/.test(text)) connectors.add('video')
  if (/music|song|beat/.test(text)) connectors.add('music')
  if (/voice|audio|podcast/.test(text)) connectors.add('voice')
  if (/home assistant|alexa|smart home|iot/.test(text)) connectors.add('home')
  if (/learn|study|book|chapter|summarize|summary/.test(text)) connectors.add('learning')

  if (connectors.size === 0) {
    connectors.add('browser')
  }

  return [...connectors]
}

export function buildCommandPlan(
  command: string,
  providerHealth: ProviderHealth[],
  permissions: PermissionState,
): CommandPlan {
  const trimmed = command.trim()
  const connectors = detectConnectors(trimmed)
  const selectedModel = selectBestModel(providerHealth)

  const tasks = connectors.map((connector, index) => {
    const permission = permissionForConnector(connector)
    const blocked = permission ? !permissions[permission] : false

    return {
      id: makeTaskId(index),
      title: `Execute ${connector} action`,
      connector,
      requiresPermission: Boolean(permission),
      blockedByPermission: blocked,
      requestedPermission: permission,
      request: {
        actionId: `agent.${connector}.execute`,
        category: inferCategory(connector),
        detail: trimmed,
        jurisdiction: connector,
      },
    }
  })

  const blocked = tasks.filter((task) => task.blockedByPermission)
  const runnable = tasks.length - blocked.length
  const multitask = tasks.length > 1

  let assistantMessage = `Planned ${tasks.length} task(s) with ${selectedModel}. Runnable now: ${runnable}.`
  if (blocked.length > 0) {
    const names = blocked
      .map((task) => task.requestedPermission)
      .filter((value): value is keyof PermissionState => Boolean(value))
      .join(', ')
    assistantMessage = `${assistantMessage} Permission needed: ${names}.`
  }

  return {
    intent: trimmed,
    selectedModel,
    multitask,
    tasks,
    assistantMessage,
  }
}
