export type FoundationKnowledgePack = {
  name: string
  content: string
}

export const FOUNDATION_KNOWLEDGE_PACKS: FoundationKnowledgePack[] = [
  {
    name: 'Foundation: Scientific Thinking and Reasoning',
    content: [
      'Scientific reasoning starts with falsifiable hypotheses, measurable variables, and repeatable experiments.',
      'Strong reasoning separates observation from interpretation: first what happened, then why it may have happened.',
      'Use base rates to avoid overconfidence from rare anecdotal events. Ask: how often does this happen generally?',
      'Prefer causal diagrams over intuition for complex systems with feedback loops and delayed effects.',
      'When evidence conflicts, update beliefs proportionally instead of switching to absolute certainty.',
      'Practical method: define claim, define test, collect data, evaluate uncertainty, revise model, repeat.',
    ].join('\n\n'),
  },
  {
    name: 'Foundation: Mathematics and Problem Solving',
    content: [
      'Problem solving in math improves by converting words into symbolic constraints and checking unit consistency.',
      'Break hard problems into smaller lemmas: prove each piece, then compose.',
      'Optimization problems usually require objective function, constraints, and validation with edge cases.',
      'In numerical work, stability matters as much as correctness: watch overflow, underflow, and precision loss.',
      'For algorithms, reason about time and space first, then choose data structures that fit access patterns.',
      'Always test with adversarial inputs, not only average examples.',
    ].join('\n\n'),
  },
  {
    name: 'Foundation: Systems Design and Reliability',
    content: [
      'Define service goals with explicit latency, availability, and correctness targets before choosing architecture.',
      'Separate stateless compute from stateful storage to scale and recover independently.',
      'Use queues to absorb bursts and isolate slow dependencies; use idempotency for safe retries.',
      'Reliability improves with observability: metrics, traces, logs, and alerts tied to user-facing impact.',
      'Decompose by bounded contexts, not by technology only, to keep ownership clear.',
      'Prepare graceful degradation paths for dependency outages and partial failures.',
    ].join('\n\n'),
  },
  {
    name: 'Foundation: Software Engineering Practices',
    content: [
      'Readable code prioritizes clear naming, small functions, explicit contracts, and deterministic behavior.',
      'Use tests to protect behavior, especially around boundaries and failure modes.',
      'Refactoring should preserve external behavior while reducing complexity and improving maintainability.',
      'Code reviews are strongest when they focus on correctness, security, performance, and long-term clarity.',
      'Version control hygiene: small commits, meaningful messages, and reproducible build steps.',
      'Automate linting, formatting, and tests to reduce manual drift.',
    ].join('\n\n'),
  },
  {
    name: 'Foundation: Security and Threat Modeling',
    content: [
      'Threat modeling starts from assets, actors, trust boundaries, and realistic attack paths.',
      'Least privilege reduces blast radius: grant only required capabilities and expire sensitive access.',
      'Validate and sanitize all external input, including files, URLs, and command strings.',
      'Store secrets in dedicated secure stores and rotate credentials regularly.',
      'Use defense in depth: policy gates, auditing, anomaly detection, and immutable critical controls.',
      'Security requires continuous monitoring and incident response drills, not one-time checklists.',
    ].join('\n\n'),
  },
  {
    name: 'Foundation: Data, Statistics, and Decision Quality',
    content: [
      'Good decisions require clean data, known assumptions, and uncertainty estimates.',
      'Distinguish correlation from causation; confounders can create misleading patterns.',
      'Use confidence intervals and effect sizes, not p-values alone, for practical interpretation.',
      'Sampling bias can invalidate conclusions even when models seem accurate.',
      'Decision frameworks should include reversibility, downside risk, and expected value.',
      'Track outcomes and feedback loops so models improve with real-world performance.',
    ].join('\n\n'),
  },
  {
    name: 'Foundation: Learning Science and Skill Building',
    content: [
      'Learning retention improves with active recall, spaced repetition, and deliberate practice.',
      'Short cycles work best: study concept, apply immediately, review mistakes, refine mental model.',
      'Skill growth requires measurable goals and weekly review of bottlenecks.',
      'Cognitive load drops when tasks are chunked and linked to prior knowledge.',
      'Feedback must be specific and timely to change behavior effectively.',
      'Consistency beats intensity: sustainable daily practice outperforms occasional long sessions.',
    ].join('\n\n'),
  },
  {
    name: 'Foundation: Communication, Leadership, and Collaboration',
    content: [
      'Clear communication separates facts, interpretation, and requests.',
      'Use concise status format: objective, progress, blockers, next actions, owner.',
      'Healthy collaboration requires explicit ownership and written decisions for traceability.',
      'Conflict resolution improves when both sides restate each other before proposing solutions.',
      'Leadership is leverage: create systems, not heroics, and unblock others early.',
      'Strong teams document assumptions to reduce ambiguity and repeated mistakes.',
    ].join('\n\n'),
  },
  {
    name: 'Foundation: Product Thinking and User Experience',
    content: [
      'Product quality starts with user problems, context, and measurable success criteria.',
      'Prioritize by impact, confidence, effort, and strategic alignment.',
      'Design for clarity first: reduce friction, reveal state, and provide actionable feedback.',
      'Usability testing should include novice and expert users to capture different failure modes.',
      'Instrument user flows to observe drop-off and confusion points.',
      'Iterate with evidence: release, measure, learn, and adjust roadmap.',
    ].join('\n\n'),
  },
  {
    name: 'Foundation: AI and LLM Application Patterns',
    content: [
      'LLM systems are strongest with retrieval grounding, task decomposition, and explicit evaluation loops.',
      'Prompting should define role, constraints, output schema, and quality checks.',
      'Use hybrid approach: symbolic rules for safety + model reasoning for ambiguity.',
      'Hallucination risk drops when answers cite trusted sources and expose confidence levels.',
      'Agent workflows need tool constraints, audit traces, and fallback behavior on uncertainty.',
      'Model quality should be measured with task-specific benchmarks and human review.',
    ].join('\n\n'),
  },
  {
    name: 'Foundation: Career, Strategy, and Execution Discipline',
    content: [
      'Strategy converts vision into constrained choices and sequenced bets.',
      'Execution quality depends on clear goals, visible priorities, and consistent review cadence.',
      'Build anti-fragile plans: small reversible steps for uncertain environments.',
      'Manage energy and focus as scarce resources; protect deep work windows.',
      'Track leading indicators early, not only lagging outcomes.',
      'When stuck, narrow scope, ship a minimal result, and iterate from evidence.',
    ].join('\n\n'),
  },
  {
    name: 'Foundation: Physics and Engineering Intuition',
    content: [
      'Physical reasoning starts with conservation laws: energy, momentum, and mass flow boundaries.',
      'Model systems using simplified assumptions first, then add realism incrementally.',
      'Dimensional analysis catches many modeling mistakes early.',
      'Trade-offs in engineering often involve efficiency, safety margin, and maintenance complexity.',
      'Control systems need stability analysis under delay, disturbance, and measurement noise.',
      'Use back-of-the-envelope estimates to quickly reject impossible designs.',
    ].join('\n\n'),
  },
  {
    name: 'Foundation: Chemistry and Materials Thinking',
    content: [
      'Chemical behavior depends on structure, bonding, concentration, and environment.',
      'Reaction feasibility requires both thermodynamic and kinetic consideration.',
      'In process design, purity, yield, and safety constraints must be balanced.',
      'Material selection should account for temperature, corrosion, fatigue, and manufacturability.',
      'Lab interpretation improves when controls and calibration are explicit.',
      'Scale-up from lab to production usually introduces nonlinear process effects.',
    ].join('\n\n'),
  },
  {
    name: 'Foundation: Biology and Human Systems',
    content: [
      'Biological systems are adaptive and context dependent; single-cause explanations are often incomplete.',
      'Homeostasis and feedback loops are central to physiological regulation.',
      'Population-level findings do not always map directly to individual outcomes.',
      'In health reasoning, prioritize risk stratification and evidence hierarchy.',
      'Interventions should consider adherence, side effects, and real-world constraints.',
      'Interpret findings with uncertainty and avoid deterministic language when evidence is limited.',
    ].join('\n\n'),
  },
  {
    name: 'Foundation: Medicine and Clinical Safety Reasoning',
    content: [
      'Clinical reasoning should separate differential diagnosis, triage urgency, and treatment planning.',
      'Red-flag symptoms require escalation to qualified medical professionals.',
      'Medication safety includes dose checks, contraindications, and interaction risk.',
      'Evidence-informed care balances guidelines with patient-specific context.',
      'Document assumptions, uncertainties, and follow-up conditions explicitly.',
      'In ambiguous cases, safety-first recommendations and escalation criteria are essential.',
    ].join('\n\n'),
  },
  {
    name: 'Foundation: Economics and Market Dynamics',
    content: [
      'Economic outcomes emerge from incentives, constraints, and information asymmetry.',
      'Macro trends and micro behavior interact; model both when making strategic decisions.',
      'Pricing power depends on differentiation, switching costs, and substitute availability.',
      'Forecasting should include scenarios, not single-point predictions.',
      'Use marginal analysis for resource allocation under scarcity.',
      'Track second-order effects when introducing policy or pricing changes.',
    ].join('\n\n'),
  },
  {
    name: 'Foundation: Finance, Risk, and Capital Allocation',
    content: [
      'Capital allocation quality depends on expected return, downside risk, and liquidity needs.',
      'Risk management requires position sizing, diversification, and stop conditions.',
      'Cash flow resilience matters more than headline profit in stressed environments.',
      'Use stress tests and scenario analysis for uncertain regimes.',
      'Avoid leverage without strict risk controls and contingency plans.',
      'Decision logs improve discipline and reduce hindsight bias.',
    ].join('\n\n'),
  },
  {
    name: 'Foundation: Law, Governance, and Compliance Thinking',
    content: [
      'Compliance starts from obligations, controls, evidence, and accountability ownership.',
      'Policy without enforceable processes creates hidden risk.',
      'Auditability requires tamper-evident logs and traceable decision pathways.',
      'Regulatory reasoning should map controls to specific obligations.',
      'When uncertain, escalate to legal review rather than improvising policy exceptions.',
      'Document retention and access controls are core to defensible operations.',
    ].join('\n\n'),
  },
  {
    name: 'Foundation: Psychology, Behavior, and Motivation',
    content: [
      'Behavior change is easier with environment design than with willpower alone.',
      'Bias awareness improves decision quality but does not remove bias automatically.',
      'Motivation increases when goals are specific, meaningful, and progress is visible.',
      'Emotional regulation benefits from naming states and reducing decision load.',
      'Habits are sustained by cue-routine-reward loops and friction management.',
      'Feedback should target behavior and process, not identity.',
    ].join('\n\n'),
  },
  {
    name: 'Foundation: Philosophy, Logic, and Epistemology',
    content: [
      'Logical reasoning requires clear premises, valid inference, and explicit conclusion scope.',
      'Epistemic humility means calibrating certainty to evidence strength.',
      'Distinguish normative claims (what should be) from descriptive claims (what is).',
      'Resolve disagreement by identifying hidden assumptions and evaluation criteria.',
      'Use steel-manning: represent the strongest version of opposing views before critique.',
      'Good inquiry updates beliefs through argument quality and empirical validation.',
    ].join('\n\n'),
  },
  {
    name: 'Foundation: History, Geopolitics, and Strategy Context',
    content: [
      'Historical analysis improves by comparing incentives, institutions, and constraints across periods.',
      'Geopolitical outcomes often involve multi-actor strategic interactions, not single causes.',
      'Path dependency explains why legacy decisions constrain present options.',
      'Scenario planning should include low-probability high-impact shifts.',
      'Narratives can distort facts; prioritize primary evidence and corroboration.',
      'Strategic positioning requires understanding alliances, dependencies, and leverage points.',
    ].join('\n\n'),
  },
  {
    name: 'Foundation: Cloud, DevOps, and Platform Operations',
    content: [
      'Platform reliability depends on automated provisioning, observability, and safe deployment gates.',
      'Use immutable infrastructure and versioned configuration for reproducibility.',
      'CI/CD quality improves with staged validation and rollback readiness.',
      'Capacity planning should align with traffic patterns and SLO targets.',
      'Incident response requires runbooks, ownership, and blameless postmortems.',
      'Security posture in cloud environments needs least privilege and secret rotation discipline.',
    ].join('\n\n'),
  },
  {
    name: 'Foundation: Databases, Data Modeling, and Query Design',
    content: [
      'Choose storage models based on access patterns, consistency needs, and scale profile.',
      'Schema design should balance normalization with practical query performance.',
      'Indexes accelerate reads but add write cost; measure real workloads.',
      'Transaction boundaries define consistency guarantees and failure behavior.',
      'Avoid unbounded queries in latency-sensitive paths; paginate and cache strategically.',
      'Data quality requires constraints, validation, and lineage tracking.',
    ].join('\n\n'),
  },
  {
    name: 'Foundation: Networking and Distributed Communication',
    content: [
      'Networked systems fail in partial ways: latency spikes, packet loss, and partition events.',
      'Protocol choice should match reliability, ordering, and throughput requirements.',
      'Timeouts, retries, and circuit breakers are baseline resilience controls.',
      'Backpressure handling prevents cascading failures under load.',
      'Observability across services needs correlation IDs and end-to-end tracing.',
      'Design with idempotency for safe retries and duplicate message handling.',
    ].join('\n\n'),
  },
  {
    name: 'Foundation: UX Writing, Information Architecture, and Clarity',
    content: [
      'Microcopy should reduce ambiguity and guide next action clearly.',
      'Information architecture should match user mental models and task frequency.',
      'Error states need actionable recovery steps, not only failure labels.',
      'Readable UI content uses short sentences, specific verbs, and progressive disclosure.',
      'Consistency in labels and interaction patterns improves trust and speed.',
      'Measure comprehension with user testing, not internal assumptions.',
    ].join('\n\n'),
  },
  {
    name: 'Foundation: Negotiation, Sales, and Stakeholder Alignment',
    content: [
      'Negotiation quality depends on preparation, alternatives, and understanding counterpart incentives.',
      'Value framing should connect directly to measurable business outcomes.',
      'Discovery questions reduce solution mismatch and improve proposal relevance.',
      'Stakeholder alignment needs explicit trade-offs and decision records.',
      'Objection handling is strongest when concerns are acknowledged and quantified.',
      'Long-term trust is built by consistency, transparency, and delivery reliability.',
    ].join('\n\n'),
  },
  {
    name: 'Foundation: Startup Execution and Growth Systems',
    content: [
      'Early-stage execution requires sharp prioritization around one core user value.',
      'Growth loops are stronger than one-off campaigns when retention is healthy.',
      'Test hypotheses quickly with clear success criteria and short feedback cycles.',
      'Unit economics should be monitored before scaling spend aggressively.',
      'Team velocity improves with clear ownership and reduced coordination overhead.',
      'Document playbooks for repeated workflows to preserve quality during scale.',
    ].join('\n\n'),
  },
  {
    name: 'Foundation: Research Methods and Evidence Synthesis',
    content: [
      'Research quality depends on method fit, sample adequacy, and reproducibility.',
      'Triangulate evidence from multiple sources to reduce single-source bias.',
      'Synthesis should separate high-confidence findings from tentative hypotheses.',
      'Maintain citations and traceability for each major claim.',
      'Use structured review templates to compare conflicting studies objectively.',
      'Conclude with actionable implications and uncertainty boundaries.',
    ].join('\n\n'),
  },
]
