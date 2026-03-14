'use strict'

function buildSceneGraph(input) {
  const objects = Array.isArray(input?.objects) ? input.objects.map((x) => String(x)) : []
  const relations = Array.isArray(input?.relations) ? input.relations.map((x) => String(x)) : []
  return {
    ok: true,
    sceneGraph: {
      nodes: objects.map((label, index) => ({ id: `obj-${index + 1}`, label })),
      edges: relations.map((label, index) => ({ id: `rel-${index + 1}`, label })),
      grounding: String(input?.grounding || 'manual-frame-grounding'),
      generatedAt: new Date().toISOString(),
    },
  }
}

function groundPerceptionFrame(input) {
  return {
    ok: true,
    frame: {
      frameId: String(input?.frameId || `frame-${Date.now().toString(36)}`),
      summary: String(input?.summary || ''),
      confidence: Math.max(0, Math.min(1, Number(input?.confidence || 0.5))),
      realtime: Boolean(input?.realtime),
    },
  }
}

module.exports = {
  buildSceneGraph,
  groundPerceptionFrame,
}
