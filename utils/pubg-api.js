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
} 