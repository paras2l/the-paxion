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
    runAdapter: (input) => ipcRenderer.invoke('paxion:automation:runAdapter', input),
    observeLearn: (input) => ipcRenderer.invoke('paxion:automation:observeLearn', input),
    replayRecord: (input) => ipcRenderer.invoke('paxion:automation:replayRecord', input),
    suggestions: () => ipcRenderer.invoke('paxion:automation:suggestions'),
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
