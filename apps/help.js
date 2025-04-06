import plugin from '../../../lib/plugins/plugin.js'
import config from '../config/config.js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PubgApiService } from '../utils/pubg-api.js'
import puppeteer from 'puppeteer'

// 获取当前文件的目录
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 关于信息
const ABOUT_CONTENT = `绝地求生数据查询插件 v1.0.0

本插件基于pubg.js开发，用于查询PUBG玩家数据和比赛信息
数据来源: PUBG官方API
开发者: A1_Panda
项目仓库: https://github.com/A1Panda/PUBG_Plugin

使用 ${config.cmdPrefix}帮助 查看详细命令`

/**
 * 帮助模块类
 */
export class HelpApp extends plugin {
  constructor() {
    super({
      name: 'PUBG-帮助',
      dsc: 'PUBG插件帮助和关于信息',
      event: 'message',
      priority: 5000,
      rule: [
        {
          reg: `^${config.cmdPrefix}帮助$`,
          fnc: 'help'
        },
        {
          reg: `^${config.cmdPrefix}关于$`,
          fnc: 'about'
        },
        {
          reg: `^${config.cmdPrefix}测试$`,
          fnc: 'testApi'
        }
      ]
    })
    
    this.apiService = new PubgApiService()
  }

  /**
   * 帮助命令处理
   * @param {object} e 消息事件对象
   */
  async help(e) {
    try {
      // 读取HTML模板
      const templatePath = path.join(__dirname, '../resources/html/help.html')
      let template = fs.readFileSync(templatePath, 'utf8')
      
      // 替换命令前缀
      template = template.replace(/{{cmdPrefix}}/g, config.cmdPrefix)
      
      // 使用puppeteer生成图片
      const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      })
      const page = await browser.newPage()
      await page.setViewport({ width: 800, height: 800 })
      await page.setContent(template)
      
      // 等待内容加载完成
      await page.waitForSelector('.container')
      
      // 获取实际内容高度
      const containerHeight = await page.evaluate(() => {
        const container = document.querySelector('.container')
        return container.getBoundingClientRect().height
      })
      
      // 调整视口高度
      await page.setViewport({ width: 800, height: Math.ceil(containerHeight) + 40 })
      
      // 确保临时目录存在
      const tempDir = path.join(process.cwd(), 'temp')
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir)
      }
      
      // 生成图片
      const imagePath = path.join(tempDir, `help_${Date.now()}.png`)
      await page.screenshot({
        path: imagePath,
        fullPage: true
      })
      
      await browser.close()
      
      // 发送图片
      await e.reply(segment.image(imagePath))
      
      // 延迟删除临时文件
      setTimeout(() => {
        try {
          fs.unlinkSync(imagePath)
        } catch (error) {
          logger.error(`[PUBG-Plugin] 删除临时图片失败: ${error.message}`)
        }
      }, 5000)
      
    } catch (error) {
      logger.error(`[PUBG-Plugin] 生成帮助图片失败: ${error.message}`)
      await e.reply(`生成帮助图片失败: ${error.message}`)
    }
    
    return true
  }

  /**
   * 关于命令处理
   * @param {object} e 消息事件对象
   */
  async about(e) {
    // 回复关于信息
    await this.reply(ABOUT_CONTENT)
    return true
  }

  /**
   * 测试API连接
   * @param {object} e 消息事件对象
   */
  async testApi(e) {
    await this.reply('正在测试PUBG API连接，请稍候...')
    
    try {
      // 检查API密钥
      if (!config.apiKey || config.apiKey === 'your_pubg_api_key_here') {
        await this.reply('❌ API密钥未设置！\n请在config/config.js中设置您的PUBG API密钥')
        return true
      }
      
      // 显示当前配置
      await this.reply(`当前配置：\n平台: ${config.defaultPlatform}\n区域: ${config.defaultRegion}`)
      
      // 测试获取最新赛季信息
      await this.reply('尝试获取最新赛季信息...')
      const season = await this.apiService.getCurrentSeason()
      
      if (season && season.id) {
        await this.reply(`✅ 赛季信息获取成功！\n当前赛季: ${season.id}`)
      } else {
        await this.reply('❌ 赛季信息获取失败！')
      }
      
      // 测试获取最近比赛样本
      await this.reply('尝试获取最近比赛样本...')
      const samples = await this.apiService.getSamples()
      
      if (samples && samples.data && samples.data.relationships && samples.data.relationships.matches) {
        const matchCount = samples.data.relationships.matches.data.length
        await this.reply(`✅ 比赛样本获取成功！\n共获取到 ${matchCount} 场比赛`)
        
        // 显示第一个比赛ID
        if (matchCount > 0) {
          const firstMatchId = samples.data.relationships.matches.data[0].id
          await this.reply(`第一个比赛ID: ${firstMatchId}`)
        }
      } else {
        await this.reply('❌ 比赛样本获取失败！')
      }
      
      await this.reply('API连接测试完成，一切正常！\n可以尝试使用其他命令了')
      
    } catch (error) {
      logger.error(`[PUBG-Plugin] API测试失败: ${error.message}`)
      await this.reply(`❌ API连接测试失败: ${error.message}\n请检查您的API密钥和网络连接`)
    }
    
    return true
  }
}