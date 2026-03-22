const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, dialog } = require('electron')
const path = require('path')
const { autoUpdater } = require('electron-updater')
const { registerIpcHandlers } = require('./ipc-handlers.cjs')

const devServerUrl = process.env.RAIZEN_DEV_SERVER_URL
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
  tray.setToolTip('The Raizen')
  tray.on('double-click', () => {
    if (mainWindowRef) {
      mainWindowRef.show()
      mainWindowRef.focus()
    }
  })

  const menu = Menu.buildFromTemplate([
    {
      label: 'Show Raizen',
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
      label: 'Quit Raizen',
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
      label: 'Show Raizen',
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
      label: 'Quit Raizen',
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

  ipcMain.removeHandler('raizen:assistant:getRuntime')
  ipcMain.removeHandler('raizen:assistant:setRuntime')
  ipcMain.removeHandler('raizen:assistant:showWindow')

  ipcMain.handle('raizen:assistant:getRuntime', () => {
    return {
      closeToTrayEnabled,
    }
  })

  ipcMain.handle('raizen:assistant:setRuntime', (_event, input) => {
    closeToTrayEnabled = Boolean(input?.closeToTrayEnabled)
    createTrayMenu()
    return {
      ok: true,
      closeToTrayEnabled,
    }
  })

  ipcMain.handle('raizen:assistant:showWindow', () => {
    if (mainWindowRef) {
      mainWindowRef.show()
      mainWindowRef.focus()
    }
    return {
      ok: true,
    }
  })

  createWindow()

  // Auto-updater configuration
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', () => {
    mainWindowRef?.webContents.send('update-available')
  })

  autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox({
      type: 'info',
      title: 'Update Ready',
      message: 'A new version of Raizen is ready to install. Restart now?',
      buttons: ['Restart', 'Later']
    }).then((result) => {
      if (result.response === 0) autoUpdater.quitAndInstall()
    })
  })

  autoUpdater.checkForUpdatesAndNotify()

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
