import plugin from '../../../lib/plugins/plugin.js'
import config from '../config/config.js'
import { PubgApiService } from '../utils/pubg-api.js'
import { RenderService } from '../utils/render.js'
import { extractParameter, formatDate, formatDuration, getGameMode, getMapName } from '../utils/common.js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * 比赛查询功能模块
 */
export class MatchApp extends plugin {
  constructor() {
    super({
      name: 'PUBG-比赛',
      dsc: 'PUBG比赛数据查询',
      event: 'message',
      priority: 5000,
      rule: [
        {
          reg: `^${config.cmdPrefix}查询比赛.*$`,
          fnc: 'matchInfo'
        },
        {
          reg: `^${config.cmdPrefix}最近\\d*$`,
          fnc: 'recentMatches'
        }
      ]
    })

    this.apiService = new PubgApiService()
    this.renderService = new RenderService()
    
    // 用户冷却时间映射
    this.cooldowns = new Map()
  }

  /**
   * 检查冷却时间
   * @param {string} userId 用户ID
   * @returns {number} 剩余冷却时间（秒），0表示可以执行
   */
  checkCooldown(userId) {
    const now = Date.now()
    const lastUse = this.cooldowns.get(userId) || 0
    
    // 未冷却完成
    if (now - lastUse < config.cooldown * 1000) {
      const remainingTime = Math.ceil((lastUse + config.cooldown * 1000 - now) / 1000)
      return remainingTime
    }
    
    // 设置新的冷却时间
    this.cooldowns.set(userId, now)
    return 0
  }

  /**
   * 生成并保存图片
   * @param {object} data 渲染数据
   * @returns {string} 图片路径
   */
  async generateImage(data) {
    try {
      // 确保temp目录存在
      const tempDir = path.join(__dirname, '../temp')
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true })
      }

      // 生成图片
      const imageBuffer = await this.renderService.renderImage('match', data)
      
      // 保存图片
      const imagePath = path.join(tempDir, `match_${Date.now()}.png`)
      await fs.promises.writeFile(imagePath, imageBuffer)
      
      return imagePath
    } catch (error) {
      logger.error(`[PUBG-Plugin] 生成图片失败: ${error.message}`)
      throw error
    }
  }

  /**
   * 发送图片消息
   * @param {object} e 消息事件对象
   * @param {string} imagePath 图片路径
   */
  async sendImage(e, imagePath) {
    try {
      // 使用 segment.image 方法构建图片消息
      let msg = segment.image(imagePath)
      
      // 发送消息
      await e.reply(msg)
      
      // 延迟删除临时文件
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
   * 比赛信息命令处理
   * @param {object} e 消息事件对象
   */
  async matchInfo(e) {
    // 检查冷却时间
    const cooldownTime = this.checkCooldown(e.user_id)
    if (cooldownTime > 0) {
      await this.reply(`查询太频繁啦，请${cooldownTime}秒后再试`)
      return true
    }

    // 获取比赛ID参数
    const content = e.msg.trim()
    const matchId = extractParameter(content, `${config.cmdPrefix}查询比赛`)
    
    if (!matchId) {
      await this.reply(`请输入正确的格式：${config.cmdPrefix}查询比赛 <比赛ID>`)
      return true
    }
    
    await this.reply(`正在查询比赛 ${matchId} 的信息，请稍候...`)
    
    try {
      // 从比赛ID中识别平台
      let platform = config.defaultPlatform
      
      // 现在PUBG API不再需要平台前缀，直接使用默认平台
      if (matchId.includes('steam')) {
        platform = 'steam'
      } else if (matchId.includes('xbox')) {
        platform = 'xbox'
      } else if (matchId.includes('psn')) {
        platform = 'psn'
      } else if (matchId.includes('kakao')) {
        platform = 'kakao'
      } else if (matchId.includes('stadia')) {
        platform = 'stadia'
      }
      
      // 查询比赛信息
      const matchData = await this.apiService.getMatch(matchId, platform)
      
      if (!matchData) {
        await this.reply(`未找到比赛 ${matchId}，请检查ID是否正确`)
        return true
      }
      
      // 处理比赛数据
      const processedData = this.processMatchData(matchData)
      
      // 准备渲染数据
      const renderData = {
        matches: [{
          id: processedData.matchInfo.id,
          time: processedData.matchInfo.time,
          map: processedData.matchInfo.map,
          mode: processedData.matchInfo.mode,
          duration: processedData.matchInfo.duration,
          totalPlayers: processedData.matchInfo.playerCount,
          winningTeam: processedData.winningTeam,
          killRanking: processedData.killRanking
        }]
      }
      
      // 生成图片
      const imagePath = await this.generateImage(renderData)
      
      // 发送图片
      await this.sendImage(e, imagePath)
      
    } catch (error) {
      logger.error(`[PUBG-Plugin] 查询比赛失败: ${error.message}`)
      await this.reply(`查询失败: ${error.message}`)
    }
    
    return true
  }

  /**
   * 最近比赛命令处理
   * @param {object} e 消息事件对象
   */
  async recentMatches(e) {
    // 检查冷却时间
    const cooldownTime = this.checkCooldown(e.user_id)
    if (cooldownTime > 0) {
      await this.reply(`查询太频繁啦，请${cooldownTime}秒后再试`)
      return true
    }

    // 获取参数
    const content = e.msg.trim()
    const command = content.replace(/\s+.*$/, '')
    const countStr = command.replace(`${config.cmdPrefix}最近`, '')
    
    // 确定查询数量
    let count = parseInt(countStr) || 10
    count = Math.min(Math.max(count, 1), 50) // 限制在1-50之间
    
    // 尝试识别平台参数
    const param = content.replace(command, '').trim()
    let platform = config.defaultPlatform
    
    if (param) {
      platform = param
    }
    
    await this.reply(`正在获取最近 ${count} 场比赛信息，请稍候...`)
    
    try {
      // 获取比赛样本
      const samplesData = await this.apiService.getSamples(platform)
      
      if (!samplesData || !samplesData.data || !samplesData.data.relationships || !samplesData.data.relationships.matches) {
        await this.reply(`未找到最近比赛数据`)
        return true
      }
      
      const matches = samplesData.data.relationships.matches.data
      
      if (matches.length === 0) {
        await this.reply(`暂无比赛记录`)
        return true
      }
      
      // 获取指定数量的比赛
      const matchesToShow = matches.slice(0, count)
      const matchesData = []
      
      for (let i = 0; i < matchesToShow.length; i++) {
        const match = matchesToShow[i]
        
        try {
          // 获取比赛详情
          const matchData = await this.apiService.getMatch(match.id, platform)
          const attrs = matchData.data.attributes
          
          // 计算真实玩家数量
          const participants = matchData.included.filter(item => item.type === 'participant')
          const playerCount = participants.length
          
          // 查找玩家数据
          const playerData = participants.find(p => 
            p.attributes.stats.name && 
            p.attributes.stats.name.toLowerCase() === e.sender.card.toLowerCase()
          )
          
          const stats = playerData ? playerData.attributes.stats : null
          
          matchesData.push({
            id: match.id,
            time: formatDate(new Date(attrs.createdAt)),
            map: getMapName(attrs.mapName),
            mode: getGameMode(attrs.gameMode),
            duration: formatDuration(attrs.duration),
            totalPlayers: playerCount,
            rank: stats ? stats.winPlace : null,
            stats: stats ? {
              kills: stats.kills,
              assists: stats.assists
            } : null
          })
          
        } catch (error) {
          logger.error(`[PUBG-Plugin] 获取比赛 ${match.id} 详情失败: ${error.message}`)
          matchesData.push({
            id: match.id,
            time: '获取失败',
            map: '未知',
            mode: '未知',
            duration: '未知'
          })
        }
      }
      
      // 生成图片
      const imagePath = await this.generateImage({ matches: matchesData })
      
      // 发送图片
      await this.sendImage(e, imagePath)
      
    } catch (error) {
      logger.error(`[PUBG-Plugin] 获取最近比赛失败: ${error.message}`)
      await this.reply(`查询失败: ${error.message}`)
    }
    
    return true
  }

  /**
   * 格式化比赛详情
   * @param {object} matchData 比赛数据
   * @returns {string} 格式化后的比赛详情
   */
  async formatMatchDetail(matchData) {
    try {
      // 使用processMatchData处理数据
      const processedData = this.processMatchData(matchData)
      
      // 使用formatMatchInfo格式化输出
      return this.formatMatchInfo(processedData)
    } catch (error) {
      logger.error(`[PUBG-Plugin] 格式化比赛详情失败: ${error.message}`)
      return '格式化比赛详情失败，请稍后重试'
    }
  }

  /**
   * 处理比赛数据
   * @param {Object} match 比赛数据
   * @returns {Object} 处理后的比赛信息
   */
  processMatchData(match) {
    const matchData = match.data
    const included = match.included || []
    
    // 处理参与者数据
    const participants = included.filter(item => item.type === 'participant')
    const rosters = included.filter(item => item.type === 'roster')
    
    // 获取比赛基本信息
    const matchInfo = {
      id: matchData.id,
      time: formatDate(new Date(matchData.attributes.createdAt)),
      map: getMapName(matchData.attributes.mapName),
      mode: getGameMode(matchData.attributes.gameMode),
      duration: formatDuration(matchData.attributes.duration),
      playerCount: participants.length // 使用实际参与者数量
    }
    
    // 创建玩家ID到数据的映射
    const playerStats = new Map()
    participants.forEach(participant => {
      const stats = participant.attributes.stats
      const teamId = participant.relationships?.roster?.data?.id || 'unknown'
      
      playerStats.set(stats.playerId, {
        name: stats.name,
        kills: stats.kills || 0,
        assists: stats.assists || 0,
        rank: stats.winPlace,
        teamId: teamId,
        damageDealt: Math.round(stats.damageDealt || 0),
        surviveTime: Math.round((stats.timeSurvived || 0) / 60)
      })
    })
    
    // 获取获胜队伍信息
    const winningTeam = rosters.find(roster => roster.attributes.won === 'true' || roster.attributes.rank === 1)
    const winningTeamInfo = winningTeam ? {
      teamId: winningTeam.id,
      members: winningTeam.relationships.participants.data.map(p => {
        const participant = participants.find(part => part.id === p.id)
        return participant ? participant.attributes.stats.name : 'unknown'
      }),
      totalKills: winningTeam.relationships.participants.data.reduce((total, p) => {
        const participant = participants.find(part => part.id === p.id)
        return total + (participant ? participant.attributes.stats.kills || 0 : 0)
      }, 0)
    } : null
    
    // 获取击杀排行
    const killRanking = Array.from(playerStats.values())
      .sort((a, b) => {
        if (b.kills === a.kills) {
          return a.rank - b.rank // 如果击杀数相同，按排名排序
        }
        return b.kills - a.kills
      })
      .slice(0, 5)
      .map(player => ({
        name: player.name,
        kills: player.kills,
        assists: player.assists,
        rank: player.rank,
        damageDealt: player.damageDealt
      }))
    
    return {
      matchInfo,
      winningTeam: winningTeamInfo,
      killRanking
    }
  }

  /**
   * 格式化比赛信息
   * @param {Object} processedData 处理后的比赛数据
   * @returns {string} 格式化的文本
   */
  formatMatchInfo(processedData) {
    const { matchInfo, winningTeam, killRanking } = processedData
    
    let output = '===== 比赛信息 =====\n'
    output += `比赛ID: ${matchInfo.id}\n`
    output += `时间: ${matchInfo.time}\n`
    output += `地图: ${matchInfo.map}\n`
    output += `模式: ${matchInfo.mode}\n`
    output += `持续时间: ${matchInfo.duration}\n`
    output += `玩家数: ${matchInfo.playerCount}\n\n`
    
    if (winningTeam) {
      output += '===== 获胜队伍 =====\n'
      output += `队伍ID: ${winningTeam.teamId}\n`
      output += `队伍成员: ${winningTeam.members.join(', ')}\n`
      output += `总击杀: ${winningTeam.totalKills}杀\n\n`
    }
    
    output += '===== 击杀排行 =====\n'
    killRanking.forEach((player, index) => {
      output += `${index + 1}. ${player.name}: ${player.kills}杀 ${player.assists}助攻 (排名:${player.rank}, 伤害:${player.damageDealt})\n`
    })
    
    return output
  }
} 