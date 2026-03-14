'use strict'

function splitFacts(input) {
  return String(input || '')
    .split(/\r?\n|\.\s+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 40)
}

function generateCreativeHypotheses(input) {
  const domain = String(input?.domain || 'general').trim()
  const objective = String(input?.objective || '').trim() || 'Generate novel research directions'
  const corpus = splitFacts(input?.knowledgeText)

  const anchors = corpus.slice(0, 8)
  const hypotheses = anchors.map((fact, idx) => ({
    id: `idea-${idx + 1}`,
    title: `Hypothesis ${idx + 1}: ${domain} bridge`,
    idea: `If we reinterpret "${fact}" using a cross-domain lens, we may unlock a new explanatory path for ${objective}.`,
    method: 'Construct simulation and falsification test using constrained assumptions.',
    confidence: Math.max(0.2, 0.72 - idx * 0.06),
  }))

  if (hypotheses.length === 0) {
    hypotheses.push({
      id: 'idea-1',
      title: `Hypothesis 1: ${domain} baseline`,
      idea: `Build a minimal testable model for ${objective} and iterate with contradiction-driven refinement.`,
      method: 'Define assumptions, derive predictions, and run comparative checks.',
      confidence: 0.45,
    })
  }

  return {
    ok: true,
    lab: {
      id: `lab-${Date.now().toString(36)}`,
      domain,
      objective,
      generatedAt: new Date().toISOString(),
      hypotheses,
      nextActions: [
        'Select top 2 hypotheses by confidence and novelty.',
        'Run simulation or derivation for each hypothesis.',
        'Record contradiction map and iterate assumptions.',
      ],
      safetyNote: 'Creative outputs are exploratory and must be experimentally validated before claims are treated as fact.',
    },
  }
}

module.exports = {
  generateCreativeHypotheses,
}
