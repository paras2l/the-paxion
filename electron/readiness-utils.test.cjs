'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const {
  buildCrossAppMission,
  buildLearningGraphSnapshot,
  buildReplayPreviewPayload,
  rankCapabilitySuggestions,
  resolveTemplateVariables,
} = require('./readiness-utils.cjs')

test('resolveTemplateVariables replaces placeholders', () => {
  assert.equal(
    resolveTemplateVariables('https://{{host}}/post/{{id}}', { host: 'example.com', id: '42' }),
    'https://example.com/post/42',
  )
})

test('rankCapabilitySuggestions sorts ready items before blocked ones', () => {
  const suggestions = rankCapabilitySuggestions(
    [
      {
        capability: 'webAppAutomation',
        anySkills: ['CMS Content Editing'],
        prerequisites: ['workspaceExecution'],
        reason: 'Ready for web ops.',
      },
      {
        capability: 'selfEvolution',
        anySkills: ['Debugging Workflow'],
        prerequisites: ['workspaceTooling'],
        reason: 'Needs tooling first.',
      },
    ],
    {
      workspaceExecution: true,
      workspaceTooling: false,
      webAppAutomation: false,
      selfEvolution: false,
    },
    ['CMS Content Editing', 'Debugging Workflow'],
  )

  assert.equal(suggestions[0].capability, 'webAppAutomation')
  assert.equal(suggestions[0].readyToEnable, true)
  assert.equal(suggestions[1].capability, 'selfEvolution')
  assert.equal(suggestions[1].readyToEnable, false)
})

test('buildReplayPreviewPayload groups records by session', () => {
  const records = [
    {
      id: 'exec-1',
      timestamp: '2026-03-14T10:00:00.000Z',
      intendedStep: 'click save',
      performedStep: 'clicked save',
      result: 'queued-supervised',
      metadata: { sessionId: 'session-a', targetUrl: 'https://example.com', intent: 'Save draft' },
    },
    {
      id: 'exec-2',
      timestamp: '2026-03-14T10:01:00.000Z',
      intendedStep: 'extract status',
      performedStep: 'captured status',
      result: 'queued-supervised',
      metadata: { sessionId: 'session-a' },
    },
  ]

  const preview = buildReplayPreviewPayload(records[0], records, 3000, 'token-1')
  assert.equal(preview.relatedRecords.length, 2)
  assert.equal(preview.previewToken, 'token-1')
  assert.equal(preview.targetUrl, 'https://example.com')
})

test('buildCrossAppMission creates phases and recommended packs', () => {
  const mission = buildCrossAppMission('Review PR and update docs', ['browser', 'editor'], [
    { id: 'pack.github', name: 'GitHub Review', surface: 'browser' },
    { id: 'pack.vscode', name: 'VS Code Update', surface: 'editor' },
  ])

  assert.equal(mission.phases.length >= 3, true)
  assert.equal(mission.recommendedPacks.length, 2)
})

test('buildLearningGraphSnapshot links logs and observations to skills', () => {
  const graph = buildLearningGraphSnapshot({
    skills: ['React UI Development'],
    logs: [{ id: 'l1', title: 'Learned React', newSkills: ['React UI Development'] }],
    executionRecords: [],
    observations: [{ id: 'o1', title: 'CMS capture', appType: 'cms', inferredSkills: ['CMS Content Editing'] }],
    visionJobs: [{ id: 'v1', objective: 'Read screenshot', status: 'queued' }],
  })

  assert.equal(graph.nodes.some((node) => node.id === 'skill:React UI Development'), true)
  assert.equal(graph.edges.some((edge) => edge.kind === 'suggests'), true)
  assert.equal(graph.edges.some((edge) => edge.kind === 'has-status'), true)
})