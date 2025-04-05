/**
 * 武器统计分析工具
 * 分析PUBG比赛遥测数据中的武器使用情况
 */
export class WeaponStatsAnalyzer {
  constructor() {
    // 武器名称映射表，将内部ID映射为友好名称
    this.weaponNameMap = {
      // 突击步枪
      'WeapHK416_C': 'M416',
      'WeapAK47_C': 'AKM',
      'WeapSCAR-L_C': 'SCAR-L',
      'WeapG36C_C': 'G36C',
      'WeapBerylM762_C': 'Beryl M762',
      'WeapMk47Mutant_C': 'MK47 Mutant',
      'WeapM16A4_C': 'M16A4',
      'WeapACE32_C': 'ACE32',
      'WeapAUG_C': 'AUG A3',
      'WeapGroza_C': 'Groza',
      'WeapQBZ95_C': 'QBZ95',
      'WeapFamas_C': 'Famas',
      'WeapK2_C': 'K2',
      
      // 狙击步枪
      'WeapKar98k_C': 'Kar98k',
      'WeapM24_C': 'M24',
      'WeapAWM_C': 'AWM',
      'WeapWin94_C': 'Win94',
      'WeapMosinNagant_C': 'Mosin Nagant',
      'WeapLynx_C': 'Lynx AMR',
      
      // 精确射手步枪
      'WeapMk14_C': 'MK14 EBR',
      'WeapMini14_C': 'Mini14',
      'WeapSKS_C': 'SKS',
      'WeapVSS_C': 'VSS',
      'WeapQBU88_C': 'QBU',
      'WeapSLR_C': 'SLR',
      'WeapMk12_C': 'MK12',
      
      // 轻机枪
      'WeapDP28_C': 'DP-28',
      'WeapM249_C': 'M249',
      'WeapL6_C': 'MG3',
      
      // 霰弹枪
      'WeapS686_C': 'S686',
      'WeapS1897_C': 'S1897',
      'WeapS12K_C': 'S12K',
      'WeapDBS_C': 'DBS',
      'WeapSawedoff_C': 'Sawed-off',
      'WeapShake_C': 'O12',
      
      // 冲锋枪
      'WeapThompson_C': 'Tommy Gun',
      'WeapUMP_C': 'UMP45',
      'WeapVector_C': 'Vector',
      'WeapUZI_C': 'Micro UZI',
      'WeapMP5K_C': 'MP5K',
      'WeapBizonPP19_C': 'PP-19 Bizon',
      'WeapP90_C': 'P90',
      
      // 手枪
      'WeapG18_C': 'P18C',
      'WeapM1911_C': 'P1911',
      'WeapR1895_C': 'R1895',
      'WeapNagantM1895_C': 'R1895',
      'WeapRhino_C': 'R45',
      'WeapP92_C': 'P92',
      'WeapDesertEagle_C': 'Deagle',
      'WeapSaiga_C': 'Skorpion',
      
      // 近战武器
      'WeapCowbar_C': '撬棍',
      'WeapMachete_C': '砍刀',
      'WeapPan_C': '平底锅',
      'WeapSickle_C': '镰刀',
      'WeapCrossbow_C': '十字弩',
      
      // 投掷武器
      'WeapMolotov_C': '燃烧瓶',
      'WeapSmokeBomb_C': '烟雾弹',
      'WeapGrenade_C': '手雷',
      'WeapFlashBang_C': '闪光弹',
      'WeapJerryCan_C': '汽油桶',
      'WeapStickyGrenade_C': 'C4炸弹',
      'WeapDecoyGrenade_C': '诱饵弹',
      'WeapBluezoneGrenade_C': '蓝区手雷',
      
      // 未知武器或特殊情况
      'None': '其他武器',
      'Undefined': '未定义武器',
      'Default': '默认武器'
    }
  }

  /**
   * 分析玩家武器使用情况
   * @param {string} playerId 玩家ID
   * @param {Array} matches 比赛列表
   * @param {string} platform 平台
   * @param {object} apiService API服务实例
   * @returns {Promise<object>} 武器统计数据
   */
  async analyzePlayerWeapons(playerId, matches, platform, apiService) {
    // 武器统计结果
    const weaponStats = {
      totalKills: 0,
      totalHeadshots: 0,
      overallHeadshotRate: 0,
      matchesAnalyzed: 0,
      weapons: []
    }
    
    // 创建武器数据映射
    const weaponMap = new Map()
    
    // 遍历比赛
    for (const match of matches) {
      try {
        // 获取比赛详情
        const matchData = await apiService.getMatch(match.id, platform)
        
        // 检查是否有遥测数据
        if (!matchData.data.relationships || !matchData.data.relationships.assets) {
          logger.debug(`[PUBG-Plugin] 比赛 ${match.id} 无遥测数据`)
          continue
        }
        
        // 获取遥测数据资源
        const assets = matchData.data.relationships.assets.data
        if (!assets || assets.length === 0) {
          continue
        }
        
        // 查找遥测数据URL
        const assetId = assets[0].id
        const asset = matchData.included.find(item => item.type === 'asset' && item.id === assetId)
        
        if (!asset || !asset.attributes || !asset.attributes.URL) {
          continue
        }
        
        // 获取遥测数据
        const telemetryUrl = asset.attributes.URL
        const telemetryData = await apiService.getTelemetry(telemetryUrl)
        
        // 分析击杀事件
        if (Array.isArray(telemetryData)) {
          this.analyzeKillEvents(telemetryData, playerId, weaponMap)
          weaponStats.matchesAnalyzed++
        }
        
      } catch (error) {
        logger.error(`[PUBG-Plugin] 分析比赛 ${match.id} 遥测数据失败: ${error.message}`)
        continue
      }
      
      // 限制分析的比赛数，避免请求过多
      if (weaponStats.matchesAnalyzed >= 10) {
        break
      }
    }
    
    // 转换为数组并计算总数据
    weaponMap.forEach((data, weaponId) => {
      // 计算爆头率
      const headshotRate = data.shots > 0 
        ? Math.round((data.headshots / data.shots) * 100) 
        : 0
      
      // 计算命中率
      const accuracy = data.shots > 0 
        ? Math.round((data.hits / data.shots) * 100) 
        : 0
      
      // 添加到武器列表
      weaponStats.weapons.push({
        weaponId,
        weaponName: this.getWeaponName(weaponId),
        kills: data.kills,
        headshots: data.headshots,
        headshotRate,
        shots: data.shots,
        hits: data.hits,
        accuracy,
        damage: data.damage
      })
      
      // 更新总数据
      weaponStats.totalKills += data.kills
      weaponStats.totalHeadshots += data.headshots
    })
    
    // 计算总体爆头率
    weaponStats.overallHeadshotRate = weaponStats.totalKills > 0 
      ? Math.round((weaponStats.totalHeadshots / weaponStats.totalKills) * 100)
      : 0
    
    return weaponStats
  }

  /**
   * 分析遥测数据中的击杀事件
   * @param {Array} telemetryData 遥测数据
   * @param {string} playerId 玩家ID
   * @param {Map} weaponMap 武器数据映射
   */
  analyzeKillEvents(telemetryData, playerId, weaponMap) {
    // 筛选出击杀事件
    const killEvents = telemetryData.filter(event => 
      (event._T === 'LogPlayerKill' || event._T === 'LogPlayerMakeGroggy') && 
      event.killer && 
      event.killer.accountId === playerId
    )
    
    // 筛选出武器射击事件
    const weaponEvents = telemetryData.filter(event => 
      (event._T === 'LogWeaponFireCount' || event._T === 'LogPlayerAttack') && 
      event.attacker && 
      event.attacker.accountId === playerId
    )
    
    // 筛选出伤害事件
    const damageEvents = telemetryData.filter(event => 
      event._T === 'LogPlayerTakeDamage' && 
      event.attacker && 
      event.attacker.accountId === playerId
    )
    
    // 处理击杀事件
    for (const event of killEvents) {
      const weaponId = event.damageCauserName || 'None'
      
      // 获取或创建武器数据
      if (!weaponMap.has(weaponId)) {
        weaponMap.set(weaponId, {
          kills: 0,
          headshots: 0,
          shots: 0,
          hits: 0,
          damage: 0
        })
      }
      
      const weaponData = weaponMap.get(weaponId)
      weaponData.kills++
      
      // 检查是否为爆头
      if (event.damageReason === 'HeadShot') {
        weaponData.headshots++
      }
    }
    
    // 处理武器射击事件
    for (const event of weaponEvents) {
      const weaponId = event.weaponId || event.weapon?.itemId || 'None'
      
      if (!weaponMap.has(weaponId)) {
        weaponMap.set(weaponId, {
          kills: 0,
          headshots: 0,
          shots: 0,
          hits: 0,
          damage: 0
        })
      }
      
      const weaponData = weaponMap.get(weaponId)
      
      // 更新射击和命中数据
      if (event.fireCount) {
        weaponData.shots += event.fireCount
      } else if (event.attackType === 'Weapon') {
        weaponData.shots += 1
        
        // 命中更新
        if (event.attackId > 0) {
          weaponData.hits += 1
        }
      }
    }
    
    // 处理伤害事件
    for (const event of damageEvents) {
      const weaponId = event.damageCauserName || 'None'
      
      if (!weaponMap.has(weaponId)) {
        weaponMap.set(weaponId, {
          kills: 0,
          headshots: 0,
          shots: 0,
          hits: 0,
          damage: 0
        })
      }
      
      const weaponData = weaponMap.get(weaponId)
      weaponData.hits += 1
      weaponData.damage += (event.damage || 0)
    }
  }

  /**
   * 获取武器友好名称
   * @param {string} weaponId 武器ID
   * @returns {string} 武器名称
   */
  getWeaponName(weaponId) {
    return this.weaponNameMap[weaponId] || weaponId.replace('Weap', '').replace('_C', '')
  }
} 