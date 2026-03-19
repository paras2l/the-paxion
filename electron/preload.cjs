'use strict'

const { contextBridge, ipcRenderer } = require('electron')

// Expose a narrow, typed Paxion API to the renderer via contextBridge.
// No Node.js built-ins are used here — all heavy lifting is done in main via IPC.
contextBridge.exposeInMainWorld('paxion', {
  admin: {
    unlock: (codeword) => ipcRenderer.invoke('paxion:admin:unlock', codeword),
    status: () => ipcRenderer.invoke('paxion:admin:status'),
    lock: () => ipcRenderer.invoke('paxion:admin:lock'),
  },
  audit: {
    append: (entry) => ipcRenderer.invoke('paxion:audit:append', entry),
    load: () => ipcRenderer.invoke('paxion:audit:load'),
  },
  policy: {
    evaluate: (request) => ipcRenderer.invoke('paxion:policy:evaluate', request),
    decide: (input) => ipcRenderer.invoke('paxion:policy:decide', input),
  },
  action: {
    execute: (input) => ipcRenderer.invoke('paxion:action:execute', input),
  },
  access: {
    load: () => ipcRenderer.invoke('paxion:access:load'),
    set: (input) => ipcRenderer.invoke('paxion:access:set', input),
  },
  features: {
    load: () => ipcRenderer.invoke('paxion:features:load'),
    set: (input) => ipcRenderer.invoke('paxion:features:set', input),
  },
  integrations: {
    getStatus: () => ipcRenderer.invoke('paxion:integrations:getStatus'),
    googleSearch: (input) => ipcRenderer.invoke('paxion:integrations:googleSearch', input),
    gptChat: (input) => ipcRenderer.invoke('paxion:integrations:gptChat', input),
  },
  learning: {
    load: () => ipcRenderer.invoke('paxion:learning:load'),
    record: (input) => ipcRenderer.invoke('paxion:learning:record', input),
    sttStatus: () => ipcRenderer.invoke('paxion:learning:sttStatus'),
    youtubePlanCreate: (input) => ipcRenderer.invoke('paxion:learning:youtubePlanCreate', input),
    youtubeSegmentOpen: (input) => ipcRenderer.invoke('paxion:learning:youtubeSegmentOpen', input),
    youtubeSegmentComplete: (input) => ipcRenderer.invoke('paxion:learning:youtubeSegmentComplete', input),
    youtubeSegmentAutoLearn: (input) => ipcRenderer.invoke('paxion:learning:youtubeSegmentAutoLearn', input),
  },
  automation: {
    load: () => ipcRenderer.invoke('paxion:automation:load'),
    savePreset: (input) => ipcRenderer.invoke('paxion:automation:savePreset', input),
    deletePreset: (input) => ipcRenderer.invoke('paxion:automation:deletePreset', input),
    previewReplay: (input) => ipcRenderer.invoke('paxion:automation:previewReplay', input),
    runAdapter: (input) => ipcRenderer.invoke('paxion:automation:runAdapter', input),
    observeLearn: (input) => ipcRenderer.invoke('paxion:automation:observeLearn', input),
    replayRecord: (input) => ipcRenderer.invoke('paxion:automation:replayRecord', input),
    suggestions: () => ipcRenderer.invoke('paxion:automation:suggestions'),
  },
  readiness: {
    load: () => ipcRenderer.invoke('paxion:readiness:load'),
    runTargetPack: (input) => ipcRenderer.invoke('paxion:readiness:runTargetPack', input),
    verifySession: (input) => ipcRenderer.invoke('paxion:readiness:verifySession', input),
    rollbackSession: (input) => ipcRenderer.invoke('paxion:readiness:rollbackSession', input),
    executeRollback: (input) => ipcRenderer.invoke('paxion:readiness:executeRollback', input),
    executeNativeAction: (input) => ipcRenderer.invoke('paxion:readiness:executeNativeAction', input),
    captureStepEvidence: (input) => ipcRenderer.invoke('paxion:readiness:captureStepEvidence', input),
    captureObservation: (input) => ipcRenderer.invoke('paxion:readiness:captureObservation', input),
    planMission: (input) => ipcRenderer.invoke('paxion:readiness:planMission', input),
    graph: () => ipcRenderer.invoke('paxion:readiness:graph'),
    queryGraph: (input) => ipcRenderer.invoke('paxion:readiness:queryGraph', input),
    attestationStatus: () => ipcRenderer.invoke('paxion:readiness:attestationStatus'),
    rotateAttestationKey: (input) => ipcRenderer.invoke('paxion:readiness:rotateAttestationKey', input),
    createEvolutionPipeline: (input) => ipcRenderer.invoke('paxion:readiness:createEvolutionPipeline', input),
    advanceEvolutionPipeline: (input) => ipcRenderer.invoke('paxion:readiness:advanceEvolutionPipeline', input),
    signGovernancePolicy: (input) => ipcRenderer.invoke('paxion:readiness:signGovernancePolicy', input),
    createVisionJob: (input) => ipcRenderer.invoke('paxion:readiness:createVisionJob', input),
    reviewVisionJob: (input) => ipcRenderer.invoke('paxion:readiness:reviewVisionJob', input),
    runOcr: (input) => ipcRenderer.invoke('paxion:readiness:runOcr', input),
    createEvidenceArtifact: (input) => ipcRenderer.invoke('paxion:readiness:createEvidenceArtifact', input),
  },
  program: {
    status: () => ipcRenderer.invoke('paxion:program:status'),
  },
  devices: {
    list: () => ipcRenderer.invoke('paxion:devices:list'),
    register: (input) => ipcRenderer.invoke('paxion:devices:register', input),
    revoke: (input) => ipcRenderer.invoke('paxion:devices:revoke', input),
  },
  learningV2: {
    update: (input) => ipcRenderer.invoke('paxion:learning:v2:update', input),
  },
  trading: {
    backtest: (input) => ipcRenderer.invoke('paxion:trading:backtest', input),
    paperOrder: (input) => ipcRenderer.invoke('paxion:trading:paperOrder', input),
  },
  medical: {
    review: (input) => ipcRenderer.invoke('paxion:medical:review', input),
  },
  media: {
    generate: (input) => ipcRenderer.invoke('paxion:media:generate', input),
  },
  assistant: {
    getRuntime: () => ipcRenderer.invoke('paxion:assistant:getRuntime'),
    setRuntime: (input) => ipcRenderer.invoke('paxion:assistant:setRuntime', input),
    showWindow: () => ipcRenderer.invoke('paxion:assistant:showWindow'),
  },
  voice: {
    call: (input) => ipcRenderer.invoke('paxion:voice:call', input),
    getProvider: () => ipcRenderer.invoke('paxion:voice:provider:get'),
    setProvider: (input) => ipcRenderer.invoke('paxion:voice:provider:set', input),
    getSecrets: () => ipcRenderer.invoke('paxion:voice:secrets:get'),
    setSecrets: (input) => ipcRenderer.invoke('paxion:voice:secrets:set', input),
  },
  workflow: {
    generate: (input) => ipcRenderer.invoke('paxion:workflow:generate', input),
  },
  terminal: {
    plan: (input) => ipcRenderer.invoke('paxion:terminal:plan', input),
    run: (input) => ipcRenderer.invoke('paxion:terminal:run', input),
    listPacks: () => ipcRenderer.invoke('paxion:terminal:pack:list'),
    createPack: (input) => ipcRenderer.invoke('paxion:terminal:pack:create', input),
    activatePack: (input) => ipcRenderer.invoke('paxion:terminal:pack:activate', input),
    simulatePack: (input) => ipcRenderer.invoke('paxion:terminal:pack:simulate', input),
  },
  polyglot: {
    status: () => ipcRenderer.invoke('paxion:polyglot:status'),
    starter: (input) => ipcRenderer.invoke('paxion:polyglot:starter', input),
    brainMesh: (input) => ipcRenderer.invoke('paxion:polyglot:brainMesh', input),
    run: (input) => ipcRenderer.invoke('paxion:polyglot:run', input),
  },
  creative: {
    ideate: (input) => ipcRenderer.invoke('paxion:creative:ideate', input),
  },
  bridge: {
    status: () => ipcRenderer.invoke('paxion:bridge:status'),
    start: (input) => ipcRenderer.invoke('paxion:bridge:start', input),
    stop: () => ipcRenderer.invoke('paxion:bridge:stop'),
    approve: (input) => ipcRenderer.invoke('paxion:bridge:approve', input),
    rotateSecret: () => ipcRenderer.invoke('paxion:bridge:rotateSecret'),
    issueToken: (input) => ipcRenderer.invoke('paxion:bridge:issueToken', input),
  },
  security: {
    threatDashboard: (input) => ipcRenderer.invoke('paxion:security:threatDashboard', input),
  },
  governancePlus: {
    simulatePolicyDiff: (input) => ipcRenderer.invoke('paxion:governance:simulatePolicyDiff', input),
    buildCanaryPlan: (input) => ipcRenderer.invoke('paxion:governance:buildCanaryPlan', input),
    checkAnomalies: (input) => ipcRenderer.invoke('paxion:governance:checkAnomalies', input),
  },
  brokerLive: {
    configure: (input) => ipcRenderer.invoke('paxion:broker:configure', input),
    previewOrder: (input) => ipcRenderer.invoke('paxion:broker:previewOrder', input),
    executeOrder: (input) => ipcRenderer.invoke('paxion:broker:executeOrder', input),
  },
  clinical: {
    buildEvidence: (input) => ipcRenderer.invoke('paxion:clinical:buildEvidence', input),
    validateEvidence: (input) => ipcRenderer.invoke('paxion:clinical:validateEvidence', input),
  },
  science: {
    theoremPlan: (input) => ipcRenderer.invoke('paxion:science:theoremPlan', input),
    simulationPlan: (input) => ipcRenderer.invoke('paxion:science:simulationPlan', input),
    researchProgram: (input) => ipcRenderer.invoke('paxion:science:researchProgram', input),
  },
  voiceQuality: {
    status: () => ipcRenderer.invoke('paxion:voiceQuality:status'),
    update: (input) => ipcRenderer.invoke('paxion:voiceQuality:update', input),
    evaluate: (input) => ipcRenderer.invoke('paxion:voiceQuality:evaluate', input),
  },
  optimization: {
    status: () => ipcRenderer.invoke('paxion:optimization:status'),
    run: (input) => ipcRenderer.invoke('paxion:optimization:run', input),
  },
  relay: {
    status: () => ipcRenderer.invoke('paxion:relay:status'),
    configure: (input) => ipcRenderer.invoke('paxion:relay:configure', input),
    submit: (input) => ipcRenderer.invoke('paxion:relay:submit', input),
    sync: () => ipcRenderer.invoke('paxion:relay:sync'),
    complete: (input) => ipcRenderer.invoke('paxion:relay:complete', input),
    envelope: (input) => ipcRenderer.invoke('paxion:relay:envelope', input),
  },
  wakeword: {
    status: () => ipcRenderer.invoke('paxion:wakeword:status'),
    configure: (input) => ipcRenderer.invoke('paxion:wakeword:configure', input),
  },
  planner: {
    create: (input) => ipcRenderer.invoke('paxion:planner:create', input),
    advance: (input) => ipcRenderer.invoke('paxion:planner:advance', input),
  },
  ecosystem: {
    register: (input) => ipcRenderer.invoke('paxion:ecosystem:register', input),
    plan: (input) => ipcRenderer.invoke('paxion:ecosystem:plan', input),
  },
  robotics: {
    register: (input) => ipcRenderer.invoke('paxion:robotics:register', input),
    plan: (input) => ipcRenderer.invoke('paxion:robotics:plan', input),
  },
  vault: {
    status: () => ipcRenderer.invoke('paxion:vault:status'),
    configure: (input) => ipcRenderer.invoke('paxion:vault:configure', input),
  },
  perception: {
    sceneGraph: (input) => ipcRenderer.invoke('paxion:perception:sceneGraph', input),
    groundFrame: (input) => ipcRenderer.invoke('paxion:perception:groundFrame', input),
  },
  workspace: {
    load: () => ipcRenderer.invoke('paxion:workspace:load'),
    save: (input) => ipcRenderer.invoke('paxion:workspace:save', input),
    clear: () => ipcRenderer.invoke('paxion:workspace:clear'),
  },
  library: {
    pickFile: () => ipcRenderer.invoke('paxion:library:pickFile'),
    ingestWebUrl: (input) => ipcRenderer.invoke('paxion:library:ingestWebUrl', input),
    ingestYoutube: (input) => ipcRenderer.invoke('paxion:library:ingestYoutube', input),
    load: () => ipcRenderer.invoke('paxion:library:load'),
    save: (input) => ipcRenderer.invoke('paxion:library:save', input),
    clear: () => ipcRenderer.invoke('paxion:library:clear'),
  },
})
