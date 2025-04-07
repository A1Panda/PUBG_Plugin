import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'
import handlebars from 'handlebars'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export class RenderService {
  constructor() {
    this.browser = null
    this.templateCache = new Map()
    
    // 注册Handlebars助手函数
    handlebars.registerHelper('add', function(value, addition) {
      return value + addition
    })
  }

  /**
   * 获取浏览器实例
   */
  async getBrowser() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      })
    }
    return this.browser
  }

  /**
   * 加载模板
   * @param {string} templateName 模板名称
   * @returns {Function} 编译后的模板函数
   */
  async loadTemplate(templateName) {
    if (this.templateCache.has(templateName)) {
      return this.templateCache.get(templateName)
    }

    const templatePath = path.join(__dirname, '../resources/html', `${templateName}.html`)
    const templateContent = await fs.promises.readFile(templatePath, 'utf8')
    const template = handlebars.compile(templateContent)
    
    this.templateCache.set(templateName, template)
    return template
  }

  /**
   * 渲染HTML
   * @param {string} templateName 模板名称
   * @param {object} data 渲染数据
   * @returns {string} 渲染后的HTML
   */
  async renderHtml(templateName, data) {
    const template = await this.loadTemplate(templateName)
    return template(data)
  }

  /**
   * 生成图片
   * @param {string} templateName 模板名称
   * @param {object} data 渲染数据
   * @param {object} options 图片选项
   * @returns {Buffer} 图片数据
   */
  async renderImage(templateName, data, options = {}) {
    const html = await this.renderHtml(templateName, data)
    const browser = await this.getBrowser()
    const page = await browser.newPage()

    try {
      console.log(`[PUBG-Plugin] 开始生成${templateName}图片...`)

      // 设置视口大小
      await page.setViewport({
        width: options.width || 800,
        height: options.height || 600,
        deviceScaleFactor: 2
      })

      // 加载HTML内容
      await page.setContent(html, {
        waitUntil: ['networkidle0', 'domcontentloaded']
      })

      // 等待内容渲染完成
      try {
        await page.waitForSelector('.container', { timeout: 5000 })
      } catch (error) {
        console.error(`[PUBG-Plugin] 等待选择器超时: ${error.message}`)
        throw new Error('页面渲染超时，请检查HTML模板')
      }

      // 等待一小段时间确保渲染完成
      await new Promise(resolve => setTimeout(resolve, 1000))

      // 获取内容实际高度
      const bodyHandle = await page.$('body')
      const { height } = await bodyHandle.boundingBox()
      await bodyHandle.dispose()

      // 调整视口高度
      await page.setViewport({
        width: options.width || 800,
        height: Math.ceil(height),
        deviceScaleFactor: 2
      })

      // 生成图片
      const imageBuffer = await page.screenshot({
        type: 'png',
        fullPage: true,
        omitBackground: true // 使用透明背景
      })

      console.log(`[PUBG-Plugin] ${templateName}图片生成成功`)
      return imageBuffer

    } catch (error) {
      console.error(`[PUBG-Plugin] 生成图片失败: ${error.message}`)
      throw error
    } finally {
      await page.close()
    }
  }

  /**
   * 关闭浏览器
   */
  async close() {
    if (this.browser) {
      await this.browser.close()
      this.browser = null
    }
  }
} 