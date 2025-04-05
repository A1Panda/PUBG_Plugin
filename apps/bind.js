import plugin from '../../../lib/plugins/plugin.js'
import config from '../config/config.js'
import { UserDataManager, extractParameter, formatDate } from '../utils/common.js'
import { PubgApiService } from '../utils/pubg-api.js'

/**
 * 账号绑定功能模块
 */
export class BindApp extends plugin {
  constructor() {
    super({
      name: 'PUBG-绑定',
      dsc: 'PUBG账号绑定功能',
      event: 'message',
      priority: 5000,
      rule: [
        {
          reg: `^${config.cmdPrefix}设置区域.*$`,
          fnc: 'setRegion'
        },
        {
          reg: `^${config.cmdPrefix}设置平台.*$`,
          fnc: 'setPlatform'
        }
      ]
    })

    this.userDataManager = new UserDataManager()
    this.apiService = new PubgApiService()
  }

  /**
   * 设置默认区域
   * @param {object} e 消息事件对象
   */
  async setRegion(e) {
    // 检查是否是管理员
    if (!this.isAdmin(e)) {
      await this.reply('只有管理员才能修改全局设置')
      return true
    }
    
    // 获取参数
    const content = e.msg.trim()
    const region = extractParameter(content, `${config.cmdPrefix}设置区域`)
    
    if (!region) {
      await this.reply(`请输入正确的格式：${config.cmdPrefix}设置区域 <区域代码>`)
      return true
    }
    
    // 检查区域是否有效
    const validRegions = ['as', 'eu', 'jp', 'kakao', 'krjp', 'na', 'oc', 'ru', 'sa', 'sea', 'tournament']
    if (!validRegions.includes(region)) {
      await this.reply(`无效的区域代码，有效值: as(亚洲), eu(欧洲), jp(日本), kakao(韩国), krjp(韩国/日本), na(北美), oc(大洋洲), ru(俄罗斯), sa(南美), sea(东南亚), tournament(比赛)`)
      return true
    }
    
    // 修改配置
    config.defaultRegion = region
    
    await this.reply(`已将默认区域设置为: ${config.defaultRegion}`)
    return true
  }

  /**
   * 设置默认平台
   * @param {object} e 消息事件对象
   */
  async setPlatform(e) {
    // 检查是否是管理员
    if (!this.isAdmin(e)) {
      await this.reply('只有管理员才能修改全局设置')
      return true
    }
    
    // 获取参数
    const content = e.msg.trim()
    const platform = extractParameter(content, `${config.cmdPrefix}设置平台`)
    
    if (!platform) {
      await this.reply(`请输入正确的格式：${config.cmdPrefix}设置平台 <平台>`)
      return true
    }
    
    // 检查平台是否有效
    const validPlatforms = ['steam', 'kakao', 'psn', 'xbox', 'stadia']
    if (!validPlatforms.includes(platform)) {
      await this.reply(`无效的平台，有效值: steam, kakao, psn, xbox, stadia`)
      return true
    }
    
    // 修改配置
    config.defaultPlatform = platform
    
    await this.reply(`已将默认平台设置为: ${config.defaultPlatform}`)
    return true
  }

  /**
   * 检查用户是否是管理员
   * @param {object} e 消息事件对象
   * @returns {boolean} 是否是管理员
   */
  isAdmin(e) {
    return e.isMaster || e.member?.is_admin || e.member?.is_owner || false
  }
} 