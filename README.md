# PUBG Plugin for Yunzai-Bot

<div align="center">
  <img src=".\resources\images\pubg_bg.png" alt="PUBG Logo" width="800" style="margin-bottom: 20px; position: absolute; top: 0; left: 50%; transform: translateX(-50%); z-index: -1; opacity: 0.3">
  <p>一个功能强大的绝地求生(PUBG)游戏数据查询插件</p>
  
  [![License](https://img.shields.io/github/license/A1Panda/PUBG_Plugin)](LICENSE)
  [![Node Version](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen)](package.json)
  [![Yunzai Version](https://img.shields.io/badge/Yunzai-%3E%3D3.0.0-blue)](package.json)
</div>

## 目录

- [简介](#简介)
- [功能特性](#功能特性)
- [安装指南](#安装指南)
- [使用说明](#使用说明)
- [配置说明](#配置说明)
- [API 密钥获取](#api-密钥获取)
- [常见问题](#常见问题)
- [更新日志](#更新日志)
- [贡献指南](#贡献指南)
- [开源协议](#开源协议)

## 简介

PUBG Plugin 是一个为 Yunzai-Bot 开发的绝地求生(PUBG)游戏数据查询插件。它提供了丰富的游戏数据查询功能，包括玩家战绩、武器统计、比赛详情等，并支持多平台账号绑定和精美的数据可视化展示。

## 功能特性

### 核心功能
- **玩家数据查询**：支持查询玩家基本信息、战绩统计、KD比等核心数据
- **武器使用统计**：详细分析主要武器使用数据，包括爆头率、命中率、击杀数等
- **比赛记录查询**：支持查询最近比赛记录、详细比赛数据、比赛地图等
- **多平台支持**：支持 Steam、PSN、Xbox、Kakao 等多个平台
- **账号绑定系统**：支持绑定 PUBG 账号，方便快速查询

### 特色功能
- **数据可视化**：生成精美的战绩图片和武器统计图表
- **实时数据更新**：支持实时获取最新比赛数据
- **多语言支持**：支持中英文界面切换
- **自定义配置**：支持自定义命令前缀、默认平台等
- **缓存系统**：内置缓存机制，提高查询效率

## 安装指南

### 环境要求
- Node.js >= 16.0.0
- Yunzai-Bot >= 3.0.0
- 有效的 PUBG API 密钥

### 安装步骤

#### 方法1: 手动安装（推荐）
1. 进入 Yunzai-Bot 的 plugins 目录
```bash
cd Yunzai-Bot/plugins
```

2. 克隆本仓库
```bash
git clone https://github.com/your-username/PUBG_Plugin.git
```

3. 进入插件目录并安装依赖
```bash
cd PUBG_Plugin
npm install
```

4. 配置 API 密钥
编辑 `config/config.js` 文件，添加你的 PUBG API 密钥：
```js
export default {
  apiKey: 'YOUR_PUBG_API_KEY'
}
```

5. 重启 Yunzai-Bot

#### 方法2: 使用 Yunzai 插件管理器
```bash
# 安装 PUBG 插件
/plugin add PUBG_Plugin
```

## 使用说明

### 基础命令
| 命令 | 说明 | 示例 |
|------|------|------|
| `#pubg帮助` | 显示帮助信息 | `#pubg帮助` |
| `#pubg关于` | 显示插件信息 | `#pubg关于` |
| `#pubg测试` | 测试 API 连接 | `#pubg测试` |

### 玩家查询
| 命令 | 说明 | 示例 |
|------|------|------|
| `#pubg查询 <游戏ID>` | 查询玩家基本信息 | `#pubg查询 Player123` |
| `#pubg查询 <游戏ID> <平台>` | 查询指定平台玩家 | `#pubg查询 Player123 steam` |
| `#pubg战绩图 <游戏ID>` | 生成战绩图片 | `#pubg战绩图 Player123` |
| `#pubg武器统计 <游戏ID>` | 查看武器统计 | `#pubg武器统计 Player123` |

### 比赛查询
| 命令 | 说明 | 示例 |
|------|------|------|
| `#pubg最近比赛 <游戏ID>` | 查询最近比赛 | `#pubg最近比赛 Player123` |
| `#pubg查询比赛 <比赛ID>` | 查询特定比赛 | `#pubg查询比赛 match-123` |
| `#pubg详细数据 <比赛ID>` | 查看详细数据 | `#pubg详细数据 match-123` |

### 账号管理
| 命令 | 说明 | 示例 |
|------|------|------|
| `#pubg绑定 <游戏ID>` | 绑定账号 | `#pubg绑定 Player123` |
| `#pubg解绑` | 解绑账号 | `#pubg解绑` |
| `#pubg我的信息` | 查看绑定信息 | `#pubg我的信息` |

## 配置说明

配置文件位于 `config/config.js`：

```js
export default {
  // PUBG API 密钥
  apiKey: 'YOUR_PUBG_API_KEY',
  
  // 命令前缀
  cmdPrefix: '#pubg',
  
  // 默认平台
  defaultPlatform: 'steam',
  
  // 默认区域
  defaultRegion: 'as',
  
  // 命令冷却时间（秒）
  cooldown: 10,
  
  // 缓存设置
  cache: {
    enable: true,
    expiry: 300 // 缓存过期时间（秒）
  },
  
  // 武器统计设置
  weaponStats: {
    matchCount: 10, // 分析最近多少场比赛
    minKills: 1     // 最小击杀数要求
  }
}
```

## API 密钥获取

1. 访问 [PUBG 开发者门户](https://developer.pubg.com/)
2. 注册并登录开发者账号
3. 在控制台创建新的 API 密钥
4. 复制密钥并添加到配置文件中

## 常见问题

### 1. API 密钥相关问题
**Q: 为什么显示 API 密钥无效？**
A: 请检查：
- API 密钥是否正确配置
- API 密钥是否已过期
- 是否达到 API 调用限制

**Q: 如何查看 API 使用情况？**
A: 在 PUBG 开发者门户的仪表板中可以查看 API 使用统计。

### 2. 功能相关问题
**Q: 为什么武器统计不显示数据？**
A: 可能原因：
- 玩家最近没有使用该武器
- 击杀数未达到最小要求
- 数据获取失败

**Q: 如何修改默认平台？**
A: 在配置文件中修改 `defaultPlatform` 值。

### 3. 安装相关问题
**Q: 安装依赖失败怎么办？**
A: 尝试：
- 使用管理员权限运行
- 检查 Node.js 版本
- 清除 npm 缓存后重试

## 更新日志

### v1.0.0 (2024-03-20)
- 初始版本发布
- 支持基础数据查询
- 支持武器统计功能
- 支持账号绑定系统

## 贡献指南

欢迎提交 Issue 和 Pull Request 来帮助改进这个项目。

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 开源协议

本项目采用 MIT 协议开源。详见 [LICENSE](LICENSE) 文件。 