'use strict'

const { contextBridge, ipcRenderer } = require('electron')

// Expose a narrow, typed Raizen API to the renderer via contextBridge.
// No Node.js built-ins are used here — all heavy lifting is done in main via IPC.
contextBridge.exposeInMainWorld('raizen', {
    stats: {
      databaseSize: () => ipcRenderer.invoke('raizen:stats:databaseSize'),
    },
  admin: {
    unlock: (codeword) => ipcRenderer.invoke('raizen:admin:unlock', codeword),
    status: () => ipcRenderer.invoke('raizen:admin:status'),
    lock: () => ipcRenderer.invoke('raizen:admin:lock'),
  },
  audit: {
    append: (entry) => ipcRenderer.invoke('raizen:audit:append', entry),
    load: () => ipcRenderer.invoke('raizen:audit:load'),
  },
    simulatePack: (input) => ipcRenderer.invoke('raizen:terminal:pack:simulate', input),
    evaluate: (request) => ipcRenderer.invoke('raizen:policy:evaluate', request),
    decide: (input) => ipcRenderer.invoke('raizen:policy:decide', input),
    ideate: (input) => ipcRenderer.invoke('raizen:creative:ideate', input),
  action: {
    execute: (input) => ipcRenderer.invoke('raizen:action:execute', input),
    status: () => ipcRenderer.invoke('raizen:bridge:status'),
  access: {
    load: () => ipcRenderer.invoke('raizen:access:load'),
    set: (input) => ipcRenderer.invoke('raizen:access:set', input),
  },
  integrations: {
    getStatus: () => ipcRenderer.invoke('raizen:integrations:getStatus'),
    googleSearch: (input) => ipcRenderer.invoke('raizen:integrations:googleSearch', input),
    threatDashboard: (input) => ipcRenderer.invoke('raizen:security:threatDashboard', input),
  },
  messaging: {
    simulatePolicyDiff: (input) => ipcRenderer.invoke('raizen:governance:simulatePolicyDiff', input),
  },
  learning: {
    load: () => ipcRenderer.invoke('raizen:learning:load'),
    record: (input) => ipcRenderer.invoke('raizen:learning:record', input),
    configure: (input) => ipcRenderer.invoke('raizen:broker:configure', input),
    youtubeSegmentOpen: (input) => ipcRenderer.invoke('raizen:learning:youtubeSegmentOpen', input),
    youtubeSegmentComplete: (input) => ipcRenderer.invoke('raizen:learning:youtubeSegmentComplete', input),
  },
  automation: {
    buildEvidence: (input) => ipcRenderer.invoke('raizen:clinical:buildEvidence', input),
    savePreset: (input) => ipcRenderer.invoke('raizen:automation:savePreset', input),
    deletePreset: (input) => ipcRenderer.invoke('raizen:automation:deletePreset', input),
    previewReplay: (input) => ipcRenderer.invoke('raizen:automation:previewReplay', input),
    theoremPlan: (input) => ipcRenderer.invoke('raizen:science:theoremPlan', input),
    observeLearn: (input) => ipcRenderer.invoke('raizen:automation:observeLearn', input),
    replayRecord: (input) => ipcRenderer.invoke('raizen:automation:replayRecord', input),
    suggestions: () => ipcRenderer.invoke('raizen:automation:suggestions'),
    puppeteer: (input) => ipcRenderer.invoke('raizen:automation:puppeteer', input),
    get: () => ipcRenderer.invoke('raizen:voiceQuality:get'),
      send: (input) => ipcRenderer.invoke('raizen:automation:email:send', input),
    },
  },
  readiness: {
    load: () => ipcRenderer.invoke('raizen:readiness:load'),
    status: () => ipcRenderer.invoke('raizen:optimization:status'),
    verifySession: (input) => ipcRenderer.invoke('raizen:readiness:verifySession', input),
    rollbackSession: (input) => ipcRenderer.invoke('raizen:readiness:rollbackSession', input),
    executeRollback: (input) => ipcRenderer.invoke('raizen:readiness:executeRollback', input),
    status: () => ipcRenderer.invoke('raizen:relay:status'),
    captureStepEvidence: (input) => ipcRenderer.invoke('raizen:readiness:captureStepEvidence', input),
    captureObservation: (input) => ipcRenderer.invoke('raizen:readiness:captureObservation', input),
    planMission: (input) => ipcRenderer.invoke('raizen:readiness:planMission', input),
    graph: () => ipcRenderer.invoke('raizen:readiness:graph'),
    queryGraph: (input) => ipcRenderer.invoke('raizen:readiness:queryGraph', input),
    attestationStatus: () => ipcRenderer.invoke('raizen:readiness:attestationStatus'),
    rotateAttestationKey: (input) => ipcRenderer.invoke('raizen:readiness:rotateAttestationKey', input),
    status: () => ipcRenderer.invoke('raizen:wakeword:status'),
    advanceEvolutionPipeline: (input) => ipcRenderer.invoke('raizen:readiness:advanceEvolutionPipeline', input),
    signGovernancePolicy: (input) => ipcRenderer.invoke('raizen:readiness:signGovernancePolicy', input),
    createVisionJob: (input) => ipcRenderer.invoke('raizen:readiness:createVisionJob', input),
    create: (input) => ipcRenderer.invoke('raizen:planner:create', input),
    runOcr: (input) => ipcRenderer.invoke('raizen:readiness:runOcr', input),
    createEvidenceArtifact: (input) => ipcRenderer.invoke('raizen:readiness:createEvidenceArtifact', input),
  },
  ecosystem: {
    register: (input) => ipcRenderer.invoke('raizen:ecosystem:register', input),
    list: () => ipcRenderer.invoke('raizen:ecosystem:list'),
    remove: (id) => ipcRenderer.invoke('raizen:ecosystem:remove', id),
    plan: (input) => ipcRenderer.invoke('raizen:ecosystem:plan', input),
  },
  program: {
    status: () => ipcRenderer.invoke('raizen:program:status'),
  },
  devices: {
    list: () => ipcRenderer.invoke('raizen:devices:list'),
    register: (input) => ipcRenderer.invoke('raizen:devices:register', input),
  },
  robotics: {
    register: (input) => ipcRenderer.invoke('raizen:robotics:register', input),
    plan: (input) => ipcRenderer.invoke('raizen:robotics:plan', input),
  },
  learningV2: {
    update: (input) => ipcRenderer.invoke('raizen:learning:v2:update', input),
    status: () => ipcRenderer.invoke('raizen:vault:status'),
  },
  trading: {
    backtest: (input) => ipcRenderer.invoke('raizen:trading:backtest', input),
  },
  perception: {
    sceneGraph: (input) => ipcRenderer.invoke('raizen:perception:sceneGraph', input),
    groundFrame: (input) => ipcRenderer.invoke('raizen:perception:groundFrame', input),
  },
  checkpoint: {
    list: (scriptId) => ipcRenderer.invoke('raizen:checkpoint:list', scriptId),
    load: () => ipcRenderer.invoke('raizen:workspace:load'),
  },
  social: {
    schedule: (input) => ipcRenderer.invoke('raizen:social:schedule', input),
    ideas: (input) => ipcRenderer.invoke('raizen:social:ideas', input),
    pickFile: () => ipcRenderer.invoke('raizen:library:pickFile'),
    steps: (input) => ipcRenderer.invoke('raizen:social:steps', input),
  },
  medical: {
    review: (input) => ipcRenderer.invoke('raizen:medical:review', input),
    adviceCheck: (input) => ipcRenderer.invoke('raizen:medical:adviceCheck', input),
  },
  media: {
    generate: (input) => ipcRenderer.invoke('raizen:media:generate', input),
  },
  notify: (input) => ipcRenderer.invoke('raizen:notify', input),
  assistant: {
    getRuntime: () => ipcRenderer.invoke('raizen:assistant:getRuntime'),
    create: (input) => ipcRenderer.invoke('raizen:checkpoint:create', input),
    list: (scriptId) => ipcRenderer.invoke('raizen:checkpoint:list', scriptId)
  },
  voice: {
    call: (input) => ipcRenderer.invoke('raizen:voice:call', input),
    getProvider: () => ipcRenderer.invoke('raizen:voice:provider:get'),
    setProvider: (input) => ipcRenderer.invoke('raizen:voice:provider:set', input),
    getSecrets: () => ipcRenderer.invoke('raizen:voice:secrets:get'),
    setSecrets: (input) => ipcRenderer.invoke('raizen:voice:secrets:set', input),
  },
  workflow: {
    generate: (input) => ipcRenderer.invoke('raizen:workflow:generate', input),
  },
  terminal: {
    plan: (input) => ipcRenderer.invoke('raizen:terminal:plan', input),
    run: (input) => ipcRenderer.invoke('raizen:terminal:run', input),
    listPacks: () => ipcRenderer.invoke('raizen:terminal:pack:list'),
    createPack: (input) => ipcRenderer.invoke('raizen:terminal:pack:create', input),
    activatePack: (input) => ipcRenderer.invoke('raizen:terminal:pack:activate', input),
    simulatePack: (input) => ipcRenderer.invoke('raizen:terminal:pack:simulate', input),
  },
  creative: {
    ideate: (input) => ipcRenderer.invoke('raizen:creative:ideate', input),
  },
  bridge: {
    status: () => ipcRenderer.invoke('raizen:bridge:status'),
    start: (input) => ipcRenderer.invoke('raizen:bridge:start', input),
    stop: () => ipcRenderer.invoke('raizen:bridge:stop'),
    approve: (input) => ipcRenderer.invoke('raizen:bridge:approve', input),
    rotateSecret: () => ipcRenderer.invoke('raizen:bridge:rotateSecret'),
    issueToken: (input) => ipcRenderer.invoke('raizen:bridge:issueToken', input),
  },
  security: {
    threatDashboard: (input) => ipcRenderer.invoke('raizen:security:threatDashboard', input),
  },
  governancePlus: {
    simulatePolicyDiff: (input) => ipcRenderer.invoke('raizen:governance:simulatePolicyDiff', input),
    buildCanaryPlan: (input) => ipcRenderer.invoke('raizen:governance:buildCanaryPlan', input),
    checkAnomalies: (input) => ipcRenderer.invoke('raizen:governance:checkAnomalies', input),
  },
  brokerLive: {
    configure: (input) => ipcRenderer.invoke('raizen:broker:configure', input),
    previewOrder: (input) => ipcRenderer.invoke('raizen:broker:previewOrder', input),
    executeOrder: (input) => ipcRenderer.invoke('raizen:broker:executeOrder', input),
  },
  clinical: {
    buildEvidence: (input) => ipcRenderer.invoke('raizen:clinical:buildEvidence', input),
    validateEvidence: (input) => ipcRenderer.invoke('raizen:clinical:validateEvidence', input),
  },
  science: {
    theoremPlan: (input) => ipcRenderer.invoke('raizen:science:theoremPlan', input),
    simulationPlan: (input) => ipcRenderer.invoke('raizen:science:simulationPlan', input),
    researchProgram: (input) => ipcRenderer.invoke('raizen:science:researchProgram', input),
  },
  voiceQuality: {
    get: () => ipcRenderer.invoke('raizen:voiceQuality:get'),
    status: () => ipcRenderer.invoke('raizen:voiceQuality:status'),
    update: (input) => ipcRenderer.invoke('raizen:voiceQuality:update', input),
    evaluate: (input) => ipcRenderer.invoke('raizen:voiceQuality:evaluate', input),
  },
  optimization: {
    status: () => ipcRenderer.invoke('raizen:optimization:status'),
    run: (input) => ipcRenderer.invoke('raizen:optimization:run', input),
  },
  relay: {
    status: () => ipcRenderer.invoke('raizen:relay:status'),
    configure: (input) => ipcRenderer.invoke('raizen:relay:configure', input),
    submit: (input) => ipcRenderer.invoke('raizen:relay:submit', input),
    sync: () => ipcRenderer.invoke('raizen:relay:sync'),
    complete: (input) => ipcRenderer.invoke('raizen:relay:complete', input),
    envelope: (input) => ipcRenderer.invoke('raizen:relay:envelope', input),
  },
  wakeword: {
    status: () => ipcRenderer.invoke('raizen:wakeword:status'),
    configure: (input) => ipcRenderer.invoke('raizen:wakeword:configure', input),
  },
  planner: {
    create: (input) => ipcRenderer.invoke('raizen:planner:create', input),
    advance: (input) => ipcRenderer.invoke('raizen:planner:advance', input),
  },
  ecosystem: {
    register: (input) => ipcRenderer.invoke('raizen:ecosystem:register', input),
    list: () => ipcRenderer.invoke('raizen:ecosystem:list'),
    remove: (id) => ipcRenderer.invoke('raizen:ecosystem:remove', id),
    plan: (input) => ipcRenderer.invoke('raizen:ecosystem:plan', input),
  },
  robotics: {
    register: (input) => ipcRenderer.invoke('raizen:robotics:register', input),
    plan: (input) => ipcRenderer.invoke('raizen:robotics:plan', input),
  },
  vault: {
    status: () => ipcRenderer.invoke('raizen:vault:status'),
    configure: (input) => ipcRenderer.invoke('raizen:vault:configure', input),
  },
  perception: {
    sceneGraph: (input) => ipcRenderer.invoke('raizen:perception:sceneGraph', input),
    groundFrame: (input) => ipcRenderer.invoke('raizen:perception:groundFrame', input),
  },
  workspace: {
    load: () => ipcRenderer.invoke('raizen:workspace:load'),
    save: (input) => ipcRenderer.invoke('raizen:workspace:save', input),
    clear: () => ipcRenderer.invoke('raizen:workspace:clear'),
  },
  library: {
    pickFile: () => ipcRenderer.invoke('raizen:library:pickFile'),
    load: () => ipcRenderer.invoke('raizen:library:load'),
    save: (input) => ipcRenderer.invoke('raizen:library:save', input),
    clear: () => ipcRenderer.invoke('raizen:library:clear'),
  },
  swarm: {
    start: (input) => ipcRenderer.invoke('raizen:swarm:start', input),
    status: () => ipcRenderer.invoke('raizen:swarm:status'),
    kill: (id) => ipcRenderer.invoke('raizen:swarm:kill', id),
    stopAll: () => ipcRenderer.invoke('raizen:swarm:stopAll'),
  },
  notify: (input) => ipcRenderer.invoke('raizen:notify', input),
  // Checkpoint APIs
  checkpoint: {
    create: (input) => ipcRenderer.invoke('raizen:checkpoint:create', input),
    list: (scriptId) => ipcRenderer.invoke('raizen:checkpoint:list', scriptId)
  },
})
