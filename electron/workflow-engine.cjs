'use strict'

function tokenizeKnowledge(input) {
  return String(input || '')
    .split(/\r?\n|\.\s+/)
    .map((line) => line.trim())
    .filter(Boolean)
}

function inferSkillTags(input) {
  const text = String(input || '').toLowerCase()
  const tags = []
  if (/api|http|rest|graphql/.test(text)) tags.push('API Integration')
  if (/test|qa|assert|coverage/.test(text)) tags.push('Testing')
  if (/deploy|release|ci|cd/.test(text)) tags.push('Delivery Pipeline')
  if (/data|model|ml|ai/.test(text)) tags.push('AI/Data Workflow')
  if (/security|policy|audit|compliance/.test(text)) tags.push('Security Governance')
  return tags.length > 0 ? tags : ['General Workflow']
}

function generateWorkflow(input) {
  const goal = String(input?.goal || '').trim() || 'Build a reliable workflow from provided knowledge'
  const knowledgeText = String(input?.knowledgeText || '')
  const lines = tokenizeKnowledge(knowledgeText).slice(0, 18)
  const skillTags = inferSkillTags(`${goal}\n${knowledgeText}`)

  const seedSteps = lines.length > 0
    ? lines.map((line, idx) => ({
        id: `wf-step-${idx + 1}`,
        title: `Knowledge action ${idx + 1}`,
        objective: line,
        owner: 'paxion',
        status: 'planned',
      }))
    : [
        {
          id: 'wf-step-1',
          title: 'Clarify objective',
          objective: 'Convert the goal into measurable deliverables and constraints.',
          owner: 'paxion',
          status: 'planned',
        },
      ]

  const hardeningSteps = [
    {
      id: `wf-step-${seedSteps.length + 1}`,
      title: 'Risk and policy gate',
      objective: 'Run policy preview, check approvals, and attach audit-safe execution plan.',
      owner: 'paxion',
      status: 'planned',
    },
    {
      id: `wf-step-${seedSteps.length + 2}`,
      title: 'Validation loop',
      objective: 'Execute tests/lint/verification and generate fallback rollback notes.',
      owner: 'paxion',
      status: 'planned',
    },
  ]

  return {
    ok: true,
    workflow: {
      id: `wf-${Date.now().toString(36)}`,
      goal,
      generatedAt: new Date().toISOString(),
      skillTags,
      phases: [
        { id: 'phase-discovery', title: 'Discovery', stepIds: seedSteps.slice(0, Math.ceil(seedSteps.length / 2)).map((s) => s.id) },
        { id: 'phase-build', title: 'Build', stepIds: seedSteps.slice(Math.ceil(seedSteps.length / 2)).map((s) => s.id) },
        { id: 'phase-hardening', title: 'Hardening', stepIds: hardeningSteps.map((s) => s.id) },
      ],
      steps: [...seedSteps, ...hardeningSteps],
    },
  }
}

module.exports = {
  generateWorkflow,
  inferSkillTags,
}
