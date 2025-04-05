import fetch from 'node-fetch'
import config from '../config/config.js'
import { CacheManager } from './common.js'

/**
 * PUBG API服务类
 */
export class PubgApiService {
  constructor() {
    this.apiKey = config.apiKey
    this.cacheManager = new CacheManager()
    this.baseUrl = 'https://api.pubg.com'
  }

  /**
   * 设置API密钥
   * @param {string} apiKey API密钥
   */
  setApiKey(apiKey) {
    this.apiKey = apiKey
  }

  /**
   * 执行API请求
   * @param {string} endpoint API端点
   * @param {string} platform 平台
   * @param {string} region 区域
   * @param {Object} options 请求选项
   * @returns {Promise<Object>} 响应数据
   */
  async fetchApi(endpoint, platform = config.defaultPlatform, region = config.defaultRegion, options = {}) {
    // 检查API密钥是否设置
    if (!this.apiKey || this.apiKey === 'your_pubg_api_key_here') {
      throw new Error('PUBG API密钥未设置，请在config/config.js中配置apiKey')
    }

    // 构建缓存键
    const cacheKey = `${endpoint}-${platform}-${region}-${JSON.stringify(options)}`
    
    // 检查缓存
    const cachedData = this.cacheManager.get(cacheKey)
    if (cachedData) {
      return cachedData
    }
    
    // 构建请求URL
    let url = `${this.baseUrl}`
    
    // 平台格式处理
    // PUBG API要求平台格式为以下几种：steam、psn、xbox、kakao、stadia
    // 不需要pc-前缀
    const shard = platform.replace('pc-', '')
    
    // 区域格式处理（仅在需要区域的接口中使用）
    const formattedRegion = region.replace('pc-', '')
    
    // 处理特殊的URL情况
    if (endpoint.startsWith('/shards')) {
      url += endpoint
    } else if (endpoint.includes('/matches/')) {
      // 比赛查询不需要区域
      url += `/shards/${shard}${endpoint}`
    } else {
      url += `/shards/${shard}`
      
      // 有些接口不需要区域
      if (!endpoint.includes('/players') && !endpoint.includes('/seasons') && !endpoint.includes('/samples')) {
        url += `/regions/${formattedRegion}`
      }
      
      url += endpoint
    }
    
    // 打印请求URL，用于调试
    logger.mark(`[PUBG-Plugin] 请求URL: ${url}`)
    
    // 设置请求头
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Accept': 'application/vnd.api+json'
    }
    
    try {
      // 发送请求
      const response = await fetch(url, {
        method: 'GET',
        headers,
        ...options
      })
      
      // 检查响应状态
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API请求失败 (${response.status}): ${errorText}`)
      }
      
      // 解析响应数据
      const data = await response.json()
      
      // 缓存数据
      this.cacheManager.set(cacheKey, data)
      
      return data
    } catch (error) {
      logger.error(`[PUBG-Plugin] API请求错误: ${error.message}`)
      throw error
    }
  }

  /**
   * 获取玩家信息
   * @param {string} playerName 玩家名称
   * @param {string} platform 平台
   * @returns {Promise<Object>} 玩家信息
   * @returns {Object} 返回数据结构
   * @returns {string} data.id - 玩家ID
   * @returns {Object} data.attributes - 玩家属性
   * @returns {string} data.attributes.name - 玩家名称
   * @returns {string} data.attributes.shardId - 平台ID
   * @returns {string} data.attributes.patchVersion - 游戏版本
   * @returns {string} data.attributes.titleId - 游戏标题ID
   * @returns {Object} data.relationships - 关联数据
   * @returns {Object} data.relationships.matches - 比赛数据
   * @returns {Object[]} data.relationships.matches.data - 比赛列表
   * @returns {string} data.relationships.matches.data.id - 比赛ID
   * @returns {string} data.relationships.matches.data.type - 数据类型
   */
  async getPlayer(playerName, platform = config.defaultPlatform) {
    try {
      const response = await this.fetchApi(`/players?filter[playerNames]=${encodeURIComponent(playerName)}`, platform)
      
      if (!response.data || response.data.length === 0) {
        throw new Error(`未找到玩家 ${playerName}`)
      }
      
      return response.data[0]
    } catch (error) {
      logger.error(`[PUBG-Plugin] 获取玩家信息失败: ${error.message}`)
      throw error
    }
  }

  /**
   * 获取玩家赛季数据
   * @param {string} accountId 账号ID
   * @param {string} seasonId 赛季ID
   * @param {string} platform 平台 
   * @returns {Promise<Object>} 赛季数据
   * @returns {Object} 返回数据结构
   * @returns {Object} data.attributes - 赛季属性
   * @returns {Object} data.attributes.gameModeStats - 游戏模式统计
   * @returns {Object} data.attributes.gameModeStats.solo - 单人模式统计
   * @returns {Object} data.attributes.gameModeStats.duo - 双人模式统计
   * @returns {Object} data.attributes.gameModeStats.squad - 四人模式统计
   * @returns {Object} data.attributes.gameModeStats.solo-fpp - 单人第一人称统计
   * @returns {Object} data.attributes.gameModeStats.duo-fpp - 双人第一人称统计
   * @returns {Object} data.attributes.gameModeStats.squad-fpp - 四人第一人称统计
   */
  async getPlayerStats(accountId, seasonId, platform = config.defaultPlatform) {
    try {
      return await this.fetchApi(`/players/${accountId}/seasons/${seasonId}`, platform)
    } catch (error) {
      logger.error(`[PUBG-Plugin] 获取玩家赛季数据失败: ${error.message}`)
      throw error
    }
  }

  /**
   * 获取当前赛季信息
   * @param {string} platform 平台
   * @returns {Promise<Object>} 赛季信息
   * @returns {Object} 返回数据结构
   * @returns {string} data.id - 赛季ID
   * @returns {Object} data.attributes - 赛季属性
   * @returns {boolean} data.attributes.isCurrentSeason - 是否为当前赛季
   * @returns {boolean} data.attributes.isOffseason - 是否为休赛期
   */
  async getCurrentSeason(platform = config.defaultPlatform) {
    try {
      const response = await this.fetchApi('/seasons', platform)
      
      if (!response.data || response.data.length === 0) {
        throw new Error('未找到赛季信息')
      }
      
      // 查找当前赛季
      const currentSeason = response.data.find(season => season.attributes.isCurrentSeason)
      
      if (!currentSeason) {
        throw new Error('未找到当前赛季')
      }
      
      return currentSeason
    } catch (error) {
      logger.error(`[PUBG-Plugin] 获取当前赛季失败: ${error.message}`)
      throw error
    }
  }

  /**
   * 获取玩家最近的比赛
   * @param {string} accountId 账号ID
   * @param {string} platform 平台
   * @returns {Promise<Array>} 比赛列表
   * @returns {Object[]} 返回数据结构
   * @returns {string} data[].id - 比赛ID
   * @returns {string} data[].type - 数据类型
   */
  async getPlayerMatches(accountId, platform = config.defaultPlatform) {
    try {
      const player = await this.fetchApi(`/players/${accountId}`, platform)
      
      if (!player.data || !player.data.relationships || !player.data.relationships.matches) {
        throw new Error(`未找到玩家 ${accountId} 的比赛`)
      }
      
      return player.data.relationships.matches.data
    } catch (error) {
      logger.error(`[PUBG-Plugin] 获取玩家比赛失败: ${error.message}`)
      throw error
    }
  }

  /**
   * 获取特定比赛信息
   * @param {string} matchId 比赛ID
   * @param {string} platform 平台
   * @returns {Promise<Object>} 比赛信息
   * @returns {Object} 返回数据结构
   * @returns {Object} data - 比赛数据
   * @returns {string} data.id - 比赛ID
   * @returns {Object} data.attributes - 比赛属性
   * @returns {string} data.attributes.createdAt - 创建时间
   * @returns {number} data.attributes.duration - 持续时间（秒）
   * @returns {string} data.attributes.gameMode - 游戏模式
   * @returns {string} data.attributes.mapName - 地图名称
   * @returns {number} data.attributes.playerCount - 玩家数量
   * @returns {Object[]} included - 包含的数据
   * @returns {Object} included[].type - 数据类型
   * @returns {Object} included[].attributes - 数据属性
   * @returns {Object} included[].relationships - 关联数据
   */
  async getMatch(matchId, platform = config.defaultPlatform) {
    try {
      return await this.fetchApi(`/matches/${matchId}`, platform)
    } catch (error) {
      logger.error(`[PUBG-Plugin] 获取比赛信息失败: ${error.message}`)
      throw error
    }
  }

  /**
   * 获取比赛数据样本
   * @param {string} platform 平台
   * @returns {Promise<Object>} 比赛样本数据
   * @returns {Object} 返回数据结构
   * @returns {Object} data - 样本数据
   * @returns {string} data.id - 样本ID
   * @returns {Object} data.attributes - 样本属性
   * @returns {string} data.attributes.createdAt - 创建时间
   * @returns {Object} data.relationships - 关联数据
   * @returns {Object} data.relationships.matches - 比赛数据
   * @returns {Object[]} data.relationships.matches.data - 比赛列表
   */
  async getSamples(platform = config.defaultPlatform) {
    try {
      return await this.fetchApi('/samples', platform)
    } catch (error) {
      logger.error(`[PUBG-Plugin] 获取比赛样本失败: ${error.message}`)
      throw error
    }
  }

  /**
   * 获取比赛遥测数据
   * @param {string} telemetryUrl 遥测URL
   * @returns {Promise<Object>} 遥测数据
   * @returns {Object[]} 返回数据结构
   * @returns {string} data[]._T - 事件类型
   * @returns {string} data[]._D - 事件时间
   * @returns {Object} data[].common - 通用数据
   * @returns {string} data[].common.mapName - 地图名称
   * @returns {string} data[].common.gameMode - 游戏模式
   * @returns {Object} data[].character - 角色数据
   * @returns {string} data[].character.name - 角色名称
   * @returns {string} data[].character.accountId - 账号ID
   * @returns {Object} data[].item - 物品数据
   * @returns {string} data[].item.itemId - 物品ID
   * @returns {string} data[].item.category - 物品类别
   * @returns {Object} data[].attack - 攻击数据
   * @returns {string} data[].attack.attacker - 攻击者ID
   * @returns {string} data[].attack.victim - 受害者ID
   * @returns {string} data[].attack.damageTypeCategory - 伤害类型
   * @returns {number} data[].attack.damage - 伤害值
   */
  async getTelemetry(telemetryUrl) {
    try {
      // 构建缓存键
      const cacheKey = `telemetry-${telemetryUrl}`
      
      // 检查缓存
      const cachedData = this.cacheManager.get(cacheKey)
      if (cachedData) {
        return cachedData
      }
      
      // 发送请求
      const response = await fetch(telemetryUrl)
      
      if (!response.ok) {
        throw new Error(`获取遥测数据失败: ${response.statusText}`)
      }
      
      const data = await response.json()
      
      // 缓存数据
      this.cacheManager.set(cacheKey, data)
      
      return data
    } catch (error) {
      logger.error(`[PUBG-Plugin] 获取遥测数据失败: ${error.message}`)
      throw error
    }
  }

  /**
   * 获取排行榜数据
   * @param {string} seasonId 赛季ID
   * @param {string} gameMode 游戏模式
   * @param {string} platform 平台
   * @returns {Promise<Object>} 排行榜数据
   * @returns {Object} 返回数据结构
   * @returns {Object[]} data - 排行榜数据
   * @returns {string} data[].id - 玩家ID
   * @returns {Object} data[].attributes - 玩家属性
   * @returns {string} data[].attributes.name - 玩家名称
   * @returns {number} data[].attributes.rank - 排名
   * @returns {number} data[].attributes.rating - 评分
   * @returns {number} data[].attributes.wins - 胜利次数
   * @returns {number} data[].attributes.kills - 击杀数
   */
  async getLeaderboard(seasonId, gameMode, platform = config.defaultPlatform) {
    try {
      return await this.fetchApi(`/leaderboards/${seasonId}/${gameMode}`, platform)
    } catch (error) {
      logger.error(`[PUBG-Plugin] 获取排行榜数据失败: ${error.message}`)
      throw error
    }
  }

  /**
   * 获取武器统计数据
   * @param {string} accountId 账号ID
   * @param {string} seasonId 赛季ID
   * @param {string} platform 平台
   * @returns {Promise<Object>} 武器统计数据
   * @returns {Object} 返回数据结构
   * @returns {Object} data.attributes - 武器统计属性
   * @returns {Object} data.attributes.weaponStats - 武器统计数据
   * @returns {Object} data.attributes.weaponStats.weaponId - 武器ID
   * @returns {number} data.attributes.weaponStats.kills - 击杀数
   * @returns {number} data.attributes.weaponStats.damageDealt - 造成伤害
   * @returns {number} data.attributes.weaponStats.headshotKills - 爆头击杀
   * @returns {number} data.attributes.weaponStats.longestKill - 最远击杀
   */
  async getWeaponStats(accountId, seasonId, platform = config.defaultPlatform) {
    try {
      return await this.fetchApi(`/players/${accountId}/seasons/${seasonId}/weapons`, platform)
    } catch (error) {
      logger.error(`[PUBG-Plugin] 获取武器统计数据失败: ${error.message}`)
      throw error
    }
  }

  /**
   * 获取生存统计数据
   * @param {string} accountId 账号ID
   * @param {string} seasonId 赛季ID
   * @param {string} platform 平台
   * @returns {Promise<Object>} 生存统计数据
   * @returns {Object} 返回数据结构
   * @returns {Object} data.attributes - 生存统计属性
   * @returns {number} data.attributes.timeSurvived - 生存时间
   * @returns {number} data.attributes.longestTimeSurvived - 最长生存时间
   * @returns {number} data.attributes.averageTimeSurvived - 平均生存时间
   * @returns {number} data.attributes.distanceTraveled - 移动距离
   * @returns {number} data.attributes.walkDistance - 步行距离
   * @returns {number} data.attributes.rideDistance - 载具距离
   */
  async getSurvivalStats(accountId, seasonId, platform = config.defaultPlatform) {
    try {
      return await this.fetchApi(`/players/${accountId}/seasons/${seasonId}/survival`, platform)
    } catch (error) {
      logger.error(`[PUBG-Plugin] 获取生存统计数据失败: ${error.message}`)
      throw error
    }
  }

  /**
   * 获取比赛事件数据
   * @param {string} matchId 比赛ID
   * @param {string} platform 平台
   * @returns {Promise<Object>} 比赛事件数据
   * @returns {Object} 返回数据结构
   * @returns {Object[]} data - 事件数据
   * @returns {string} data[].type - 事件类型
   * @returns {string} data[].id - 事件ID
   * @returns {Object} data[].attributes - 事件属性
   * @returns {string} data[].attributes.eventType - 事件类型
   * @returns {string} data[].attributes.timestamp - 时间戳
   * @returns {Object} data[].relationships - 关联数据
   */
  async getMatchEvents(matchId, platform = config.defaultPlatform) {
    try {
      return await this.fetchApi(`/matches/${matchId}/events`, platform)
    } catch (error) {
      logger.error(`[PUBG-Plugin] 获取比赛事件数据失败: ${error.message}`)
      throw error
    }
  }

  /**
   * 获取比赛参与者数据
   * @param {string} matchId 比赛ID
   * @param {string} platform 平台
   * @returns {Promise<Object>} 参与者数据
   * @returns {Object} 返回数据结构
   * @returns {Object[]} data - 参与者数据
   * @returns {string} data[].id - 参与者ID
   * @returns {Object} data[].attributes - 参与者属性
   * @returns {string} data[].attributes.name - 玩家名称
   * @returns {Object} data[].attributes.stats - 统计数据
   * @returns {number} data[].attributes.stats.kills - 击杀数
   * @returns {number} data[].attributes.stats.assists - 助攻数
   * @returns {number} data[].attributes.stats.damageDealt - 造成伤害
   * @returns {number} data[].attributes.stats.timeSurvived - 生存时间
   */
  async getMatchParticipants(matchId, platform = config.defaultPlatform) {
    try {
      return await this.fetchApi(`/matches/${matchId}/participants`, platform)
    } catch (error) {
      logger.error(`[PUBG-Plugin] 获取比赛参与者数据失败: ${error.message}`)
      throw error
    }
  }

  /**
   * 获取比赛队伍数据
   * @param {string} matchId 比赛ID
   * @param {string} platform 平台
   * @returns {Promise<Object>} 队伍数据
   * @returns {Object} 返回数据结构
   * @returns {Object[]} data - 队伍数据
   * @returns {string} data[].id - 队伍ID
   * @returns {Object} data[].attributes - 队伍属性
   * @returns {number} data[].attributes.rank - 排名
   * @returns {number} data[].attributes.teamKills - 队伍击杀
   * @returns {Object} data[].relationships - 关联数据
   * @returns {Object} data[].relationships.participants - 参与者数据
   */
  async getMatchRosters(matchId, platform = config.defaultPlatform) {
    try {
      return await this.fetchApi(`/matches/${matchId}/rosters`, platform)
    } catch (error) {
      logger.error(`[PUBG-Plugin] 获取比赛队伍数据失败: ${error.message}`)
      throw error
    }
  }
} 