'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const {
  buildLearningGraphSnapshot,
  createHashChainEntry,
  queryLearningGraphSnapshot,
  selectVersionedPackProfile,
} = require('./readiness-utils.cjs')

test('readiness lifecycle integration: pack compatibility, evidence chain, and graph query', () => {
  const compatibilityProfiles = [
    { id: 'wp-modern', constraints: ['>=6.6'], selectors: { publish: '#publish' } },
    { id: 'wp-legacy', constraints: ['<6.6'], selectors: { publish: '#publish-legacy' } },
  ]
  const profile = selectVersionedPackProfile(compatibilityProfiles, '6.7.1')
  assert.equal(profile?.id, 'wp-modern')

  const stepEvidencePayload = {
    sessionId: 'session-a',
    stepId: 'step-1',
    evidenceRefs: ['auto:state.json', 'auto:screen.png'],
  }
  const chain1 = createHashChainEntry(stepEvidencePayload, 'GENESIS')
  const chain2 = createHashChainEntry(
    {
      ...stepEvidencePayload,
      stepId: 'step-2',
    },
    chain1.entryHash,
  )

  assert.equal(chain1.prevHash, 'GENESIS')
  assert.equal(chain2.prevHash, chain1.entryHash)
  assert.equal(chain1.entryHash.length, 64)
  assert.equal(chain2.entryHash.length, 64)

  const graph = buildLearningGraphSnapshot({
    skills: ['Verification Workflow', 'Evidence Packaging'],
    logs: [
      {
        id: 'l1',
        title: 'Evidence artifact created',
        newSkills: ['Evidence Packaging'],
      },
    ],
    executionRecords: [
      {
        id: 'exec-1',
        simpleLog: 'Native action executed',
        intendedStep: 'Click publish',
        adapterId: 'native.execution.v1',
        newSkills: ['Verification Workflow'],
      },
    ],
    observations: [],
    visionJobs: [],
  })

  const query = queryLearningGraphSnapshot(graph, {
    text: 'Evidence',
    kinds: ['skill', 'learning-log'],
    limit: 10,
    cursor: 0,
  })

  assert.equal(query.nodes.length > 0, true)
  assert.equal(query.page.totalNodes >= 1, true)
  assert.equal(query.indexStats.totalSourceNodes >= query.nodes.length, true)
})
