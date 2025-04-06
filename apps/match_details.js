import plugin from '../../../lib/plugins/plugin.js'
import config from '../config/config.js'
import { PubgApiService } from '../utils/pubg-api.js'
import { RenderService } from '../utils/render.js'
import { UserDataManager, extractParameter, formatDate, formatDuration, getGameMode, getMapName } from '../utils/common.js'
import { segment } from 'oicq'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'

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
          reg: `^${config.cmdPrefix}详细数据.*$`,
          fnc: 'matchDetails'
        },
        {
          reg: `^${config.cmdPrefix}回放.*$`,
          fnc: 'matchReplay'
        },
        {
          reg: `^${config.cmdPrefix}队伍.*$`,
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
    const param = extractParameter(content, '#pubg详细数据')
    
    // 检查是否提供了比赛ID和玩家名称
    const [matchId, playerName] = param.split(/\s+/)
    if (!matchId) {
      await this.reply(`请输入正确的格式：#pubg详细数据 <比赛ID> [玩家名称]`)
      return true
    }

    // 如果没有提供玩家名称，尝试从绑定信息获取
    this.playerName = playerName
    if (!this.playerName) {
      const bindInfo = this.userDataManager.getUserBindInfo(e.user_id)
      if (bindInfo) {
        this.playerName = bindInfo.pubgId
      } else {
        await this.reply('请提供玩家名称或先绑定账号')
        return true
      }
    }

    try {
      // 获取比赛数据
      const matchData = await this.apiService.getMatch(matchId, 'steam')
      if (!matchData) {
        await this.reply('未找到该比赛记录')
        return true
      }

      // 获取遥测数据
      const telemetryAsset = matchData.included.find(item => item.type === 'asset')
      if (!telemetryAsset) {
        await this.reply('无法获取比赛遥测数据')
        return true
      }

      // 直接获取遥测数据
      try {
        const telemetryResponse = await fetch(telemetryAsset.attributes.URL)
        if (!telemetryResponse.ok) {
          throw new Error(`获取遥测数据失败: ${telemetryResponse.status} ${telemetryResponse.statusText}`)
        }

        const telemetry = await telemetryResponse.json()
        if (!telemetry) {
          await this.reply('获取比赛遥测数据失败')
          return true
        }

        // 处理遥测数据
        const detailedStats = this.processTelemetryData(telemetry, matchData)

        // 生成详细数据图片
        const imagePath = await this.generateDetailImage({
          matchInfo: {
            mapName: getMapName(matchData.data.attributes.mapName),
            gameMode: getGameMode(matchData.data.attributes.gameMode),
            createdAt: formatDate(new Date(matchData.data.attributes.createdAt)),
            duration: matchData.data.attributes.duration
          },
          playerStats: detailedStats,
          playerName: this.playerName
        })

        // 发送图片
        await this.sendImage(e, imagePath)

      } catch (error) {
        logger.error(`[PUBG-Plugin] 获取遥测数据失败: ${error.message}`)
        await this.reply(`获取遥测数据失败: ${error.message}`)
      }

    } catch (error) {
      logger.error(`[PUBG-Plugin] 获取比赛详情失败: ${error.message}`)
      await this.reply(`查询失败: ${error.message}`)
    }

    return true
  }

  /**
   * 处理遥测数据
   */
  processTelemetryData(telemetry, matchData) {
    // 从matchData中找到玩家数据
    const participant = matchData.included.find(item => 
      item.type === 'participant' && 
      item.attributes.stats.name.toLowerCase() === this.playerName.toLowerCase()
    )

    if (!participant) {
      return {
        damageDealt: 0,
        damageTaken: 0,
        headshotKills: 0,
        killStreaks: [],
        weaponStats: {},
        movement: {
          total: 0,
          vehicle: 0,
          walking: 0
        }
      }
    }

    // 从participant中获取基础数据
    const stats = participant.attributes.stats
    const result = {
      // 基础战斗数据
      damageDealt: Math.round(stats.damageDealt || 0),
      damageTaken: Math.round(stats.damageReceived || 0),
      headshotKills: stats.headshotKills || 0,
      kills: stats.kills || 0,
      assists: stats.assists || 0,
      DBNOs: stats.DBNOs || 0,
      
      // 生存数据
      timeSurvived: stats.timeSurvived || 0,
      boosts: stats.boosts || 0,
      heals: stats.heals || 0,
      revives: stats.revives || 0,
      
      // 排名数据
      killPlace: stats.killPlace || 0,
      winPlace: stats.winPlace || 0,
      
      // 特殊击杀
      roadKills: stats.roadKills || 0,
      teamKills: stats.teamKills || 0,
      longestKill: Math.round(stats.longestKill || 0),
      
      // 移动数据
      movement: {
        total: Math.round((stats.walkDistance || 0) + (stats.rideDistance || 0) + (stats.swimDistance || 0)),
        vehicle: Math.round(stats.rideDistance || 0),
        walking: Math.round(stats.walkDistance || 0),
        swimming: Math.round(stats.swimDistance || 0)
      },
      
      // 其他数据
      weaponsAcquired: stats.weaponsAcquired || 0,
      vehicleDestroys: stats.vehicleDestroys || 0,
      
      // 初始化连杀和武器数据
      killStreaks: [],
      weaponStats: {}
    }

    // 处理遥测数据中的武器统计和连杀记录
    let currentStreak = 0
    let lastKillTime = 0
    
    // 定义武器名称映射
    const weaponNameMap = {
      'M416': 'M416',
      'HK416': 'M416',
      'AKM': 'AKM',
      'SCAR-L': 'SCAR-L',
      'Kar98k': 'Kar98k',
      'M24': 'M24',
      'AWM': 'AWM',
      'Mini14': 'Mini14',
      'SKS': 'SKS',
      'VSS': 'VSS',
      'DP28': 'DP28',
      'UMP': 'UMP45',
      'Vector': 'Vector',
      'UZI': 'UZI',
      'S12K': 'S12K',
      'S686': 'S686',
      'S1897': 'S1897',
      'Crossbow': '弩',
      'Pan': '平底锅',
      'Vehicle': '载具',
      'Grenade': '手雷',
      'Molotov': '燃烧瓶',
      'Punch': '拳头'
    }
    
    if (telemetry) {
      telemetry.forEach(event => {
        // 处理击杀事件
        if (event._T === 'LogPlayerKill' && 
            event.killer && 
            event.killer.name && 
            event.killer.name.toLowerCase() === this.playerName.toLowerCase()) {
          
          // 获取武器名称
          let weaponName = event.damageCauserName || 'Unknown'
          
          // 处理武器名称
          weaponName = weaponName
            .replace('WeapName_', '')
            .replace('_C', '')
            .replace(/^BP_/, '')
            .replace(/^Weapon_/, '')
          
          // 使用武器名称映射
          if (weaponNameMap[weaponName]) {
            weaponName = weaponNameMap[weaponName]
          }
          
          // 初始化武器统计
          if (!result.weaponStats[weaponName]) {
            result.weaponStats[weaponName] = {
              kills: 0,
              headshots: 0,
              damage: 0
            }
          }
          
          // 更新击杀统计
          result.weaponStats[weaponName].kills++
          
          // 检查是否爆头
          if (event.damageReason === 'HeadShot') {
            result.weaponStats[weaponName].headshots++
          }
          
          // 处理连杀
          const currentTime = new Date(event._D).getTime()
          if (lastKillTime > 0 && currentTime - lastKillTime <= 10000) { // 10秒内的连杀
            currentStreak++
          } else {
            if (currentStreak > 1) { // 只记录2连杀及以上
              result.killStreaks.push(currentStreak)
            }
            currentStreak = 1
          }
          lastKillTime = currentTime
        }
        
        // 处理伤害事件
        else if (event._T === 'LogPlayerTakeDamage' &&
                event.attacker &&
                event.attacker.name &&
                event.attacker.name.toLowerCase() === this.playerName.toLowerCase()) {
          
          // 获取武器名称
          let weaponName = event.damageCauserName || 'Unknown'
          
          // 处理武器名称
          weaponName = weaponName
            .replace('WeapName_', '')
            .replace('_C', '')
            .replace(/^BP_/, '')
            .replace(/^Weapon_/, '')
          
          // 使用武器名称映射
          if (weaponNameMap[weaponName]) {
            weaponName = weaponNameMap[weaponName]
          }
          
          // 初始化武器统计
          if (!result.weaponStats[weaponName]) {
            result.weaponStats[weaponName] = {
              kills: 0,
              headshots: 0,
              damage: 0
            }
          }
          
          // 更新伤害统计
          result.weaponStats[weaponName].damage += event.damage || 0
        }
      })
    }

    // 添加最后一次连杀记录
    if (currentStreak > 1) { // 只记录2连杀及以上
      result.killStreaks.push(currentStreak)
    }

    // 处理武器统计数据，移除未造成伤害的武器
    Object.keys(result.weaponStats).forEach(weapon => {
      if (result.weaponStats[weapon].damage === 0 && result.weaponStats[weapon].kills === 0) {
        delete result.weaponStats[weapon]
      } else {
        // 四舍五入伤害值
        result.weaponStats[weapon].damage = Math.round(result.weaponStats[weapon].damage)
      }
    })

    return result
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
    const { matchInfo, playerStats, playerName } = data
    
    // 读取HTML模板
    const templatePath = path.join(__dirname, '../resources/html/match_details.html')
    let template = fs.readFileSync(templatePath, 'utf8')
    
    // 准备模板数据
    const templateData = {
      playerName,
      platform: 'steam',
      matchInfo: {
        mapName: matchInfo.mapName,
        gameMode: matchInfo.gameMode,
        createdAt: matchInfo.createdAt,
        duration: formatDuration(matchInfo.duration)
      },
      playerStats: {
        // 基础战斗数据
        kills: playerStats.kills || 0,
        assists: playerStats.assists || 0,
        DBNOs: playerStats.DBNOs || 0,
        damageDealt: Math.round(playerStats.damageDealt || 0),
        damageTaken: Math.round(playerStats.damageTaken || 0),
        headshotKills: playerStats.headshotKills || 0,
        longestKill: Math.round(playerStats.longestKill || 0),
        
        // 生存数据
        heals: playerStats.heals || 0,
        boosts: playerStats.boosts || 0,
        
        // 排名数据
        killPlace: playerStats.killPlace || 0,
        winPlace: playerStats.winPlace || 0,
        timeSurvived: Math.round(playerStats.timeSurvived || 0),
        
        // 移动数据
        movement: {
          total: Math.round(playerStats.movement?.total || 0),
          vehicle: Math.round(playerStats.movement?.vehicle || 0),
          walking: Math.round(playerStats.movement?.walking || 0),
          swimming: Math.round(playerStats.movement?.swimming || 0)
        }
      }
    }

    // 替换基本信息
    template = template.replace(/{{playerName}}/g, templateData.playerName)
      .replace(/{{platform}}/g, templateData.platform)
      .replace(/{{matchInfo\.mapName}}/g, templateData.matchInfo.mapName)
      .replace(/{{matchInfo\.gameMode}}/g, templateData.matchInfo.gameMode)
      .replace(/{{matchInfo\.createdAt}}/g, templateData.matchInfo.createdAt)
      .replace(/{{matchInfo\.duration}}/g, templateData.matchInfo.duration)

    // 替换玩家统计数据
    template = template.replace(/{{playerStats\.kills}}/g, templateData.playerStats.kills)
      .replace(/{{playerStats\.assists}}/g, templateData.playerStats.assists)
      .replace(/{{playerStats\.DBNOs}}/g, templateData.playerStats.DBNOs)
      .replace(/{{playerStats\.damageDealt}}/g, templateData.playerStats.damageDealt)
      .replace(/{{playerStats\.damageTaken}}/g, templateData.playerStats.damageTaken)
      .replace(/{{playerStats\.headshotKills}}/g, templateData.playerStats.headshotKills)
      .replace(/{{playerStats\.longestKill}}/g, templateData.playerStats.longestKill)
      .replace(/{{playerStats\.heals}}/g, templateData.playerStats.heals)
      .replace(/{{playerStats\.boosts}}/g, templateData.playerStats.boosts)
      .replace(/{{playerStats\.killPlace}}/g, templateData.playerStats.killPlace)
      .replace(/{{playerStats\.winPlace}}/g, templateData.playerStats.winPlace)
      .replace(/{{playerStats\.timeSurvived}}/g, templateData.playerStats.timeSurvived)

    // 替换移动数据
    template = template.replace(/{{playerStats\.movement\.total}}/g, templateData.playerStats.movement.total)
      .replace(/{{playerStats\.movement\.vehicle}}/g, templateData.playerStats.movement.vehicle)
      .replace(/{{playerStats\.movement\.walking}}/g, templateData.playerStats.movement.walking)
      .replace(/{{playerStats\.movement\.swimming}}/g, templateData.playerStats.movement.swimming)

    // 处理武器统计
    if (playerStats.weaponStats && Object.keys(playerStats.weaponStats).length > 0) {
      let weaponStatsHtml = ''
      for (const [weapon, stats] of Object.entries(playerStats.weaponStats)) {
        // 处理武器名称
        let weaponName = weapon.replace('WeapName_', '').replace('_C', '')
        // 如果是载具伤害，特殊处理
        if (weaponName.includes('Vehicle')) {
          weaponName = '载具'
        }
        
        // 生成武器统计HTML
        weaponStatsHtml += `
          <div class="weapon-item">
            <div class="weapon-name">${weaponName}</div>
            <div class="weapon-data">
              <div>击杀: ${stats.kills || 0}</div>
              <div>爆头: ${stats.headshots || 0}</div>
              <div>伤害: ${Math.round(stats.damage || 0)}</div>
            </div>
          </div>`
      }
      
      // 替换武器统计部分
      template = template.replace(
        /{{#if playerStats\.weaponStats}}[\s\S]*?{{\/if}}/g,
        weaponStatsHtml
      )
    } else {
      // 如果没有武器数据，显示提示信息
      template = template.replace(
        /{{#if playerStats\.weaponStats}}[\s\S]*?{{\/if}}/g,
        '<div class="no-data">无武器使用数据</div>'
      )
    }

    // 处理连杀记录
    if (playerStats.killStreaks && playerStats.killStreaks.length > 0) {
      const killStreaksHtml = playerStats.killStreaks
        .map(streak => `<div class="streak-item">${streak}连杀</div>`)
        .join('')
      
      // 替换连杀记录部分
      template = template.replace(
        /{{#if playerStats\.killStreaks\.length}}[\s\S]*?{{\/if}}/g,
        `<div class="kill-streaks">
          <div class="info-label">连杀:</div>
          ${killStreaksHtml}
        </div>`
      )
    } else {
      // 如果没有连杀记录，显示提示信息
      template = template.replace(
        /{{#if playerStats\.killStreaks\.length}}[\s\S]*?{{\/if}}/g,
        '<div class="no-data">无连杀记录</div>'
      )
    }

    // 使用 puppeteer 生成图片
    const browser = await puppeteer.launch({
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
    const page = await browser.newPage()
    await page.setViewport({ width: 800, height: 800 })
    await page.setContent(template)
    
    // 等待内容加载完成
    await page.waitForSelector('.container')
    
    // 获取实际内容高度
    const containerHeight = await page.evaluate(() => {
      const container = document.querySelector('.container')
      return container.getBoundingClientRect().height
    })
    
    // 调整视口高度
    await page.setViewport({ width: 800, height: Math.ceil(containerHeight) + 40 })
    
    // 确保临时目录存在
    const tempDir = path.join(process.cwd(), 'temp')
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir)
    }
    
    // 生成图片
    const imagePath = path.join(tempDir, `match_details_${Date.now()}.png`)
    await page.screenshot({
      path: imagePath,
      fullPage: true
    })
    
    await browser.close()
    return imagePath
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