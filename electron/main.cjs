const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain } = require('electron')
const path = require('path')
const { registerIpcHandlers } = require('./ipc-handlers.cjs')

const devServerUrl = process.env.PAXION_DEV_SERVER_URL
const debugWindow = process.env.PAXION_DEBUG_WINDOW === '1'
const disableGpu = process.env.PAXION_DISABLE_GPU === '1'
const forceGpu = process.env.PAXION_ENABLE_GPU === '1'
const disableGpuByDefault = process.platform === 'win32'
const shouldDisableGpu = (disableGpuByDefault || disableGpu) && !forceGpu

if (shouldDisableGpu) {
  app.disableHardwareAcceleration()
  app.commandLine.appendSwitch('disable-gpu-compositing')
}

let tray = null
let mainWindowRef = null
let closeToTrayEnabled = true
let alwaysOnWakewordEnabled = false
let wakewordInterval = null
let forceQuit = false

function logWindowDebug(message, details) {
  if (!debugWindow) {
    return
  }
  if (details === undefined) {
    console.log(`[paxion-window] ${message}`)
    return
  }
  console.log(`[paxion-window] ${message}`, details)
}

function createTray() {
  if (tray) {
    return tray
  }

  const icon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/w8AAgMBAQEA7VsAAAAASUVORK5CYII=',
  )
  tray = new Tray(icon)
  tray.setToolTip('The Paxion')
  tray.on('double-click', () => {
    if (mainWindowRef) {
      mainWindowRef.show()
      mainWindowRef.focus()
    }
  })

  const menu = Menu.buildFromTemplate([
    {
      label: 'Show Paxion',
      click: () => {
        if (mainWindowRef) {
          mainWindowRef.show()
          mainWindowRef.focus()
        }
      },
    },
    {
      label: closeToTrayEnabled ? 'Disable Close-To-Tray' : 'Enable Close-To-Tray',
      click: () => {
        closeToTrayEnabled = !closeToTrayEnabled
        if (tray) {
          createTrayMenu()
        }
      },
    },
    {
      label: alwaysOnWakewordEnabled ? 'Disable Always-On Wakeword' : 'Enable Always-On Wakeword',
      click: () => {
        alwaysOnWakewordEnabled = !alwaysOnWakewordEnabled
        if (alwaysOnWakewordEnabled) {
          startWakewordBackgroundLoop()
        } else {
          stopWakewordBackgroundLoop()
        }
        createTrayMenu()
      },
    },
    { type: 'separator' },
    {
      label: 'Quit Paxion',
      click: () => {
        forceQuit = true
        app.quit()
      },
    },
  ])
  tray.setContextMenu(menu)
  return tray
}

function createTrayMenu() {
  if (!tray) {
    return
  }
  const menu = Menu.buildFromTemplate([
    {
      label: 'Show Paxion',
      click: () => {
        if (mainWindowRef) {
          mainWindowRef.show()
          mainWindowRef.focus()
        }
      },
    },
    {
      label: closeToTrayEnabled ? 'Disable Close-To-Tray' : 'Enable Close-To-Tray',
      click: () => {
        closeToTrayEnabled = !closeToTrayEnabled
        createTrayMenu()
      },
    },
    {
      label: alwaysOnWakewordEnabled ? 'Disable Always-On Wakeword' : 'Enable Always-On Wakeword',
      click: () => {
        alwaysOnWakewordEnabled = !alwaysOnWakewordEnabled
        if (alwaysOnWakewordEnabled) {
          startWakewordBackgroundLoop()
        } else {
          stopWakewordBackgroundLoop()
        }
        createTrayMenu()
      },
    },
    { type: 'separator' },
    {
      label: 'Quit Paxion',
      click: () => {
        forceQuit = true
        app.quit()
      },
    },
  ])
  tray.setContextMenu(menu)
// --- Wakeword background loop ---
function startWakewordBackgroundLoop() {
  if (wakewordInterval) return
  // Poll every 2 seconds for wakeword detection (replace with real engine integration)
  wakewordInterval = setInterval(async () => {
    try {
      // TODO: Replace with real native wakeword detection call
      // Simulate detection for demo: randomly trigger
      if (Math.random() < 0.01) {
        if (mainWindowRef) {
          mainWindowRef.show()
          mainWindowRef.focus()
          mainWindowRef.webContents.send('wakeword-detected')
        }
      }
    } catch (err) {
      // Log error, optionally notify user
    }
  }, 2000)
}

function stopWakewordBackgroundLoop() {
  if (wakewordInterval) {
    clearInterval(wakewordInterval)
    wakewordInterval = null
  }
}
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1040,
    minHeight: 720,
    backgroundColor: '#10181d',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  })

  mainWindowRef = mainWindow
  registerIpcHandlers(mainWindow)

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    logWindowDebug('did-fail-load', { errorCode, errorDescription, validatedURL })
  })

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    logWindowDebug('render-process-gone', details)
  })

  mainWindow.webContents.on('preload-error', (_event, preloadPath, error) => {
    logWindowDebug('preload-error', {
      preloadPath,
      message: error?.message,
      stack: error?.stack,
    })
  })

  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    if (!debugWindow) {
      return
    }
    const levels = ['verbose', 'info', 'warning', 'error']
    const label = levels[level] ?? `level-${level}`
    console.log(`[paxion-renderer:${label}] ${sourceId}:${line} ${message}`)
  })

  mainWindow.webContents.on('did-finish-load', () => {
    logWindowDebug('did-finish-load', mainWindow.webContents.getURL())
    if (!debugWindow) {
      return
    }
    void mainWindow.webContents
      .executeJavaScript(
        `(() => {
          const root = document.getElementById('root');
          const children = root ? root.childElementCount : -1;
          const textSize = root ? (root.textContent || '').trim().length : -1;
          return { children, textSize };
        })();`,
      )
      .then((snapshot) => {
        logWindowDebug('root-snapshot', snapshot)
      })
      .catch((error) => {
        logWindowDebug('root-snapshot-error', error?.message || String(error))
      })
  })

  mainWindow.on('close', (event) => {
    if (forceQuit) {
      return
    }
    if (closeToTrayEnabled) {
      event.preventDefault()
      mainWindow.hide()
    }
  })

  if (devServerUrl) {
    logWindowDebug('loadURL', devServerUrl)
    mainWindow.loadURL(devServerUrl)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
    return
  }

  const indexPath = path.join(__dirname, '..', 'dist', 'index.html')
  logWindowDebug('loadFile', indexPath)
  mainWindow.loadFile(indexPath)
}

app.whenReady().then(() => {
  createTray()

  ipcMain.removeHandler('paxion:assistant:getRuntime')
  ipcMain.removeHandler('paxion:assistant:setRuntime')
  ipcMain.removeHandler('paxion:assistant:showWindow')

  ipcMain.handle('paxion:assistant:getRuntime', () => {
    return {
      closeToTrayEnabled,
    }
  })

  ipcMain.handle('paxion:assistant:setRuntime', (_event, input) => {
    closeToTrayEnabled = Boolean(input?.closeToTrayEnabled)
    createTrayMenu()
    return {
      ok: true,
      closeToTrayEnabled,
    }
  })

  ipcMain.handle('paxion:assistant:showWindow', () => {
    if (mainWindowRef) {
      mainWindowRef.show()
      mainWindowRef.focus()
    }
    return {
      ok: true,
    }
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && !closeToTrayEnabled) {
    app.quit()
  }
})
