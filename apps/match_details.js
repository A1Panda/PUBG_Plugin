import plugin from '../../../lib/plugins/plugin.js'
import config from '../config/config.js'
import { PubgApiService } from '../utils/pubg-api.js'
import { RenderService } from '../utils/render.js'
import { UserDataManager, extractParameter, formatDate, formatDuration, getGameMode, getMapName } from '../utils/common.js'
import { segment } from 'oicq'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * PUBG详细比赛数据功能模块
 */
export class MatchDetailsApp extends plugin {
  constructor() {
    super({
      name: 'PUBG-比赛详情',
      dsc: 'PUBG比赛详细数据查询',
      event: 'message',
      priority: 5000,
      rule: [
        {
          reg: `^${config.cmdPrefix}比赛详情.*$`,
          fnc: 'matchDetails'
        },
        {
          reg: `^${config.cmdPrefix}比赛回放.*$`,
          fnc: 'matchReplay'
        },
        {
          reg: `^${config.cmdPrefix}队伍数据.*$`,
          fnc: 'teamStats'
        }
      ]
    })

    this.apiService = new PubgApiService()
    this.userDataManager = new UserDataManager()
    this.renderService = new RenderService()
    this.cooldowns = new Map()
  }

  /**
   * 检查冷却时间
   */
  checkCooldown(userId) {
    const now = Date.now()
    const lastUse = this.cooldowns.get(userId) || 0
    
    if (now - lastUse < config.cooldown * 1000) {
      const remainingTime = Math.ceil((lastUse + config.cooldown * 1000 - now) / 1000)
      return remainingTime
    }
    
    this.cooldowns.set(userId, now)
    return 0
  }

  /**
   * 获取玩家信息和平台
   */
  async getPlayerInfo(e, param) {
    let playerName, platform
    
    if (!param) {
      const bindInfo = this.userDataManager.getUserBindInfo(e.user_id)
      if (!bindInfo) {
        return null
      }
      
      playerName = bindInfo.pubgId
      platform = bindInfo.platform
    } else {
      const parts = param.split(/\s+/)
      
      if (parts.length >= 2) {
        playerName = parts[0]
        platform = parts[1].toLowerCase()
        
        const validPlatforms = ['steam', 'kakao', 'psn', 'xbox', 'stadia']
        if (!validPlatforms.includes(platform)) {
          return null
        }
      } else {
        playerName = param
        const bindInfo = this.userDataManager.getUserBindInfo(e.user_id)
        platform = bindInfo ? bindInfo.platform : config.defaultPlatform
      }
    }
    
    return { playerName, platform }
  }

  /**
   * 比赛详情命令处理
   */
  async matchDetails(e) {
    const cooldownTime = this.checkCooldown(e.user_id)
    if (cooldownTime > 0) {
      await this.reply(`查询太频繁啦，请${cooldownTime}秒后再试`)
      return true
    }

    const content = e.msg.trim()
    const param = extractParameter(content, `${config.cmdPrefix}比赛详情`)
    
    const playerInfo = await this.getPlayerInfo(e, param)
    if (!playerInfo) {
      await this.reply(`请输入正确的格式：${config.cmdPrefix}比赛详情 <游戏ID> [平台] 或先绑定账号`)
      return true
    }

    const { playerName, platform } = playerInfo
    
    try {
      const player = await this.apiService.getPlayer(playerName, platform)
      if (!player) {
        await this.reply(`未找到玩家 ${playerName}`)
        return true
      }

      const matches = await this.apiService.getPlayerMatches(player.id, platform)
      if (!matches || matches.length === 0) {
        await this.reply(`玩家 ${playerName} 暂无比赛记录`)
        return true
      }

      // 获取最近一场比赛的详细数据
      const matchData = await this.apiService.getMatch(matches[0].id, platform)
      const telemetry = await this.apiService.fetchTelemetry(matchData.data.relationships.assets.data[0].id)

      // 处理遥测数据
      const detailedStats = this.processTelemetryData(telemetry, playerName)

      // 生成详细数据图片
      const imagePath = await this.generateDetailImage({
        matchInfo: matchData.data.attributes,
        playerStats: detailedStats,
        playerName: playerName,
        platform: platform.toUpperCase()
      })

      // 发送图片
      await this.sendImage(e, imagePath)

    } catch (error) {
      logger.error(`[PUBG-Plugin] 获取比赛详情失败: ${error.message}`)
      await this.reply(`查询失败: ${error.message}`)
    }

    return true
  }

  /**
   * 处理遥测数据
   */
  processTelemetryData(telemetry, playerName) {
    const stats = {
      damageDealt: 0,
      damageTaken: 0,
      headshotKills: 0,
      killStreaks: [],
      currentStreak: 0,
      weaponStats: {},
      movement: {
        total: 0,
        vehicle: 0,
        walking: 0
      },
      timeline: []
    }

    let currentPosition = null
    let lastKillTime = 0

    telemetry.forEach(event => {
      if (event.character && event.character.name === playerName) {
        // 处理伤害事件
        if (event._T === 'LogPlayerTakeDamage') {
          stats.damageTaken += event.damage
        }
        if (event._T === 'LogPlayerAttack') {
          stats.damageDealt += event.damage || 0
        }

        // 处理击杀事件
        if (event._T === 'LogPlayerKill') {
          stats.headshotKills += event.headShot ? 1 : 0
          
          const currentTime = new Date(event._D).getTime()
          if (currentTime - lastKillTime <= 10000) { // 10秒内的连杀
            stats.currentStreak++
          } else {
            if (stats.currentStreak > 0) {
              stats.killStreaks.push(stats.currentStreak)
            }
            stats.currentStreak = 1
          }
          lastKillTime = currentTime

          // 记录武器使用
          const weapon = event.damageCauserName
          stats.weaponStats[weapon] = (stats.weaponStats[weapon] || 0) + 1
        }

        // 处理位置和移动
        if (event._T === 'LogPlayerPosition') {
          if (currentPosition) {
            const distance = this.calculateDistance(currentPosition, event.position)
            stats.movement.total += distance
            if (event.vehicle) {
              stats.movement.vehicle += distance
            } else {
              stats.movement.walking += distance
            }
          }
          currentPosition = event.position
        }

        // 记录时间线事件
        if (['LogPlayerKill', 'LogPlayerTakeDamage', 'LogPlayerAttack'].includes(event._T)) {
          stats.timeline.push({
            time: event._D,
            type: event._T,
            details: event
          })
        }
      }
    })

    return stats
  }

  /**
   * 计算两点间距离
   */
  calculateDistance(pos1, pos2) {
    const dx = pos2.x - pos1.x
    const dy = pos2.y - pos1.y
    return Math.sqrt(dx * dx + dy * dy)
  }

  /**
   * 生成详细数据图片
   */
  async generateDetailImage(data) {
    try {
      const tempDir = path.join(__dirname, '../temp')
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true })
      }

      const imageBuffer = await this.renderService.renderImage('match_details', data)
      const imagePath = path.join(tempDir, `match_details_${Date.now()}.png`)
      await fs.promises.writeFile(imagePath, imageBuffer)
      
      return imagePath
    } catch (error) {
      logger.error(`[PUBG-Plugin] 生成图片失败: ${error.message}`)
      throw error
    }
  }

  /**
   * 发送图片消息
   */
  async sendImage(e, imagePath) {
    try {
      await e.reply(segment.image(imagePath))
      
      setTimeout(() => {
        try {
          fs.unlinkSync(imagePath)
        } catch (error) {
          logger.error(`[PUBG-Plugin] 删除临时图片失败: ${error.message}`)
        }
      }, 5000)
    } catch (error) {
      logger.error(`[PUBG-Plugin] 发送图片失败: ${error.message}`)
      await e.reply(`发送图片失败: ${error.message}`)
    }
  }

  /**
   * 比赛回放命令处理
   */
  async matchReplay(e) {
    // TODO: 实现比赛回放功能
    await this.reply('比赛回放功能正在开发中...')
    return true
  }

  /**
   * 队伍数据命令处理
   */
  async teamStats(e) {
    // TODO: 实现队伍数据统计功能
    await this.reply('队伍数据统计功能正在开发中...')
    return true
  }
} 