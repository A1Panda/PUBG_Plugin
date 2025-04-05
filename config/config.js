export default {
  // 插件命令前缀
  cmdPrefix: '#pubg',
  
  // PUBG API 密钥
  // 注意: 您必须前往 https://developer.pubg.com/ 注册并获取API密钥
  // 否则插件将无法正常工作!
  apiKey: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJqdGkiOiJmMjhlZGFhMC1mM2VkLTAxM2QtNTczOS00YTQxYjRiNTk0OTIiLCJpc3MiOiJnYW1lbG9ja2VyIiwiaWF0IjoxNzQzODE3Njg4LCJwdWIiOiJibHVlaG9sZSIsInRpdGxlIjoicHViZyIsImFwcCI6InB1YmdfcGx1Z2luIn0.3aAK9PxRF3NYXME-FBjrRjVtTiy2ubqFtbdN3LcWvVU',
  
  // 默认服务器平台 (有效值: steam, kakao, psn, xbox, stadia)
  // PUBG API要求使用正确的平台ID
  defaultPlatform: 'steam',
  
  // 默认游戏区域 (有效值: as(亚洲), eu(欧洲), jp(日本), kakao(韩国), krjp(韩国/日本), na(北美), oc(大洋洲), ru(俄罗斯), sa(南美), sea(东南亚), tournament(比赛))
  defaultRegion: 'as',
  
  // 每页显示的比赛数量
  matchesPerPage: 5,
  
  // 冷却时间（单位：秒）
  cooldown: 10,
  
  // 是否启用数据缓存
  enableCache: true,
  
  // 缓存过期时间（单位：分钟）
  cacheExpiry: 5,
  
  // 武器统计分析的最大比赛数量
  // 较大的数值可提供更准确的统计，但会增加API请求次数和处理时间
  weaponStatsMatchCount: 10,
  
  // 是否在武器统计中包含机器人击杀
  includeBotsInWeaponStats: false,
  
  // 是否在武器统计中包含团队击倒
  includeKnockdownsInWeaponStats: true
} 