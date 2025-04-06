import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import config from '../config/config.js'

// 获取当前文件的目录
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 用户绑定数据文件路径
const USER_BIND_FILE = path.join(__dirname, '../config/user_bind.json')

/**
 * 用户数据管理类
 */
export class UserDataManager {
  constructor() {
    this.userData = this.loadUserData()
  }

  /**
   * 加载用户绑定数据
   */
  loadUserData() {
    if (!fs.existsSync(USER_BIND_FILE)) {
      fs.writeFileSync(USER_BIND_FILE, JSON.stringify({}, null, 2))
      return {}
    }
    
    try {
      const data = fs.readFileSync(USER_BIND_FILE, 'utf8')
      return JSON.parse(data)
    } catch (error) {
      logger.error(`[PUBG-Plugin] 加载用户数据失败: ${error.message}`)
      return {}
    }
  }

  /**
   * 保存用户绑定数据
   */
  saveUserData() {
    try {
      fs.writeFileSync(USER_BIND_FILE, JSON.stringify(this.userData, null, 2))
      return true
    } catch (error) {
      logger.error(`[PUBG-Plugin] 保存用户数据失败: ${error.message}`)
      return false
    }
  }

  /**
   * 绑定用户
   * @param {string} userId QQ用户ID
   * @param {string} pubgId PUBG ID
   * @param {string} platform 平台
   * @returns {boolean} 是否成功
   */
  bindUser(userId, pubgId, platform = config.defaultPlatform) {
    this.userData[userId] = {
      pubgId,
      platform,
      bindTime: Date.now()
    }
    return this.saveUserData()
  }

  /**
   * 解绑用户
   * @param {string} userId QQ用户ID
   * @returns {boolean} 是否成功
   */
  unbindUser(userId) {
    if (this.userData[userId]) {
      delete this.userData[userId]
      return this.saveUserData()
    }
    return false
  }

  /**
   * 获取用户绑定信息
   * @param {string} userId QQ用户ID
   * @returns {object|null} 绑定信息
   */
  getUserBindInfo(userId) {
    return this.userData[userId] || null
  }
}

/**
 * 简单的内存缓存管理
 */
export class CacheManager {
  constructor() {
    this.cache = new Map()
    this.expiryTime = config.cacheExpiry * 60 * 1000 // 转换为毫秒
  }

  /**
   * 设置缓存
   * @param {string} key 缓存键
   * @param {any} value 缓存值
   */
  set(key, value) {
    if (!config.enableCache) return
    
    this.cache.set(key, {
      value,
      timestamp: Date.now()
    })
  }

  /**
   * 获取缓存
   * @param {string} key 缓存键
   * @returns {any|null} 缓存值，如果已过期则返回null
   */
  get(key) {
    if (!config.enableCache) return null
    
    const data = this.cache.get(key)
    if (!data) return null

    // 检查缓存是否过期
    if (Date.now() - data.timestamp > this.expiryTime) {
      this.cache.delete(key)
      return null
    }

    return data.value
  }

  /**
   * 清除所有缓存
   */
  clear() {
    this.cache.clear()
  }
}

/**
 * 获取地图名称
 * @param {string} mapId 地图ID
 * @returns {string} 地图中文名称
 */
export function getMapName(mapId) {
  const mapNames = {
    'Desert_Main': '米拉玛',
    'DihorOtok_Main': '维寒迪',
    'Erangel_Main': '艾伦格',
    'Baltic_Main': '艾伦格',
    'Range_Main': '训练场',
    'Savage_Main': '萨诺',
    'Summerland_Main': '凯拉丁',
    'Tiger_Main': '泰戈',
    'Chimera_Main': '海文',
    'Kiki_Main': '德卡',
    'Neon_Main': '霓虹城',
    'Tutorial_Main': '教程'
  }
  
  const result = mapNames[mapId] || mapId
  return result
}

/**
 * 获取游戏模式
 * @param {string} modeId 模式ID
 * @returns {string} 模式中文名称
 */
export function getGameMode(modeId) {
  const gameModes = {
    'solo': '单人',
    'solo-fpp': '第一人称单人',
    'duo': '双人组队',
    'duo-fpp': '第一人称双人组队',
    'squad': '四人组队',
    'squad-fpp': '第一人称四人组队',
    'normal-squad': '四人组队',
    'normal-squad-fpp': '第一人称四人组队'
  }
  return gameModes[modeId] || modeId
}

/**
 * 格式化日期时间
 * @param {Date} date 日期对象
 * @returns {string} 格式化后的日期时间字符串
 */
export function formatDate(date) {
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
}

/**
 * 格式化持续时间
 * @param {number} duration 持续时间（秒）
 * @returns {string} 格式化后的时间字符串
 */
export function formatDuration(duration) {
  const minutes = Math.floor(duration / 60)
  const seconds = duration % 60
  return `${minutes}分${seconds}秒`
}

/**
 * 从消息中提取参数
 * @param {string} content 消息内容
 * @param {string} command 命令前缀
 * @returns {string} 提取的参数
 */
export function extractParameter(content, command) {
  return content.replace(command, '').trim()
} 