'use strict'

function resolveTemplateVariables(template, variables) {
  return String(template || '').replace(/{{\s*([a-zA-Z0-9_-]+)\s*}}/g, (_full, key) => {
    return Object.prototype.hasOwnProperty.call(variables || {}, key) ? String(variables[key] || '') : `{{${key}}}`
  })
}

function getExecutionSessionId(record) {
  return typeof record?.metadata?.sessionId === 'string' ? record.metadata.sessionId : null
}

function getExecutionSequence(records, sourceRecord) {
  const sessionId = getExecutionSessionId(sourceRecord)
  const sequence = sessionId
    ? records.filter((entry) => getExecutionSessionId(entry) === sessionId)
    : [sourceRecord]

  return [...sequence].sort((a, b) => String(a.timestamp || '').localeCompare(String(b.timestamp || '')))
}

function buildReplayPreviewPayload(sourceRecord, records, ttlMs, previewToken) {
  const relatedRecords = getExecutionSequence(records || [], sourceRecord)
  const targetUrl = typeof sourceRecord?.metadata?.targetUrl === 'string' ? sourceRecord.metadata.targetUrl : null
  const intent = typeof sourceRecord?.metadata?.intent === 'string' ? sourceRecord.metadata.intent : null

  return {
    previewToken,
    sourceRecord,
    relatedRecords,
    targetUrl,
    intent,
    stepDiffs: relatedRecords.map((record) => ({
      recordId: record.id,
      originalIntendedStep: record.intendedStep,
      replayIntendedStep: record.intendedStep,
      originalPerformedStep: record.performedStep,
      replayPerformedStep: `Replay executed from record ${record.id}.`,
      originalResult: record.result,
      replayResult: 'replayed',
    })),
    expiresAt: Date.now() + Math.max(1000, Number(ttlMs || 0)),
  }
}

function rankCapabilitySuggestions(rules, capabilityState, skills) {
  const lowerSkills = Array.isArray(skills) ? skills.map((entry) => String(entry).toLowerCase()) : []

  return (Array.isArray(rules) ? rules : [])
    .map((rule) => {
      const capability = String(rule?.capability || '').trim()
      if (!capability || capabilityState?.[capability] === true) {
        return null
      }

      const anySkills = Array.isArray(rule?.anySkills) ? rule.anySkills.map((entry) => String(entry)) : []
      const matchedSkills = anySkills.filter((skill) => lowerSkills.includes(skill.toLowerCase()))
      if (matchedSkills.length === 0) {
        return null
      }

      const unmetPrerequisites = Array.isArray(rule?.prerequisites)
        ? rule.prerequisites.filter((key) => capabilityState?.[key] !== true).map((entry) => String(entry))
        : []

      const confidence = Math.max(
        5,
        Math.min(
          100,
          Math.round((matchedSkills.length / Math.max(1, anySkills.length)) * 75 + (unmetPrerequisites.length === 0 ? 25 : 10)),
        ),
      )

      return {
        capability,
        reason: String(rule?.reason || ''),
        recommendedAction:
          unmetPrerequisites.length === 0
            ? `Ready to enable capability \"${capability}\" from the workspace suggestion panel.`
            : `Enable prerequisite capabilities first: ${unmetPrerequisites.join(', ')}.`,
        confidence,
        matchedSkills,
        unmetPrerequisites,
        readyToEnable: unmetPrerequisites.length === 0,
      }
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.readyToEnable !== b.readyToEnable) {
        return a.readyToEnable ? -1 : 1
      }
      return b.confidence - a.confidence
    })
}

function buildCrossAppMission(goal, surfaces, targetPacks) {
  const normalizedGoal = String(goal || '').trim() || 'Untitled mission'
  const surfaceList = Array.isArray(surfaces)
    ? surfaces.filter((entry) => typeof entry === 'string' && entry.trim()).map((entry) => entry.trim())
    : []
  const phases = []

  phases.push({
    id: 'phase-observe',
    title: 'Observe and collect context',
    surface: surfaceList[0] || 'workspace',
    objective: `Collect current state relevant to mission: ${normalizedGoal}`,
  })

  for (const surface of surfaceList) {
    phases.push({
      id: `phase-${surface.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      title: `Operate in ${surface}`,
      surface,
      objective: `Execute approved workflow steps in ${surface} for mission: ${normalizedGoal}`,
    })
  }

  const recommendedPacks = (Array.isArray(targetPacks) ? targetPacks : [])
    .filter((pack) => surfaceList.includes(pack.surface))
    .slice(0, 4)
    .map((pack) => ({ id: pack.id, name: pack.name, surface: pack.surface }))

  phases.push({
    id: 'phase-verify',
    title: 'Verify and rollback check',
    surface: 'workspace',
    objective: 'Verify intended outcomes, capture evidence, and prepare rollback if needed.',
  })

  return {
    id: `mission-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    goal: normalizedGoal,
    surfaces: surfaceList,
    recommendedPacks,
    phases,
    createdAt: new Date().toISOString(),
    status: 'planned',
  }
}

function buildLearningGraphSnapshot(input) {
  const skills = Array.isArray(input?.skills) ? input.skills : []
  const logs = Array.isArray(input?.logs) ? input.logs : []
  const executionRecords = Array.isArray(input?.executionRecords) ? input.executionRecords : []
  const observations = Array.isArray(input?.observations) ? input.observations : []
  const visionJobs = Array.isArray(input?.visionJobs) ? input.visionJobs : []

  const nodes = []
  const edges = []
  const seenNodes = new Set()

  function pushNode(id, kind, label) {
    if (!id || seenNodes.has(id)) {
      return
    }
    seenNodes.add(id)
    nodes.push({ id, kind, label })
  }

  for (const skill of skills) {
    pushNode(`skill:${skill}`, 'skill', String(skill))
  }

  for (const entry of logs) {
    const sourceId = `log:${entry.id}`
    pushNode(sourceId, 'learning-log', String(entry.title || 'Learning log'))
    for (const skill of Array.isArray(entry?.newSkills) ? entry.newSkills : []) {
      pushNode(`skill:${skill}`, 'skill', String(skill))
      edges.push({ from: sourceId, to: `skill:${skill}`, kind: 'teaches' })
    }
  }

  for (const record of executionRecords) {
    const recordId = `exec:${record.id}`
    pushNode(recordId, 'execution', String(record.simpleLog || record.intendedStep || record.id))
    if (record.adapterId) {
      const workflowId = `workflow:${record.adapterId}`
      pushNode(workflowId, 'workflow', String(record.adapterId))
      edges.push({ from: workflowId, to: recordId, kind: 'runs' })
    }
    for (const skill of Array.isArray(record?.newSkills) ? record.newSkills : []) {
      pushNode(`skill:${skill}`, 'skill', String(skill))
      edges.push({ from: recordId, to: `skill:${skill}`, kind: 'teaches' })
    }
  }

  for (const observation of observations) {
    const observationId = `observation:${observation.id}`
    pushNode(observationId, 'observation', String(observation.title || observation.appType || observation.id))
    if (observation.appType) {
      const appId = `app:${observation.appType}`
      pushNode(appId, 'app', String(observation.appType))
      edges.push({ from: appId, to: observationId, kind: 'observed-in' })
    }
    for (const skill of Array.isArray(observation?.inferredSkills) ? observation.inferredSkills : []) {
      pushNode(`skill:${skill}`, 'skill', String(skill))
      edges.push({ from: observationId, to: `skill:${skill}`, kind: 'suggests' })
    }
  }

  for (const job of visionJobs) {
    const jobId = `vision:${job.id}`
    pushNode(jobId, 'vision-job', String(job.objective || job.id))
    if (job.status) {
      const statusId = `vision-status:${job.status}`
      pushNode(statusId, 'status', String(job.status))
      edges.push({ from: jobId, to: statusId, kind: 'has-status' })
    }
  }

  return {
    nodes,
    edges,
    updatedAt: new Date().toISOString(),
  }
}

function parseVersionParts(input) {
  const parts = String(input || '')
    .split(/[^0-9]+/)
    .filter(Boolean)
    .map((entry) => Number(entry))
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0]
}

function compareVersions(left, right) {
  const a = parseVersionParts(left)
  const b = parseVersionParts(right)
  for (let index = 0; index < 3; index += 1) {
    if (a[index] > b[index]) {
      return 1
    }
    if (a[index] < b[index]) {
      return -1
    }
  }
  return 0
}

function versionSatisfies(version, constraint) {
  const target = String(version || '').trim()
  const raw = String(constraint || '').trim()
  if (!raw || !target) {
    return false
  }

  let operator = '='
  let value = raw
  if (raw.startsWith('>=')) {
    operator = '>='
    value = raw.slice(2)
  } else if (raw.startsWith('<=')) {
    operator = '<='
    value = raw.slice(2)
  } else if (raw.startsWith('>')) {
    operator = '>'
    value = raw.slice(1)
  } else if (raw.startsWith('<')) {
    operator = '<'
    value = raw.slice(1)
  } else if (raw.startsWith('==')) {
    operator = '='
    value = raw.slice(2)
  }

  const compared = compareVersions(target, value)
  if (operator === '>=') {
    return compared >= 0
  }
  if (operator === '<=') {
    return compared <= 0
  }
  if (operator === '>') {
    return compared > 0
  }
  if (operator === '<') {
    return compared < 0
  }
  return compared === 0
}

function selectVersionedPackProfile(profiles, appVersion) {
  const rows = Array.isArray(profiles) ? profiles : []
  const version = String(appVersion || '').trim()
  if (!version || rows.length === 0) {
    return null
  }

  for (const profile of rows) {
    if (!profile || typeof profile !== 'object') {
      continue
    }
    const constraints = Array.isArray(profile.constraints)
      ? profile.constraints.filter((entry) => typeof entry === 'string' && entry.trim())
      : []
    if (constraints.length === 0) {
      continue
    }
    const matched = constraints.every((constraint) => versionSatisfies(version, constraint))
    if (matched) {
      return profile
    }
  }
  return null
}

function createHashChainEntry(payload, prevHash) {
  const entrySeed = {
    payload,
    prevHash: String(prevHash || 'GENESIS'),
    createdAt: new Date().toISOString(),
  }
  const entryHash = sha256Hex(stableStringify(entrySeed))
  return {
    ...entrySeed,
    entryHash,
  }
}

function queryLearningGraphSnapshot(snapshot, input) {
  const nodes = Array.isArray(snapshot?.nodes) ? snapshot.nodes : []
  const edges = Array.isArray(snapshot?.edges) ? snapshot.edges : []
  const query = input && typeof input === 'object' ? input : {}
  const kindSet = new Set(
    Array.isArray(query.kinds)
      ? query.kinds.filter((entry) => typeof entry === 'string' && entry.trim()).map((entry) => entry.trim())
      : [],
  )
  const searchText = String(query.text || '').trim().toLowerCase()
  const nodeId = String(query.nodeId || '').trim()
  const edgeKind = String(query.edgeKind || '').trim()
  const cursor = Math.max(0, Number(query.cursor || 0))
  const limit = Math.max(1, Math.min(200, Number(query.limit || 40)))

  const degreeByNodeId = new Map()
  for (const edge of edges) {
    if (typeof edge?.from === 'string') {
      degreeByNodeId.set(edge.from, (degreeByNodeId.get(edge.from) || 0) + 1)
    }
    if (typeof edge?.to === 'string') {
      degreeByNodeId.set(edge.to, (degreeByNodeId.get(edge.to) || 0) + 1)
    }
  }

  const filteredNodes = nodes
    .filter((node) => {
      if (!node || typeof node !== 'object') {
        return false
      }
      if (kindSet.size > 0 && !kindSet.has(String(node.kind || ''))) {
        return false
      }
      if (searchText) {
        const haystack = `${String(node.id || '')}\n${String(node.label || '')}`.toLowerCase()
        if (!haystack.includes(searchText)) {
          return false
        }
      }
      if (nodeId && String(node.id || '') !== nodeId) {
        return false
      }
      return true
    })
    .sort((left, right) => {
      const degreeDiff = (degreeByNodeId.get(String(right.id || '')) || 0) - (degreeByNodeId.get(String(left.id || '')) || 0)
      if (degreeDiff !== 0) {
        return degreeDiff
      }
      return String(left.id || '').localeCompare(String(right.id || ''))
    })

  const pagedNodes = filteredNodes.slice(cursor, cursor + limit)
  const nodeIds = new Set(pagedNodes.map((node) => String(node.id || '')))
  const filteredEdges = edges.filter((edge) => {
    if (!edge || typeof edge !== 'object') {
      return false
    }
    if (edgeKind && String(edge.kind || '') !== edgeKind) {
      return false
    }
    return nodeIds.has(String(edge.from || '')) || nodeIds.has(String(edge.to || ''))
  })

  const nextCursor = cursor + pagedNodes.length
  return {
    nodes: pagedNodes,
    edges: filteredEdges,
    page: {
      cursor,
      nextCursor: nextCursor >= filteredNodes.length ? null : nextCursor,
      limit,
      totalNodes: filteredNodes.length,
      totalEdges: filteredEdges.length,
    },
    indexStats: {
      totalSourceNodes: nodes.length,
      totalSourceEdges: edges.length,
      distinctKinds: Array.from(new Set(nodes.map((node) => String(node?.kind || '')))).filter(Boolean).length,
    },
  }
}

function sortValue(value) {
  if (Array.isArray(value)) {
    return value.map(sortValue)
  }
  if (value && typeof value === 'object') {
    const sorted = Object.keys(value)
      .sort()
      .map((key) => [key, sortValue(value[key])])
    return Object.fromEntries(sorted)
  }
  return value
}

function stableStringify(value) {
  return JSON.stringify(sortValue(value))
}

function sha256Hex(text) {
  return require('crypto').createHash('sha256').update(String(text || '')).digest('hex')
}

module.exports = {
  resolveTemplateVariables,
  getExecutionSessionId,
  getExecutionSequence,
  buildReplayPreviewPayload,
  rankCapabilitySuggestions,
  buildCrossAppMission,
  buildLearningGraphSnapshot,
  compareVersions,
  versionSatisfies,
  selectVersionedPackProfile,
  createHashChainEntry,
  queryLearningGraphSnapshot,
}