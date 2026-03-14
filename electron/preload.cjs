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
  workspace: {
    load: () => ipcRenderer.invoke('paxion:workspace:load'),
    save: (input) => ipcRenderer.invoke('paxion:workspace:save', input),
    clear: () => ipcRenderer.invoke('paxion:workspace:clear'),
  },
  library: {
    pickFile: () => ipcRenderer.invoke('paxion:library:pickFile'),
  },
})
