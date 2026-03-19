import type { IntegrationKey, IntegrationState } from './platformFeatures'

export type IntegrationService = {
  id: IntegrationKey
  label: string
  category: 'messaging' | 'productivity' | 'automation' | 'smart-home'
  description: string
  usefulFor: string[]
}

export type IntegrationHealth = {
  id: IntegrationKey
  connected: boolean
  status: 'connected' | 'disconnected'
  note: string
}

export const integrationCatalog: IntegrationService[] = [
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    category: 'messaging',
    description: 'Send and read messages with human-in-the-loop reply approvals.',
    usefulFor: ['customer replies', 'follow-ups', 'team alerts'],
  },
  {
    id: 'instagram',
    label: 'Instagram',
    category: 'messaging',
    description: 'Handle DMs, social interactions, and publish tasks.',
    usefulFor: ['dm support', 'post scheduling', 'engagement'],
  },
  {
    id: 'email',
    label: 'Email',
    category: 'productivity',
    description: 'Draft, send, and summarize email threads.',
    usefulFor: ['summaries', 'outreach', 'follow-up mail'],
  },
  {
    id: 'slack',
    label: 'Slack',
    category: 'productivity',
    description: 'Workspace messaging and channel automations.',
    usefulFor: ['channel updates', 'alerts', 'ops reports'],
  },
  {
    id: 'teams',
    label: 'Microsoft Teams',
    category: 'productivity',
    description: 'Team collaboration and meeting updates.',
    usefulFor: ['meeting reminders', 'project updates'],
  },
  {
    id: 'google',
    label: 'Google Workspace',
    category: 'productivity',
    description: 'Docs, sheets, and calendar workflow support.',
    usefulFor: ['research docs', 'calendar tasks', 'sheet updates'],
  },
  {
    id: 'homeAssistant',
    label: 'Home Assistant',
    category: 'smart-home',
    description: 'Control smart devices and scheduled routines.',
    usefulFor: ['lights', 'device status', 'automation scenes'],
  },
  {
    id: 'phoneCalls',
    label: 'Phone Calls',
    category: 'automation',
    description: 'Place or assist calls with permission-driven flow.',
    usefulFor: ['outbound calls', 'call summaries'],
  },
  {
    id: 'browserAutomation',
    label: 'Browser Automation',
    category: 'automation',
    description: 'Web research, forms, posting, and app workflows.',
    usefulFor: ['research', 'form fill', 'web actions'],
  },
]

export function deriveIntegrationHealth(state: IntegrationState): IntegrationHealth[] {
  return integrationCatalog.map((service) => ({
    id: service.id,
    connected: state[service.id],
    status: state[service.id] ? 'connected' : 'disconnected',
    note: state[service.id]
      ? `${service.label} is ready for automation.`
      : `Connect ${service.label} to enable this workflow.`,
  }))
}
