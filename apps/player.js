import plugin from '../../../lib/plugins/plugin.js'
import config from '../config/config.js'
import { PubgApiService } from '../utils/pubg-api.js'
import { UserDataManager, extractParameter, formatDate, formatDuration, getGameMode, getMapName } from '../utils/common.js'
import { imageGenerator } from '../index.js'
import fetch from 'node-fetch'
import { segment } from 'oicq'

/**
 * 玩家查询功能模块
 */
export class PlayerApp extends plugin {
  constructor() {
    super({
      name: 'PUBG-玩家',
      dsc: 'PUBG玩家数据查询',
      event: 'message',
      priority: 5000,
      rule: [
        {
          reg: `^${config.cmdPrefix}查询.*$`,
          fnc: 'queryPlayer'
        },
        {
          reg: `^${config.cmdPrefix}最近比赛.*$`,
          fnc: 'recentMatches'
        },
        {
          reg: `^${config.cmdPrefix}绑定.*$`,
          fnc: 'bindAccount'
        },
        {
          reg: `^${config.cmdPrefix}解绑$`,
          fnc: 'unbindAccount'
        },
        {
          reg: `^${config.cmdPrefix}我的信息$`,
          fnc: 'myInfo'
        },
        {
          reg: `^${config.cmdPrefix}战绩图.*$`,
          fnc: 'statsImage'
        }
      ]
    })

    this.apiService = new PubgApiService()
    this.userDataManager = new UserDataManager()

    // 用户冷却时间映射
    this.cooldowns = new Map()
  }

  /**
   * 检查冷却时间
   * @param {string} userId 用户ID
   * @returns {boolean} 是否通过冷却检查
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
   * 查询玩家命令处理
   * @param {object} e 消息事件对象
   */
  async queryPlayer(e) {
    // 检查冷却时间
    const cooldownTime = this.checkCooldown(e.user_id)
    if (cooldownTime > 0) {
      await this.reply(`查询太频繁啦，请${cooldownTime}秒后再试`)
      return true
    }

    // 获取参数
    const content = e.msg.trim()
    const param = extractParameter(content, `${config.cmdPrefix}查询`)
    
    if (!param) {
      await this.reply(`请输入正确的格式：${config.cmdPrefix}查询 <游戏ID> [平台]`)
      return true
    }
    
    const parts = param.split(/\s+/)
    let playerName, platform
    
    if (parts.length >= 2) {
      // 有指定平台
      playerName = parts[0]
      platform = parts[1].toLowerCase()
      
      // 验证平台是否有效
      const validPlatforms = ['steam', 'kakao', 'psn', 'xbox', 'stadia']
      if (!validPlatforms.includes(platform)) {
        await this.reply(`无效的平台，有效值: steam, kakao, psn, xbox, stadia`)
        return true
      }
    } else {
      // 使用默认平台
      playerName = param
      
      // 检查是否已绑定账号
      const bindInfo = this.userDataManager.getUserBindInfo(e.user_id)
      platform = bindInfo ? bindInfo.platform : config.defaultPlatform
    }
    
    await this.reply(`正在查询玩家 ${playerName} 的信息，请稍候...`)
    
    try {
      // 查询玩家基本信息
      const player = await this.apiService.getPlayer(playerName, platform)
      
      if (!player) {
        await this.reply(`未找到玩家 ${playerName}，请检查ID和平台是否正确`)
        return true
      }
      
      // 获取当前赛季
      const currentSeason = await this.apiService.getCurrentSeason(platform)
      
      // 查询玩家赛季数据
      const seasonData = await this.apiService.getPlayerStats(player.id, currentSeason.id, platform)
      
      // 构建回复消息
      const reply = await this.formatPlayerInfo(player, seasonData, platform)
      
      // 发送消息
      await this.reply(reply)
      
    } catch (error) {
      logger.error(`[PUBG-Plugin] 查询玩家失败: ${error.message}`)
      await this.reply(`查询失败: ${error.message}`)
    }
    
    return true
  }

  /**
   * 格式化玩家信息
   * @param {object} player 玩家数据
   * @param {object} seasonData 赛季数据
   * @param {string} platform 平台
   * @returns {string} 格式化后的信息
   */
  async formatPlayerInfo(player, seasonData, platform) {
    const attributes = player.attributes
    const stats = seasonData.data.attributes.gameModeStats
    
    let result = `======= 玩家信息 =======\n`
    result += `玩家ID: ${attributes.name}\n`
    result += `平台: ${platform.toUpperCase()}\n`
    
    // 添加账号信息
    if (attributes.stats && attributes.stats.bestRank) {
      result += `历史最佳排名: ${attributes.stats.bestRank}\n`
    }
    
    // 添加当前赛季数据
    result += `\n===== 当前赛季数据 =====\n`
    
    // 添加单排数据
    const soloStats = stats.solo || {}
    const soloMatches = soloStats.roundsPlayed || 0
    const soloWins = soloStats.wins || 0
    const soloKills = soloStats.kills || 0
    // 自定义计算KD值：击杀数 / (总场次 - 胜利场次)，胜利的比赛不计入死亡
    const soloDeaths = soloMatches - soloWins
    const soloKD = soloDeaths > 0 ? (soloKills / soloDeaths).toFixed(2) : soloKills > 0 ? soloKills.toFixed(2) : '0.00'
    
    result += `单人模式:\n`
    result += `  比赛: ${soloMatches} | 胜利: ${soloWins}\n`
    result += `  击杀: ${soloKills} | 助攻: ${soloStats.assists || 0}\n`
    result += `  K/D: ${soloKD}\n`
    
    // 添加双排数据
    const duoStats = stats.duo || {}
    const duoMatches = duoStats.roundsPlayed || 0
    const duoWins = duoStats.wins || 0
    const duoKills = duoStats.kills || 0
    // 自定义计算KD值
    const duoDeaths = duoMatches - duoWins
    const duoKD = duoDeaths > 0 ? (duoKills / duoDeaths).toFixed(2) : duoKills > 0 ? duoKills.toFixed(2) : '0.00'
    
    result += `双人模式:\n`
    result += `  比赛: ${duoMatches} | 胜利: ${duoWins}\n`
    result += `  击杀: ${duoKills} | 助攻: ${duoStats.assists || 0}\n`
    result += `  K/D: ${duoKD}\n`
    
    // 添加四排数据
    const squadStats = stats.squad || {}
    const squadMatches = squadStats.roundsPlayed || 0
    const squadWins = squadStats.wins || 0
    const squadKills = squadStats.kills || 0
    // 自定义计算KD值
    const squadDeaths = squadMatches - squadWins
    const squadKD = squadDeaths > 0 ? (squadKills / squadDeaths).toFixed(2) : squadKills > 0 ? squadKills.toFixed(2) : '0.00'
    
    result += `四人模式:\n`
    result += `  比赛: ${squadMatches} | 胜利: ${squadWins}\n`
    result += `  击杀: ${squadKills} | 助攻: ${squadStats.assists || 0}\n`
    result += `  K/D: ${squadKD}\n`
    
    // 汇总数据
    const totalMatches = (soloMatches) + (duoMatches) + (squadMatches)
    const totalWins = (soloWins) + (duoWins) + (squadWins)
    const totalKills = (soloKills) + (duoKills) + (squadKills)
    const totalDeaths = totalMatches - totalWins
    const totalKD = totalDeaths > 0 ? (totalKills / totalDeaths).toFixed(2) : totalKills > 0 ? totalKills.toFixed(2) : '0.00'
    const winRate = totalMatches > 0 ? (totalWins / totalMatches * 100).toFixed(2) : '0.00'
    
    result += `\n===== 赛季汇总 =====\n`
    result += `总比赛: ${totalMatches} | 总胜利: ${totalWins}\n`
    result += `胜率: ${winRate}% | 总击杀: ${totalKills}\n`
    result += `总K/D: ${totalKD}\n`
    
    return result
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
    const param = extractParameter(content, `${config.cmdPrefix}最近比赛`)
    
    let playerName, platform
    
    if (!param) {
      // 检查是否已绑定账号
      const bindInfo = this.userDataManager.getUserBindInfo(e.user_id)
      if (!bindInfo) {
        await this.reply(`请输入正确的格式：${config.cmdPrefix}最近比赛 <游戏ID> 或先绑定账号`)
        return true
      }
      
      playerName = bindInfo.pubgId
      platform = bindInfo.platform
    } else {
      const parts = param.split(/\s+/)
      
      if (parts.length >= 2) {
        // 有指定平台
        playerName = parts[0]
        platform = parts[1]
      } else {
        // 使用默认平台
        playerName = param
        
        // 检查是否已绑定账号
        const bindInfo = this.userDataManager.getUserBindInfo(e.user_id)
        platform = bindInfo ? bindInfo.platform : config.defaultPlatform
      }
    }
    
    await this.reply(`正在查询玩家 ${playerName} 的最近比赛，请稍候...`)
    
    try {
      // 查询玩家信息
      const player = await this.apiService.getPlayer(playerName, platform)
      
      if (!player) {
        await this.reply(`未找到玩家 ${playerName}，请检查ID和平台是否正确`)
        return true
      }
      
      // 获取玩家的最近比赛
      const matches = await this.apiService.getPlayerMatches(player.id, platform)
      
      if (!matches || matches.length === 0) {
        await this.reply(`玩家 ${playerName} 暂无比赛记录`)
        return true
      }
      
      // 获取详细的比赛数据
      const matchDetails = []
      const limit = Math.min(matches.length, config.matchesPerPage)
      
      for (let i = 0; i < limit; i++) {
        const matchData = await this.apiService.getMatch(matches[i].id, platform)
        matchDetails.push(matchData)
      }
      
      // 构建回复消息
      const reply = await this.formatMatchesInfo(matchDetails, player.attributes.name, platform)
      
      // 发送消息
      await this.reply(reply)
      
    } catch (error) {
      logger.error(`[PUBG-Plugin] 查询最近比赛失败: ${error.message}`)
      await this.reply(`查询失败: ${error.message}`)
    }
    
    return true
  }

  /**
   * 格式化比赛信息
   * @param {Array} matches 比赛数据
   * @param {string} playerName 玩家名称
   * @param {string} platform 平台
   * @returns {string} 格式化后的信息
   */
  async formatMatchesInfo(matches, playerName, platform) {
    let result = `玩家 ${playerName} 的最近 ${matches.length} 场比赛:\n\n`
    
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i]
      const attrs = match.data.attributes
      const time = new Date(attrs.createdAt)
      const formattedTime = formatDate(time)
      
      // 查找玩家在该比赛中的表现
      const participant = this.findPlayerInMatch(match, playerName)
      
      // 计算真实玩家数量
      const participants = match.included.filter(item => item.type === 'participant')
      const playerCount = participants.length
      
      result += `=== 比赛 ${i + 1} ===\n`
      result += `ID: ${match.data.id}\n`
      result += `时间: ${formattedTime}\n`
      result += `地图: ${getMapName(attrs.mapName)}\n`
      result += `模式: ${getGameMode(attrs.gameMode)}\n`
      
      if (participant) {
        const stats = participant.attributes.stats
        result += `排名: ${stats.winPlace}/${playerCount}\n`
        result += `击杀: ${stats.kills} | 助攻: ${stats.assists}\n`
        result += `存活时间: ${formatDuration(stats.timeSurvived)}\n`
      } else {
        result += `未找到玩家数据\n`
      }
      
      result += '\n'
    }
    
    return result
  }

  /**
   * 在比赛中查找特定玩家
   * @param {object} match 比赛数据
   * @param {string} playerName 玩家名称
   * @returns {object|null} 玩家在比赛中的数据
   */
  findPlayerInMatch(match, playerName) {
    const participants = match.included.filter(item => item.type === 'participant')
    
    for (const participant of participants) {
      if (participant.attributes.stats.name === playerName) {
        return participant
      }
    }
    
    return null
  }

  /**
   * 绑定账号命令处理
   * @param {object} e 消息事件对象
   */
  async bindAccount(e) {
    // 获取参数
    const content = e.msg.trim()
    const param = extractParameter(content, `${config.cmdPrefix}绑定`)
    
    if (!param) {
      await this.reply(`请输入正确的格式：${config.cmdPrefix}绑定 <游戏ID> [平台]`)
      return true
    }
    
    const parts = param.split(/\s+/)
    let playerName, platform
    
    if (parts.length >= 2) {
      // 有指定平台
      playerName = parts[0]
      platform = parts[1]
    } else {
      // 使用默认平台
      playerName = param
      platform = config.defaultPlatform
    }
    
    try {
      // 验证玩家是否存在
      await this.apiService.getPlayer(playerName, platform)
      
      // 保存绑定信息
      this.userDataManager.bindUser(e.user_id, playerName, platform)
      
      await this.reply(`绑定成功！\n游戏ID: ${playerName}\n平台: ${platform.toUpperCase()}`)
      
    } catch (error) {
      logger.error(`[PUBG-Plugin] 绑定账号失败: ${error.message}`)
      await this.reply(`绑定失败: ${error.message}`)
    }
    
    return true
  }

  /**
   * 解绑账号命令处理
   * @param {object} e 消息事件对象
   */
  async unbindAccount(e) {
    // 检查是否已绑定账号
    const bindInfo = this.userDataManager.getUserBindInfo(e.user_id)
    
    if (!bindInfo) {
      await this.reply('您尚未绑定PUBG账号')
      return true
    }
    
    // 解绑账号
    const result = this.userDataManager.unbindUser(e.user_id)
    
    if (result) {
      await this.reply(`已成功解绑账号 ${bindInfo.pubgId}`)
    } else {
      await this.reply('解绑失败，请稍后再试')
    }
    
    return true
  }

  /**
   * 我的信息命令处理
   * @param {object} e 消息事件对象
   */
  async myInfo(e) {
    // 检查是否已绑定账号
    const bindInfo = this.userDataManager.getUserBindInfo(e.user_id)
    
    if (!bindInfo) {
      await this.reply(`您尚未绑定PUBG账号，请使用 ${config.cmdPrefix}绑定 <游戏ID> 进行绑定`)
      return true
    }
    
    const bindTime = formatDate(bindInfo.bindTime)
    
    await this.reply(`您的PUBG绑定信息：\n游戏ID: ${bindInfo.pubgId}\n平台: ${bindInfo.platform.toUpperCase()}\n绑定时间: ${bindTime}\n\n可使用 ${config.cmdPrefix}查询 直接查询您的游戏数据`)
    
    return true
  }

  /**
   * 战绩图命令处理
   * @param {object} e 消息事件对象
   */
  async statsImage(e) {
    // 检查冷却时间
    const cooldownTime = this.checkCooldown(e.user_id)
    if (cooldownTime > 0) {
      await this.reply(`查询太频繁啦，请${cooldownTime}秒后再试`)
      return true
    }

    // 获取参数
    const content = e.msg.trim()
    const param = extractParameter(content, `${config.cmdPrefix}战绩图`)
    
    let playerName, platform
    
    if (!param) {
      // 检查是否已绑定账号
      const bindInfo = this.userDataManager.getUserBindInfo(e.user_id)
      if (!bindInfo) {
        await this.reply(`请输入正确的格式：${config.cmdPrefix}战绩图 <游戏ID> 或先绑定账号`)
        return true
      }
      
      playerName = bindInfo.pubgId
      platform = bindInfo.platform
    } else {
      const parts = param.split(/\s+/)
      
      if (parts.length >= 2) {
        // 有指定平台
        playerName = parts[0]
        platform = parts[1].toLowerCase()
        
        // 验证平台是否有效
        const validPlatforms = ['steam', 'kakao', 'psn', 'xbox', 'stadia']
        if (!validPlatforms.includes(platform)) {
          await this.reply(`无效的平台，有效值: steam, kakao, psn, xbox, stadia`)
          return true
        }
      } else {
        // 使用默认平台
        playerName = param
        
        // 检查是否已绑定账号
        const bindInfo = this.userDataManager.getUserBindInfo(e.user_id)
        platform = bindInfo ? bindInfo.platform : config.defaultPlatform
      }
    }
    
    await this.reply(`正在查询玩家 ${playerName} 的战绩数据，请稍候...`)
    
    try {
      // 查询玩家基本信息
      const player = await this.apiService.getPlayer(playerName, platform)
      
      if (!player) {
        await this.reply(`未找到玩家 ${playerName}，请检查ID和平台是否正确`)
        return true
      }
      
      // 获取当前赛季
      const currentSeason = await this.apiService.getCurrentSeason(platform)
      
      // 查询玩家赛季数据
      const seasonData = await this.apiService.getPlayerStats(player.id, currentSeason.id, platform)
      
      // 生成战绩图片或文本
      const result = await imageGenerator.getFormattedStats(player, seasonData, platform)
      
      // 检查结果是图片路径还是文本
      if (result && result.endsWith('.png')) {
        // 发送图片消息
        await this.reply(segment.image(`file://${result}`))
      } else {
        // 发送文本消息
        await this.reply(result)
      }
      
    } catch (error) {
      logger.error(`[PUBG-Plugin] 生成战绩数据失败: ${error.message}`)
      await this.reply(`查询失败: ${error.message}`)
    }
    
    return true
  }
} 
