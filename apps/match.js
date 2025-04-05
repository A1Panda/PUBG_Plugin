import plugin from '../../../lib/plugins/plugin.js'
import config from '../config/config.js'
import { PubgApiService } from '../utils/pubg-api.js'
import { extractParameter, formatDate, formatDuration, getGameMode, getMapName } from '../utils/common.js'

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
          reg: `^${config.cmdPrefix}比赛.*$`,
          fnc: 'matchInfo'
        },
        {
          reg: `^${config.cmdPrefix}最近\\d*$`,
          fnc: 'recentMatches'
        }
      ]
    })

    this.apiService = new PubgApiService()
    
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
    const matchId = extractParameter(content, `${config.cmdPrefix}比赛`)
    
    if (!matchId) {
      await this.reply(`请输入正确的格式：${config.cmdPrefix}比赛 <比赛ID>`)
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
      
      // 解析比赛数据
      const formattedMatch = await this.formatMatchDetail(matchData)
      
      // 发送消息
      await this.reply(formattedMatch)
      
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
      
      // 构建回复消息
      let reply = `最近 ${matchesToShow.length} 场比赛:\n\n`
      
      for (let i = 0; i < matchesToShow.length; i++) {
        const match = matchesToShow[i]
        
        try {
          // 获取比赛详情
          const matchData = await this.apiService.getMatch(match.id, platform)
          const attrs = matchData.data.attributes
          
          // 计算真实玩家数量
          const participants = matchData.included.filter(item => item.type === 'participant')
          const playerCount = participants.length
          
          reply += `=== 比赛 ${i + 1} ===\n`
          reply += `ID: ${match.id}\n`
          reply += `时间: ${formatDate(new Date(attrs.createdAt))}\n`
          reply += `地图: ${getMapName(attrs.mapName)}\n`
          reply += `模式: ${getGameMode(attrs.gameMode)}\n`
          reply += `玩家数: ${playerCount}\n\n`
          
        } catch (error) {
          logger.error(`[PUBG-Plugin] 获取比赛 ${match.id} 详情失败: ${error.message}`)
          reply += `=== 比赛 ${i + 1} ===\n`
          reply += `ID: ${match.id}\n`
          reply += `无法获取详细信息\n\n`
        }
      }
      
      await this.reply(reply)
      
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
    const match = matchData.data
    const attrs = match.attributes
    
    // 提取队伍信息
    const teams = matchData.included.filter(item => item.type === 'roster')
    const participants = matchData.included.filter(item => item.type === 'participant')
    
    // 计算真实玩家数量
    const playerCount = participants.length
    
    let result = `===== 比赛信息 =====\n`
    result += `比赛ID: ${match.id}\n`
    result += `时间: ${formatDate(new Date(attrs.createdAt))}\n`
    result += `地图: ${getMapName(attrs.mapName)}\n`
    result += `模式: ${getGameMode(attrs.gameMode)}\n`
    result += `持续时间: ${formatDuration(attrs.duration)}\n`
    result += `玩家数: ${playerCount}\n`
    
    // 胜利队伍信息
    const winningTeam = teams.find(team => team.attributes.stats.rank === 1)
    
    if (winningTeam) {
      const teamMembers = winningTeam.relationships.participants.data.map(ref => {
        const player = participants.find(p => p.id === ref.id)
        return player ? player.attributes.stats.name : 'Unknown Player'
      })
      
      result += `\n===== 获胜队伍 =====\n`
      result += `队伍ID: ${winningTeam.id}\n`
      result += `队伍成员: ${teamMembers.join(', ')}\n`
      result += `击杀: ${winningTeam.attributes.stats.teamKills}\n`
    }
    
    // 添加击杀排行
    result += `\n===== 击杀排行 =====\n`
    
    // 按击杀数排序
    const sortedParticipants = [...participants].sort((a, b) => 
      (b.attributes.stats.kills || 0) - (a.attributes.stats.kills || 0)
    )
    
    // 显示前5名
    const topKillers = sortedParticipants.slice(0, 5)
    for (let i = 0; i < topKillers.length; i++) {
      const player = topKillers[i]
      const stats = player.attributes.stats
      
      result += `${i + 1}. ${stats.name}: ${stats.kills}杀 ${stats.assists}助攻 (排名:${stats.winPlace})\n`
    }
    
    return result
  }

  /**
   * 处理比赛数据
   * @param {Object} match 比赛数据
   * @returns {Object} 处理后的比赛信息
   */
  processMatchData(match) {
    const matchData = match.data
    const included = match.included || []
    
    // 获取比赛基本信息
    const matchInfo = {
      id: matchData.id,
      time: formatDate(new Date(matchData.attributes.createdAt)),
      map: getMapName(matchData.attributes.mapName),
      mode: getGameMode(matchData.attributes.gameMode),
      duration: formatDuration(matchData.attributes.duration),
      playerCount: matchData.attributes.playerCount || 0
    }
    
    // 处理参与者数据
    const participants = included.filter(item => item.type === 'participant')
    const rosters = included.filter(item => item.type === 'roster')
    
    // 创建玩家ID到数据的映射
    const playerStats = new Map()
    participants.forEach(participant => {
      playerStats.set(participant.attributes.stats.playerId, {
        name: participant.attributes.stats.name,
        kills: participant.attributes.stats.kills,
        assists: participant.attributes.stats.assists,
        rank: participant.attributes.stats.winPlace,
        teamId: participant.relationships.roster.data.id,
        damageDealt: Math.round(participant.attributes.stats.damageDealt),
        surviveTime: Math.round(participant.attributes.stats.timeSurvived / 60)
      })
    })
    
    // 获取获胜队伍信息
    const winningTeam = rosters.find(roster => roster.attributes.won === 'true' || roster.attributes.rank === 1)
    const winningTeamInfo = winningTeam ? {
      teamId: winningTeam.id,
      members: winningTeam.relationships.participants.data.map(p => {
        const player = playerStats.get(p.id)
        return player ? player.name : 'unknown'
      }),
      totalKills: winningTeam.relationships.participants.data.reduce((total, p) => {
        const player = playerStats.get(p.id)
        return total + (player ? player.kills : 0)
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