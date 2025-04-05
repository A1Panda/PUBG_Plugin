import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer'

/**
 * 基础图片生成器类
 * 提供通用的图片生成功能
 */
export class BaseGenerator {
  /**
   * 构造函数
   * @param {string} resourcesDir 资源目录
   * @param {string} tempDir 临时文件目录
   * @param {string} templatesDir 模板目录
   */
  constructor(resourcesDir, tempDir, templatesDir) {
    this.resourcesDir = resourcesDir
    this.tempDir = tempDir
    this.templatesDir = templatesDir
    
    // 确保目录存在
    this.ensureDirectoriesExist()
  }
  
  /**
   * 确保所需目录存在
   */
  ensureDirectoriesExist() {
    const dirs = [this.tempDir, this.templatesDir]
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
        logger.info(`[PUBG-Plugin] 创建目录: ${dir}`)
      }
    }
  }
  
  /**
   * 保存HTML内容到临时文件
   * @param {string} html HTML内容
   * @param {string} fileName 文件名（可选，默认生成时间戳文件名）
   * @returns {Promise<string>} 临时文件路径
   */
  async saveTempHtml(html, fileName = `temp_${Date.now()}.html`) {
    // 构建文件路径
    const filePath = path.join(this.tempDir, fileName)
    
    // 写入文件
    await fs.promises.writeFile(filePath, html, 'utf8')
    
    return filePath
  }
  
  /**
   * 使用Puppeteer从HTML文件生成截图
   * @param {string} htmlPath HTML文件路径
   * @param {object} options 截图选项
   * @param {number} options.width 视口宽度
   * @param {number} options.height 视口高度
   * @param {number} options.deviceScaleFactor 设备缩放因子
   * @param {string} options.selector 等待选择器
   * @param {string} options.outputPath 输出路径（可选）
   * @returns {Promise<string>} 图片路径
   */
  async captureScreenshot(htmlPath, options = {}) {
    const {
      width = 800,
      height = 600, 
      deviceScaleFactor = 1,
      selector = 'body',
      outputPath
    } = options
    
    // 如果未指定输出路径，则生成一个临时路径
    const imgPath = outputPath || path.join(this.tempDir, `screenshot_${Date.now()}.png`)
    
    // 启动浏览器
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
    
    try {
      const page = await browser.newPage()
      
      // 设置视口大小
      await page.setViewport({ 
        width, 
        height, 
        deviceScaleFactor 
      })
      
      // 打开HTML文件
      await page.goto(`file://${htmlPath}`, {
        waitUntil: 'networkidle0'
      })
      
      // 等待选择器出现
      if (selector) {
        await page.waitForSelector(selector)
      }
      
      // 截图
      await page.screenshot({
        path: imgPath,
        fullPage: true
      })
      
      return imgPath
    } catch (error) {
      logger.error(`[PUBG-Plugin] 截图失败: ${error.message}`)
      throw error
    } finally {
      // 确保浏览器关闭
      await browser.close()
      
      // 删除临时HTML文件（如果不是直接使用模板文件）
      try {
        if (htmlPath.includes(this.tempDir)) {
          fs.unlinkSync(htmlPath)
        }
      } catch (e) {
        logger.warn(`[PUBG-Plugin] 清理临时文件失败: ${e.message}`)
      }
    }
  }
  
  /**
   * 读取模板文件
   * @param {string} templateName 模板名称
   * @returns {Promise<string>} 模板内容
   */
  async readTemplate(templateName) {
    const templatePath = path.join(this.templatesDir, templateName)
    try {
      if (!fs.existsSync(templatePath)) {
        throw new Error(`模板文件不存在: ${templatePath}`)
      }
      const content = await fs.promises.readFile(templatePath, 'utf8')
      if (!content || content.length < 100) {
        throw new Error(`模板文件内容异常: ${templatePath}`)
      }
      return content
    } catch (error) {
      logger.error(`[PUBG-Plugin] 读取模板文件失败: ${error.message}`)
      throw error
    }
  }
  
  /**
   * 根据HTML内容生成图片
   * @param {string} html HTML内容
   * @param {object} options 选项
   * @returns {Promise<string>} 图片路径
   */
  async generateImage(html, options = {}) {
    const {
      width = 800,
      height = 600,
      deviceScaleFactor = 1.5,
      selector = '.container',
      fileName = `screenshot_${Date.now()}.png`
    } = options

    // 生成唯一的临时文件名
    const timestamp = Date.now()
    const tempHtmlFile = path.join(this.tempDir, `temp_${timestamp}.html`)
    const outputPath = path.join(this.tempDir, fileName)
    
    try {
      // 写入HTML到临时文件
      await fs.promises.writeFile(tempHtmlFile, html, 'utf8')
      logger.info(`[PUBG-Plugin] 已生成临时HTML文件: ${tempHtmlFile}`)
      
      // 启动浏览器
      logger.info('[PUBG-Plugin] 启动Puppeteer...')
      const browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security'
        ]
      })
      
      // 创建新页面
      const page = await browser.newPage()
      
      // 添加调试日志
      page.on('console', msg => {
        logger.debug(`[PUBG-Plugin][Page Console] ${msg.text()}`)
      })
      
      page.on('error', err => {
        logger.error(`[PUBG-Plugin][Page Error] ${err.toString()}`)
      })
      
      // 设置视口
      await page.setViewport({ 
        width, 
        height, 
        deviceScaleFactor
      })
      
      // 导航到文件
      const fileUrl = `file://${tempHtmlFile.replace(/\\/g, '/')}`
      logger.info(`[PUBG-Plugin] 加载文件: ${fileUrl}`)
      
      await page.goto(fileUrl, { 
        waitUntil: 'networkidle0',
        timeout: 30000
      })
      
      // 等待元素加载
      logger.info(`[PUBG-Plugin] 等待选择器: ${selector}`)
      
      try {
        await page.waitForSelector(selector, { timeout: 10000 })
      } catch (error) {
        logger.error(`[PUBG-Plugin] 等待选择器超时: ${error.message}`)
        // 尝试保存当前页面内容
        const debugContent = await page.content()
        const debugFile = path.join(this.tempDir, `debug_${timestamp}.html`)
        await fs.promises.writeFile(debugFile, debugContent, 'utf8')
        logger.info(`[PUBG-Plugin] 已保存页面内容到: ${debugFile}`)
        throw error
      }
      
      // 等待额外时间确保页面完全渲染
      await page.waitForTimeout(2000)
      
      // 检查页面是否有内容
      const bodyContent = await page.evaluate(() => document.body.innerHTML)
      if (!bodyContent || bodyContent.length < 100) {
        throw new Error('页面内容为空或异常')
      }
      
      // 截图
      logger.info('[PUBG-Plugin] 正在截图...')
      await page.screenshot({
        path: outputPath,
        fullPage: true,
        omitBackground: false
      })
      
      // 验证截图是否成功
      if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size < 1000) {
        throw new Error('截图生成失败或文件大小异常')
      }
      
      logger.info(`[PUBG-Plugin] 截图成功: ${outputPath}`)
      
      // 关闭浏览器
      await browser.close()
      
      return outputPath
    } catch (error) {
      logger.error(`[PUBG-Plugin] 图片生成失败: ${error.message}`)
      return null
    } finally {
      // 清理临时文件
      try {
        if (fs.existsSync(tempHtmlFile)) {
          fs.unlinkSync(tempHtmlFile)
        }
      } catch (e) {
        logger.warn(`[PUBG-Plugin] 清理临时文件失败: ${e.message}`)
      }
    }
  }
  
  /**
   * 清理临时文件
   * @param {number} maxAge 文件最大保留时间（毫秒）
   */
  cleanupTempFiles(maxAge = 24 * 60 * 60 * 1000) {
    try {
      const now = Date.now()
      const files = fs.readdirSync(this.tempDir)
      
      let deletedCount = 0
      for (const file of files) {
        if (file.endsWith('.png') || file.endsWith('.html')) {
          const filePath = path.join(this.tempDir, file)
          const stats = fs.statSync(filePath)
          
          if (now - stats.mtimeMs > maxAge) {
            fs.unlinkSync(filePath)
            deletedCount++
          }
        }
      }
      
      if (deletedCount > 0) {
        logger.info(`[PUBG-Plugin] 已清理 ${deletedCount} 个临时文件`)
      }
    } catch (error) {
      logger.error(`[PUBG-Plugin] 清理临时文件失败: ${error.message}`)
    }
  }
} 