import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ImageGenerator } from './utils/image-generator.js'

// 获取当前文件的目录
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 资源路径
const RESOURCES_DIR = path.join(__dirname, 'resources')
const TEMP_DIR = path.join(RESOURCES_DIR, 'temp')

// ASCII 艺术标题
const ASCII_LOGO = `
██████╗ ██╗   ██╗██████╗  ██████╗ 
██╔══██╗██║   ██║██╔══██╗██╔════╝ 
██████╔╝██║   ██║██████╔╝██║  ███╗
██╔═══╝ ██║   ██║██╔══██╗██║   ██║
██║     ╚██████╔╝██████╔╝╚██████╔╝
╚═╝      ╚═════╝ ╚═════╝  ╚═════╝ 
`

// 在控制台打印插件标题
logger.mark(logger.green(ASCII_LOGO))

// 记录开始时间
const startTime = process.hrtime()

// 插件信息
export const plugin = {
  name: 'PUBG-Plugin',
  dsc: '绝地求生游戏数据查询插件',
  event: 'message',
  priority: 5000,
  rule: []
}

// 获取 apps 目录下所有的 JS 文件
const appsDir = path.join(__dirname, 'apps')
const appFiles = fs.readdirSync(appsDir).filter(file => file.endsWith('.js'))

// 记录加载的插件
for (const file of appFiles) {
  const appName = path.basename(file, '.js')
  logger.mark(logger.green(`[PUBG-Plugin] 加载模块: ${appName}`))
}

// 初始化图像生成器
export const imageGenerator = new ImageGenerator()

// 设置定时清理临时文件
// 每12小时清理一次
const ONE_HOUR = 60 * 60 * 1000
const CLEANUP_INTERVAL = 12 * ONE_HOUR

/**
 * 清理临时文件
 * @returns {Promise<void>}
 */
async function cleanupTempFiles() {
  try {
    logger.mark(logger.green('[PUBG-Plugin] 开始清理临时文件...'))
    const deletedCount = await imageGenerator.cleanupTempFiles(0) // 立即清理所有临时文件
    logger.mark(logger.green(`[PUBG-Plugin] 临时文件清理完成，共清理 ${deletedCount} 个文件`))
  } catch (error) {
    logger.error(`[PUBG-Plugin] 清理临时文件失败: ${error.message}`)
  }
}

// 设置定时清理任务
setInterval(cleanupTempFiles, CLEANUP_INTERVAL)

// 确保目录结构存在
function ensureDirectories() {
  const dirs = [
    RESOURCES_DIR,
    TEMP_DIR,
    path.join(RESOURCES_DIR, 'templates'),
    path.join(RESOURCES_DIR, 'images')
  ]
  
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
      logger.mark(logger.green(`[PUBG-Plugin] 创建目录: ${dir}`))
    }
  }
}

// 显示启动信息
function showStartupInfo(loadTime) {
  logger.mark(logger.green('[PUBG-Plugin]------绝地求生数据查询------'))
  logger.mark(logger.green(`[PUBG-Plugin] 绝地求生数据查询插件载入成功~`))
  logger.mark(logger.green(`[PUBG-Plugin] 插件加载耗时: ${loadTime}ms`))
  logger.mark(logger.green(`[PUBG-Plugin] 已加载 ${appFiles.length} 个功能模块`))
  logger.mark(logger.green(`[PUBG-Plugin] 输入 #pubg帮助 查看功能说明`))
  logger.mark(logger.green('[PUBG-Plugin]-------------------------'))
}

// 初始化插件
async function initPlugin() {
  // 确保目录结构
  ensureDirectories()
  
  // 首次启动清理旧临时文件
  await cleanupTempFiles()
  
  // 计算并显示加载时间
  const endTime = process.hrtime(startTime)
  const loadTime = (endTime[0] * 1000 + endTime[1] / 1000000).toFixed(2)
  showStartupInfo(loadTime)
}

// 执行初始化
initPlugin().catch(error => {
  logger.error(`[PUBG-Plugin] 插件初始化失败: ${error.message}`)
})

// 导出所有功能模块
export * from './apps/player.js'
export * from './apps/match.js'
export * from './apps/bind.js'
export * from './apps/help.js'
