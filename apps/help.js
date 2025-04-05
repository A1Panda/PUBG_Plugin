import plugin from '../../../lib/plugins/plugin.js'
import config from '../config/config.js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PubgApiService } from '../utils/pubg-api.js'

// 获取当前文件的目录
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 帮助内容
const HELP_CONTENT = `绝地求生数据查询插件

基础命令:
${config.cmdPrefix}帮助 - 显示此帮助信息
${config.cmdPrefix}关于 - 显示插件信息

玩家相关:
${config.cmdPrefix}查询 <游戏ID> - 查询玩家基本信息
${config.cmdPrefix}查询 <游戏ID> <平台> - 查询指定平台玩家信息
${config.cmdPrefix}最近比赛 <游戏ID> - 查询玩家最近比赛
${config.cmdPrefix}战绩图 <游戏ID> - 生成格式化战绩数据

比赛相关:
${config.cmdPrefix}比赛 <比赛ID> - 查询特定比赛信息
${config.cmdPrefix}最近50 - 查看最近50场比赛
${config.cmdPrefix}最近10 - 查看最近10场比赛

账号绑定:
${config.cmdPrefix}绑定 <游戏ID> - 绑定PUBG账号
${config.cmdPrefix}解绑 - 解绑PUBG账号
${config.cmdPrefix}我的信息 - 查看绑定账号信息

高级功能:
${config.cmdPrefix}设置区域 <区域> - 设置默认区域
${config.cmdPrefix}设置平台 <平台> - 设置默认平台

*注: 平台可选值: steam, kakao, psn, xbox, stadia
区域可选值: as(亚洲), eu(欧洲), jp(日本), kakao(韩国), krjp(韩国/日本), na(北美), oc(大洋洲), ru(俄罗斯), sa(南美), sea(东南亚), tournament(比赛)`

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
    // 回复帮助信息
    await this.reply(HELP_CONTENT)
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