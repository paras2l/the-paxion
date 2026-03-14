const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain } = require('electron')
const path = require('path')
const { registerIpcHandlers } = require('./ipc-handlers.cjs')

const devServerUrl = process.env.PAXION_DEV_SERVER_URL
let tray = null
let mainWindowRef = null
let closeToTrayEnabled = true
let forceQuit = false

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
    mainWindow.loadURL(devServerUrl)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
    return
  }

  mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
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
