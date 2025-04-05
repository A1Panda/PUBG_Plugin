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
 * 提取命令中的参数
 * @param {string} message 消息内容
 * @param {string} command 命令前缀
 * @returns {string} 参数
 */
export function extractParameter(message, command) {
  if (!message.startsWith(command)) return ''
  return message.substring(command.length).trim()
}

/**
 * 格式化时间戳
 * @param {number} timestamp 时间戳
 * @returns {string} 格式化后的时间
 */
export function formatDate(timestamp) {
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${padZero(date.getMonth() + 1)}-${padZero(date.getDate())} ${padZero(date.getHours())}:${padZero(date.getMinutes())}:${padZero(date.getSeconds())}`
}

/**
 * 数字补零
 * @param {number} num 数字
 * @returns {string} 补零后的字符串
 */
function padZero(num) {
  return num < 10 ? `0${num}` : `${num}`
}

/**
 * 格式化游戏时长
 * @param {number} seconds 秒数
 * @returns {string} 格式化后的时长
 */
export function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  return `${minutes}分${remainingSeconds}秒`
}

/**
 * 获取地图名称中文翻译
 * @param {string} mapId 地图ID
 * @returns {string} 地图中文名
 */
export function getMapName(mapId) {
  const mapNames = {
    'Desert_Main': '米拉玛',
    'Erangel_Main': '艾伦格',
    'Savage_Main': '萨诺',
    'DihorOtok_Main': '维肯迪',
    'Range_Main': '训练场',
    'Kiki_Main': '帕拉莫',
    'Summerland_Main': '凯拉丁',
    'Tiger_Main': '特罗戈',
    'Baltic_Main': '塔格',
    'Chimera_Main': '黑文',
    'Heaven_Main': '天选之地'
  }
  
  return mapNames[mapId] || mapId
}

/**
 * 获取游戏模式中文翻译
 * @param {string} gameMode 游戏模式
 * @returns {string} 游戏模式中文名
 */
export function getGameMode(gameMode) {
  const gameModes = {
    'duo': '双人组队',
    'duo-fpp': '第一人称双人组队',
    'solo': '单人',
    'solo-fpp': '第一人称单人',
    'squad': '四人组队',
    'squad-fpp': '第一人称四人组队',
    'normal-duo': '普通双人组队',
    'normal-duo-fpp': '普通第一人称双人组队',
    'normal-solo': '普通单人',
    'normal-solo-fpp': '普通第一人称单人',
    'normal-squad': '普通四人组队',
    'normal-squad-fpp': '普通第一人称四人组队',
    'conquest-duo': '征服双人组队',
    'conquest-duo-fpp': '征服第一人称双人组队',
    'conquest-solo': '征服单人',
    'conquest-solo-fpp': '征服第一人称单人',
    'conquest-squad': '征服四人组队',
    'conquest-squad-fpp': '征服第一人称四人组队',
    'esports-duo': '电竞双人组队',
    'esports-duo-fpp': '电竞第一人称双人组队',
    'esports-solo': '电竞单人',
    'esports-solo-fpp': '电竞第一人称单人',
    'esports-squad': '电竞四人组队',
    'esports-squad-fpp': '电竞第一人称四人组队',
    'war': '战争模式',
    'zombie': '僵尸模式',
    'lab': '实验室',
    'tdm': '团队死斗'
  }
  
  return gameModes[gameMode] || gameMode
} 