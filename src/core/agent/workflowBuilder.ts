export type WorkflowStep = {
  id: string
  title: string
  action: string
  requiresApproval: boolean
}

export type WorkflowTemplate = {
  id: string
  name: string
  domain: 'messaging' | 'research' | 'content' | 'ops'
  steps: WorkflowStep[]
  createdAt: string
  updatedAt: string
}

export const defaultWorkflows: WorkflowTemplate[] = [
  {
    id: 'wf-whatsapp-followup',
    name: 'WhatsApp Follow-up Loop',
    domain: 'messaging',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    steps: [
      {
        id: 'wf-step-1',
        title: 'Open WhatsApp chat',
        action: 'agent.whatsapp.execute',
        requiresApproval: false,
      },
      {
        id: 'wf-step-2',
        title: 'Draft and send message',
        action: 'agent.whatsapp.execute',
        requiresApproval: true,
      },
      {
        id: 'wf-step-3',
        title: 'Read incoming reply',
        action: 'agent.whatsapp.execute',
        requiresApproval: false,
      },
    ],
  },
  {
    id: 'wf-research-brief',
    name: 'Research to Brief',
    domain: 'research',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    steps: [
      {
        id: 'wf-step-4',
        title: 'Search web sources',
        action: 'agent.browser.execute',
        requiresApproval: false,
      },
      {
        id: 'wf-step-5',
        title: 'Summarize findings',
        action: 'agent.learning.execute',
        requiresApproval: false,
      },
      {
        id: 'wf-step-6',
        title: 'Email final brief',
        action: 'agent.email.execute',
        requiresApproval: true,
      },
    ],
  },
]

function nowIso(): string {
  return new Date().toISOString()
}

export function addWorkflowStep(template: WorkflowTemplate, title: string, action: string): WorkflowTemplate {
  const next = {
    id: `wf-step-${Date.now().toString(36)}`,
    title,
    action,
    requiresApproval: false,
  }

  return {
    ...template,
    updatedAt: nowIso(),
    steps: [...template.steps, next],
  }
}

export function moveWorkflowStep(
  template: WorkflowTemplate,
  stepId: string,
  direction: 'up' | 'down',
): WorkflowTemplate {
  const index = template.steps.findIndex((step) => step.id === stepId)
  if (index < 0) {
    return template
  }

  const targetIndex = direction === 'up' ? index - 1 : index + 1
  if (targetIndex < 0 || targetIndex >= template.steps.length) {
    return template
  }

  const nextSteps = [...template.steps]
  const [picked] = nextSteps.splice(index, 1)
  nextSteps.splice(targetIndex, 0, picked)

  return {
    ...template,
    updatedAt: nowIso(),
    steps: nextSteps,
  }
}

export function toggleWorkflowApproval(template: WorkflowTemplate, stepId: string): WorkflowTemplate {
  return {
    ...template,
    updatedAt: nowIso(),
    steps: template.steps.map((step) =>
      step.id === stepId
        ? {
            ...step,
            requiresApproval: !step.requiresApproval,
          }
        : step,
    ),
  }
}
