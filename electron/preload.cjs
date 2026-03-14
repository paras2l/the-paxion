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
  integrations: {
    getStatus: () => ipcRenderer.invoke('paxion:integrations:getStatus'),
    googleSearch: (input) => ipcRenderer.invoke('paxion:integrations:googleSearch', input),
    gptChat: (input) => ipcRenderer.invoke('paxion:integrations:gptChat', input),
  },
  learning: {
    load: () => ipcRenderer.invoke('paxion:learning:load'),
    record: (input) => ipcRenderer.invoke('paxion:learning:record', input),
    youtubePlanCreate: (input) => ipcRenderer.invoke('paxion:learning:youtubePlanCreate', input),
    youtubeSegmentOpen: (input) => ipcRenderer.invoke('paxion:learning:youtubeSegmentOpen', input),
    youtubeSegmentComplete: (input) => ipcRenderer.invoke('paxion:learning:youtubeSegmentComplete', input),
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
  workspace: {
    load: () => ipcRenderer.invoke('paxion:workspace:load'),
    save: (input) => ipcRenderer.invoke('paxion:workspace:save', input),
    clear: () => ipcRenderer.invoke('paxion:workspace:clear'),
  },
  library: {
    pickFile: () => ipcRenderer.invoke('paxion:library:pickFile'),
    load: () => ipcRenderer.invoke('paxion:library:load'),
    save: (input) => ipcRenderer.invoke('paxion:library:save', input),
    clear: () => ipcRenderer.invoke('paxion:library:clear'),
  },
})
