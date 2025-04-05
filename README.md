# PUBG Plugin for Yunzai-Bot

<div align="center">
  <img src="./resources/images/pubg-logo.png" alt="PUBG Logo" width="200" style="margin-bottom: 20px">
</div>

## 简介

PUBG Plugin是一个为Yunzai-Bot开发的绝地求生(PUBG)游戏数据查询插件，它允许用户在QQ群中查询玩家战绩、武器数据，并提供精美的数据可视化。

## 主要功能

- **玩家战绩查询**：基础数据、战绩统计，支持多平台
- **武器数据统计**：分析主要武器使用数据，包括爆头率、命中率等
- **绑定账号**：支持绑定PUBG账号，方便快速查询
- **战绩可视化**：生成精美的战绩图片和武器统计图
- **最近比赛查询**：查看最近的比赛记录和细节

## 安装

### 方法1: 手动安装（推荐）

1. 在Yunzai-Bot的plugins目录下克隆本仓库
   ```bash
   cd Yunzai-Bot/plugins
   git clone https://github.com/your-username/PUBG_Plugin.git
   ```

2. 进入插件目录并运行安装脚本
   ```bash
   cd PUBG_Plugin
   node install.js
   ```

3. 编辑`config/config.js`文件，添加你的PUBG API密钥
   ```js
   apiKey: 'YOUR_PUBG_API_KEY'
   ```

4. 重启Yunzai-Bot

### 方法2: 使用Yunzai插件管理器

```bash
#安装PUBG插件
/plugin add PUBG_Plugin
```

## 使用方法

### 通用命令

- `#pubg帮助` - 显示帮助信息
- `#pubg绑定 <游戏ID> <平台>` - 绑定PUBG账号
- `#pubg解绑` - 解绑PUBG账号
- `#pubg我的信息` - 查看已绑定的账号信息

### 战绩查询

- `#pubg查询 <游戏ID> [平台]` - 查询玩家基本战绩
- `#pubg战绩图 <游戏ID> [平台]` - 生成战绩图片
- `#pubg最近比赛 <游戏ID> [平台]` - 查询最近比赛记录

### 武器统计

- `#pubg武器统计 <游戏ID> [平台]` - 生成武器使用统计图
- `#pubg我的武器` - 查询已绑定账号的武器统计

## 平台支持

- `steam` - Steam平台 (默认)
- `psn` - PlayStation平台
- `xbox` - Xbox平台
- `kakao` - 韩国Kakao平台

## 配置说明

配置文件位于`config/config.js`：

```js
export default {
  // PUBG API 密钥，必须修改成你自己的
  apiKey: 'YOUR_PUBG_API_KEY',
  
  // 命令前缀，默认 #pubg
  cmdPrefix: '#pubg',
  
  // 默认平台，可选：steam, kakao, psn, xbox
  defaultPlatform: 'steam',
  
  // 命令冷却时间（秒）
  cooldown: 10,
  
  // 武器统计分析的最大比赛场数
  weaponStatsMatchCount: 10
}
```

## 获取PUBG API密钥

1. 访问[PUBG开发者门户](https://developer.pubg.com/)并注册账号
2. 登录后，创建一个新的API密钥
3. 复制密钥并添加到配置文件中

## 注意事项

- 查询功能设有冷却时间，默认为10秒
- 武器统计功能分析最近的游戏，可能需要较长时间
- 首次使用需要安装依赖，确保网络通畅

## 常见问题

**Q: 为什么查询显示API密钥无效？**
A: 请确保正确配置了PUBG API密钥，并且密钥有效。

**Q: 为什么生成图片失败？**
A: 请确保安装了Puppeteer和其他依赖，某些环境可能需要手动安装浏览器依赖。

**Q: 如何修改命令前缀？**
A: 在配置文件中修改`cmdPrefix`值。

## 开源协议

MIT License 