'use strict'

const { BrowserWindow } = require('electron')
const path = require('path')

const threadKiller = require('./common/thread_killer')
const webSetting = require('./common/web_setting')

const util = require('legoflow-engine/util')
const legoflowProject = require('legoflow-project')

let mainWindow = void 0
let settingWindow = void 0

module.exports = (app) => {
  const personConfig = JSON.parse(decodeURI(process.argv[ 3 ] || '{}'))

  global.__util = util
  global.__notifier = require('./common/notifier')

  const { config } = require('../package.json')

  global.__config = Object.assign({
    version: app.getVersion(),
    root: path.resolve(__dirname, '../').pathNorm(),
    system: process.platform == 'win32' ? 'win' : 'mac',
    appEnv: process.argv[ 2 ] || 'build'
  }, config)

  threadKiller()

  return async () => {
    const projectType = Object.keys(await legoflowProject.getProjectType())

    let { system, appEnv, root } = __config

    let devViewAddress = 'localhost:3000'

    if (appEnv !== 'build' && personConfig.devViewAddress) {
      devViewAddress = personConfig.devViewAddress

      console.log('[DEV VIEW ADDRESS]', devViewAddress)
    }

    let option = {
      resizable: false,
      fullscreen: false,
      show: false,
      width: 280,
      height: 480
    }

    if (system === 'mac') {
      option.frame = false
      option.autoHideMenuBar = true
    } else {
      option.width = 285
    }

    if (appEnv === 'dev') {
      option.show = true
      option.width = 800
    }

    mainWindow = new BrowserWindow(option)

    webSetting.init(mainWindow)

    const viewFolder = path.resolve(root, './view')

    appEnv === 'dev' ? mainWindow.loadURL(`http://${devViewAddress}`) : mainWindow.loadURL(`file://${viewFolder}/index.html`)

    await webSetting.setConfig()

    appEnv === 'dev' && mainWindow.webContents.openDevTools({ mode: 'right' })

    mainWindow.webContents.executeJavaScript(`window.localStorage[ '@newProjectType' ] = '${JSON.stringify(projectType)}'`)

    global.__messager = require('./common/messager')(mainWindow)

    if (appEnv === 'dev') {
      mainWindow.loadURL(`http://${devViewAddress}/#/app`)
    } else {
      /* eslint-disable no-template-curly-in-string */
      mainWindow.webContents.executeJavaScript('location.href = `${ location.href }app`')
    }

    mainWindow.setMenu(null)

    mainWindow.on('closed', app.quit)

    // render setting window
    settingWindow = new BrowserWindow({
      width: 300,
      height: 430,
      resizable: false,
      fullscreen: false,
      fullscreenable: false,
      maximizable: false,
      center: true,
      show: false
    })

    settingWindow.setMenu(null)

    if (appEnv === 'dev') {
      settingWindow.loadURL(`http://${devViewAddress}/#/setting`)
    } else {
      settingWindow.loadURL(`file://${viewFolder}/index.html`)
      settingWindow.webContents.executeJavaScript('location.href = `${ location.href }setting`')
    }

    app.on('before-quit', () => settingWindow.webContents.send('APP_QUIT'))

    // to create tray
    require('./tray')(mainWindow)

    // render IPC
    require('./ipc')(app, mainWindow, settingWindow)

    mainWindow.on('blur', () => mainWindow.webContents.send('MAIN_WINDOW_BLUR'))

    app.on('activate', () => mainWindow.show())
  }
}
