import { app, BrowserWindow } from 'electron'
import path from 'path'
import fs from 'fs'
import { fork } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let nuxtProcess = null
let mainWindow = null

const isProd = app.isPackaged
const PORT = 13000

/**
 * 获取 extraResources 中资源的物理路径
 * 生产环境: resources/nuxt-server/...
 * 开发环境: .output/...
 */
function getResourcePath(relPath) {
  if (isProd) {
    return path.join(process.resourcesPath, relPath)
  }
  return path.join(app.getAppPath(), relPath)
}

/**
 * 解析 .env 文件内容为键值对对象
 */
function parseEnvFile(filePath) {
  const envVars = {}
  try {
    if (!fs.existsSync(filePath)) return envVars
    const content = fs.readFileSync(filePath, 'utf-8')
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIndex = trimmed.indexOf('=')
      if (eqIndex === -1) continue
      const key = trimmed.substring(0, eqIndex).trim()
      const value = trimmed.substring(eqIndex + 1).trim()
      if (key) envVars[key] = value
    }
  } catch (e) {
    console.error('Failed to parse .env file:', e)
  }
  return envVars
}

/**
 * 加载环境变量：
 * 1. 优先从用户数据目录读取 .env（用户可自行修改）
 * 2. 如果不存在，则从安装包中的模板复制一份过去
 */
function loadEnv() {
  const userDataPath = app.getPath('userData')
  const userEnvPath = path.join(userDataPath, '.env')

  if (!fs.existsSync(userEnvPath)) {
    // 从 extraResources 中复制模板
    const templateEnvPath = getResourcePath('.env')
    if (fs.existsSync(templateEnvPath)) {
      try {
        fs.mkdirSync(userDataPath, { recursive: true })
        fs.copyFileSync(templateEnvPath, userEnvPath)
        console.log('Copied .env template to:', userEnvPath)
      } catch (e) {
        console.error('Failed to copy .env template:', e)
      }
    }
  }

  return parseEnvFile(userEnvPath)
}

function startNuxtServer() {
  return new Promise((resolve, reject) => {
    const userDataPath = app.getPath('userData')
    let dbUrl

    if (isProd) {
      // 确保数据库在可写目录
      const dbPath = path.join(userDataPath, 'dev.db')
      if (!fs.existsSync(dbPath)) {
        const templateDbPath = getResourcePath('prisma/release.db')
        console.log('Copying database template from:', templateDbPath)
        try {
          fs.mkdirSync(userDataPath, { recursive: true })
          if (fs.existsSync(templateDbPath)) {
            fs.copyFileSync(templateDbPath, dbPath)
          }
        } catch (e) {
          console.error('Failed to copy database:', e)
        }
      }
      dbUrl = `file:${dbPath}`
    } else {
      dbUrl = process.env.DATABASE_URL || 'file:./prisma/dev.db'
    }

    console.log('DATABASE_URL:', dbUrl)

    if (isProd) {
      // 生产环境：从 extraResources 目录启动 Nuxt 服务
      const serverPath = getResourcePath('nuxt-server/server/index.mjs')
      const logPath = path.join(userDataPath, 'server.log')

      console.log('Server path:', serverPath)
      console.log('Log path:', logPath)

      if (!fs.existsSync(serverPath)) {
        reject(new Error(`Server not found: ${serverPath}`))
        return
      }

      // Nuxt 服务直接运行在 resources/nuxt-server/server/ 下
      // 该目录已包含完整的 node_modules（含 .prisma）
      // Node.js 模块解析会自然地找到同级的 node_modules
      const envVars = loadEnv()
      console.log('Loaded env vars:', Object.keys(envVars).join(', '))

      nuxtProcess = fork(serverPath, [], {
        cwd: path.dirname(serverPath),
        env: {
          ...process.env,
          ...envVars,
          PORT: PORT.toString(),
          NODE_ENV: 'production',
          DATABASE_URL: dbUrl
        },
        stdio: ['ignore', 'pipe', 'pipe', 'ipc']
      })

      // 写日志
      try {
        const logStream = fs.createWriteStream(logPath, { flags: 'a' })
        logStream.write(`\n--- Server Start: ${new Date().toISOString()} ---\n`)
        nuxtProcess.stdout.pipe(logStream)
        nuxtProcess.stderr.pipe(logStream)
      } catch (e) {
        console.error('Log stream error:', e)
      }

      nuxtProcess.stdout.on('data', (data) => {
        const msg = data.toString()
        if (msg.includes('Listening on') || msg.includes('http://')) {
          resolve()
        }
      })

      nuxtProcess.on('exit', (code) => {
        console.log(`Nuxt server exited: ${code}`)
      })

      nuxtProcess.on('error', (err) => {
        console.error('Nuxt server error:', err)
        reject(err)
      })

      setTimeout(resolve, 3000)
    } else {
      console.log('Dev mode: expecting Nuxt dev server on port 3000')
      resolve()
    }
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    title: 'LiteMart POS',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  })

  const url = isProd ? `http://localhost:${PORT}` : 'http://localhost:3000'

  // 仅在开发环境下打开 DevTools
  if (!isProd) {
    mainWindow.webContents.openDevTools()
  }

  // 生产环境隐藏菜单栏
  if (isProd) {
    mainWindow.setMenu(null)
  }

  setTimeout(() => {
    mainWindow.loadURL(url).catch((err) => {
      console.error('Load failed, retrying...', err)
      setTimeout(() => mainWindow.loadURL(url), 2000)
    })
  }, 500)

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(async () => {
  try {
    await startNuxtServer()
    createWindow()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  } catch (err) {
    console.error('App start failed:', err)
    app.quit()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
  if (nuxtProcess) nuxtProcess.kill()
})
