import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer'
import { BaseGenerator } from './base-generator.js'
import Handlebars from 'handlebars'

/**
 * 战绩图片生成器类
 * 继承自BaseGenerator
 */
export class StatsGenerator extends BaseGenerator {
  constructor(resourcesDir, tempDir, templatesDir) {
    super(resourcesDir, tempDir, templatesDir)
  }

  /**
   * 生成玩家战绩文本
   * @param {object} playerData 玩家数据
   * @param {object} seasonData 赛季数据
   * @param {string} platform 平台
   * @returns {string} 格式化的战绩文本
   */
  async generatePlayerStats(playerData, seasonData, platform) {
    try {
      // 提取需要的数据
      const playerName = playerData.attributes.name
      const stats = seasonData.data.attributes.gameModeStats
      
      // 分析数据
      const soloStats = stats.solo || {}
      const duoStats = stats.duo || {}
      const squadStats = stats.squad || {}
      
      // 计算KD值
      const soloMatches = soloStats.roundsPlayed || 0
      const soloWins = soloStats.wins || 0
      const soloKills = soloStats.kills || 0
      const soloDeaths = soloMatches - soloWins
      const soloKD = soloDeaths > 0 ? (soloKills / soloDeaths).toFixed(2) : soloKills > 0 ? soloKills.toFixed(2) : '0.00'
      
      const duoMatches = duoStats.roundsPlayed || 0
      const duoWins = duoStats.wins || 0
      const duoKills = duoStats.kills || 0
      const duoDeaths = duoMatches - duoWins
      const duoKD = duoDeaths > 0 ? (duoKills / duoDeaths).toFixed(2) : duoKills > 0 ? duoKills.toFixed(2) : '0.00'
      
      const squadMatches = squadStats.roundsPlayed || 0
      const squadWins = squadStats.wins || 0
      const squadKills = squadStats.kills || 0
      const squadDeaths = squadMatches - squadWins
      const squadKD = squadDeaths > 0 ? (squadKills / squadDeaths).toFixed(2) : squadKills > 0 ? squadKills.toFixed(2) : '0.00'
      
      // 汇总数据
      const totalMatches = soloMatches + duoMatches + squadMatches
      const totalWins = soloWins + duoWins + squadWins
      const totalKills = soloKills + duoKills + squadKills
      const winRate = totalMatches > 0 ? (totalWins / totalMatches * 100).toFixed(2) : '0.00'
      const totalDeaths = totalMatches - totalWins
      const totalKD = totalDeaths > 0 ? (totalKills / totalDeaths).toFixed(2) : totalKills > 0 ? totalKills.toFixed(2) : '0.00'
      
      // 生成格式化文本
      let result = this.generateHeader(playerName, platform)
      
      // 添加总览数据
      result += this.generateOverview(totalMatches, totalWins, totalKills, winRate, totalKD)
      
      // 添加各模式数据
      result += this.generateModeStats('单人模式', soloMatches, soloWins, soloKills, soloStats.assists || 0, soloKD)
      result += this.generateModeStats('双人模式', duoMatches, duoWins, duoKills, duoStats.assists || 0, duoKD)
      result += this.generateModeStats('四人模式', squadMatches, squadWins, squadKills, squadStats.assists || 0, squadKD)
      
      // 添加时间戳
      result += `\n\n更新时间: ${new Date().toLocaleString()}`
      
      return result
    } catch (error) {
      logger.error(`[PUBG-Plugin] 生成战绩数据失败: ${error.message}`)
      throw error
    }
  }
  
  /**
   * 生成标题
   * @param {string} playerName 玩家名称
   * @param {string} platform 平台
   * @returns {string} 标题文本
   */
  generateHeader(playerName, platform) {
    return `======= ${playerName} 的 PUBG 战绩 =======\n平台: ${platform.toUpperCase()}\n\n`
  }
  
  /**
   * 生成总览数据
   * @param {number} matches 总场次
   * @param {number} wins 总胜场
   * @param {number} kills 总击杀
   * @param {string} winRate 胜率
   * @param {string} kd KD值
   * @returns {string} 总览数据文本
   */
  generateOverview(matches, wins, kills, winRate, kd) {
    return `===== 总览数据 =====\n` +
           `总场次: ${matches} | 总胜场: ${wins}\n` +
           `总击杀: ${kills} | 胜率: ${winRate}%\n` +
           `总K/D: ${kd}\n\n`
  }
  
  /**
   * 生成游戏模式数据
   * @param {string} title 模式名称
   * @param {number} matches 比赛场次
   * @param {number} wins 胜利场次
   * @param {number} kills 击杀数
   * @param {number} assists 助攻数
   * @param {string} kd KD值
   * @returns {string} 模式数据文本
   */
  generateModeStats(title, matches, wins, kills, assists, kd) {
    // 计算胜率
    const winRate = matches > 0 ? ((wins / matches) * 100).toFixed(2) : '0.00'
    
    return `===== ${title} =====\n` +
           `场次: ${matches} | 胜场: ${wins} | 胜率: ${winRate}%\n` +
           `击杀: ${kills} | 助攻: ${assists} | K/D: ${kd}\n\n`
  }

  /**
   * 使用Puppeteer生成战绩图片
   * @param {string} playerName 玩家名称
   * @param {object} stats 战绩数据
   * @param {string} platform 平台
   * @returns {Promise<string>} 图片路径
   */
  async generateStatsImage(playerName, stats, platform) {
    try {
      logger.info('[PUBG-Plugin] 开始生成战绩统计图片')
      
      // 确保stats对象存在
      if (!stats) {
        logger.error('[PUBG-Plugin] 无效的战绩数据')
        return null
      }
      
      // 检查是否能读取stats中的数据
      logger.debug(`[PUBG-Plugin] 战绩数据结构: ${JSON.stringify(Object.keys(stats))}`)
      
      // 计算数据 - 单人数据
      const soloStats = stats.solo || {}
      const soloMatches = soloStats.roundsPlayed || 0
      const soloWins = soloStats.wins || 0
      const soloKills = soloStats.kills || 0
      const soloAssists = soloStats.assists || 0
      const soloDeaths = soloMatches - soloWins
      const soloKD = soloDeaths > 0 ? (soloKills / soloDeaths).toFixed(2) : soloKills > 0 ? soloKills.toFixed(2) : '0.00'
      const soloWinRate = soloMatches > 0 ? ((soloWins / soloMatches) * 100).toFixed(2) : '0.00'
      
      // 双人数据
      const duoStats = stats.duo || {}
      const duoMatches = duoStats.roundsPlayed || 0
      const duoWins = duoStats.wins || 0
      const duoKills = duoStats.kills || 0
      const duoAssists = duoStats.assists || 0
      const duoDeaths = duoMatches - duoWins
      const duoKD = duoDeaths > 0 ? (duoKills / duoDeaths).toFixed(2) : duoKills > 0 ? duoKills.toFixed(2) : '0.00'
      const duoWinRate = duoMatches > 0 ? ((duoWins / duoMatches) * 100).toFixed(2) : '0.00'
      
      // 四人数据
      const squadStats = stats.squad || {}
      const squadMatches = squadStats.roundsPlayed || 0
      const squadWins = squadStats.wins || 0
      const squadKills = squadStats.kills || 0
      const squadAssists = squadStats.assists || 0
      const squadDeaths = squadMatches - squadWins
      const squadKD = squadDeaths > 0 ? (squadKills / squadDeaths).toFixed(2) : squadKills > 0 ? squadKills.toFixed(2) : '0.00'
      const squadWinRate = squadMatches > 0 ? ((squadWins / squadMatches) * 100).toFixed(2) : '0.00'
      
      // 总数据
      const totalMatches = soloMatches + duoMatches + squadMatches
      const totalWins = soloWins + duoWins + squadWins
      const totalKills = soloKills + duoKills + squadKills
      const winRate = totalMatches > 0 ? (totalWins / totalMatches * 100).toFixed(2) : '0.00'
      const totalDeaths = totalMatches - totalWins
      const totalKD = totalDeaths > 0 ? (totalKills / totalDeaths).toFixed(2) : totalKills > 0 ? totalKills.toFixed(2) : '0.00'
      
      // 计算场均击杀
      const avgKills = totalMatches > 0 ? (totalKills / totalMatches).toFixed(2) : '0.00'
      
      // 读取HTML模板
      try {
        logger.debug('[PUBG-Plugin] 开始读取战绩模板')
        const template = await this.readTemplate('stats-template.html')
        logger.debug(`[PUBG-Plugin] 成功读取战绩模板，长度: ${template.length}字节`)
        
        // 编译模板
        const compiledTemplate = Handlebars.compile(template)
        
        // 准备模板数据
        const templateData = {
          playerName: playerName || '未知玩家',
          platform: (platform || 'unknown').toUpperCase(),
          totalMatches,
          totalWins,
          totalKills,
          winRate,
          totalKD,
          avgKills,
          soloMatches,
          soloWins,
          soloWinRate,
          soloKills,
          soloAssists,
          soloKD,
          duoMatches,
          duoWins,
          duoWinRate,
          duoKills,
          duoAssists,
          duoKD,
          squadMatches,
          squadWins,
          squadWinRate,
          squadKills,
          squadAssists,
          squadKD,
          updateTime: new Date().toLocaleString()
        }
        
        // 将数据写入日志以便调试
        logger.debug(`[PUBG-Plugin] 战绩统计模板数据: ${JSON.stringify(templateData)}`)
        
        // 生成HTML
        const html = compiledTemplate(templateData)
        
        // 使用基类的方法生成图片
        return await this.generateImage(html, {
          width: 700,
          height: 800,
          deviceScaleFactor: 1.5,
          fileName: `pubg_stats_${Date.now()}.png`
        })
      } catch (error) {
        logger.error(`[PUBG-Plugin] 读取或编译模板失败: ${error.message}`)
        return null
      }
    } catch (error) {
      logger.error(`[PUBG-Plugin] 生成战绩图片失败: ${error.message}`)
      return null
    }
  }
} 