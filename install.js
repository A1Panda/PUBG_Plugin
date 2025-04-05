import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

// 获取当前文件的目录
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ASCII 艺术标题
const ASCII_LOGO = `
██████╗ ██╗   ██╗██████╗  ██████╗ 
██╔══██╗██║   ██║██╔══██╗██╔════╝ 
██████╔╝██║   ██║██████╔╝██║  ███╗
██╔═══╝ ██║   ██║██╔══██╗██║   ██║
██║     ╚██████╔╝██████╔╝╚██████╔╝
╚═╝      ╚═════╝ ╚═════╝  ╚═════╝ 
插件安装程序
`

console.log('\x1b[33m%s\x1b[0m', ASCII_LOGO)

// 安装所需依赖
function installDependencies() {
  console.log('\x1b[36m%s\x1b[0m', '=== 开始安装插件依赖 ===')
  
  try {
    console.log('安装 pubg.js...')
    execSync('npm install pubg.js@^4.4.0', { stdio: 'inherit', cwd: __dirname })
    
    console.log('安装 puppeteer...')
    execSync('npm install puppeteer@^21.1.1', { stdio: 'inherit', cwd: __dirname })
    
    console.log('安装 handlebars...')
    execSync('npm install handlebars@^4.7.8', { stdio: 'inherit', cwd: __dirname })
    
    console.log('安装 axios...')
    execSync('npm install axios@^1.5.0', { stdio: 'inherit', cwd: __dirname })
    
    console.log('\x1b[32m%s\x1b[0m', '所有依赖安装成功!')
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', `依赖安装失败: ${error.message}`)
    console.log('请尝试手动安装依赖:')
    console.log('npm install pubg.js@^4.4.0 puppeteer@^21.1.1 handlebars@^4.7.8 axios@^1.5.0')
    process.exit(1)
  }
}

// 创建目录结构
function createDirectories() {
  console.log('\x1b[36m%s\x1b[0m', '=== 创建目录结构 ===')
  
  const dirs = [
    path.join(__dirname, 'resources'),
    path.join(__dirname, 'resources/temp'),
    path.join(__dirname, 'resources/templates'),
    path.join(__dirname, 'resources/images'),
    path.join(__dirname, 'data')
  ]
  
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
      console.log(`创建目录: ${dir}`)
    } else {
      console.log(`目录已存在: ${dir}`)
    }
  }
  
  console.log('\x1b[32m%s\x1b[0m', '目录结构创建完成!')
}

// 检查配置文件
function checkConfig() {
  console.log('\x1b[36m%s\x1b[0m', '=== 检查配置文件 ===')
  
  const configPath = path.join(__dirname, 'config/config.js')
  
  if (!fs.existsSync(configPath)) {
    // 配置目录不存在，创建它
    if (!fs.existsSync(path.join(__dirname, 'config'))) {
      fs.mkdirSync(path.join(__dirname, 'config'))
      console.log('创建配置目录')
    }
    
    // 创建默认配置文件
    const defaultConfig = `export default {
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
}`
    
    fs.writeFileSync(configPath, defaultConfig)
    console.log('\x1b[33m%s\x1b[0m', `创建默认配置文件: ${configPath}`)
    console.log('\x1b[33m%s\x1b[0m', '请记得修改配置文件中的 apiKey 为你自己的 PUBG API 密钥')
  } else {
    console.log('配置文件已存在')
  }
  
  console.log('\x1b[32m%s\x1b[0m', '配置文件检查完成!')
}

// 检查模板文件
function checkTemplates() {
  console.log('\x1b[36m%s\x1b[0m', '=== 检查模板文件 ===')
  
  const statsTemplatePath = path.join(__dirname, 'resources/templates/stats-template.html')
  const weaponTemplatePath = path.join(__dirname, 'resources/templates/weapon-template.html')
  
  if (!fs.existsSync(statsTemplatePath) || !fs.existsSync(weaponTemplatePath)) {
    console.log('\x1b[33m%s\x1b[0m', '模板文件不存在，请确保运行插件前添加了必要的模板文件')
  } else {
    console.log('模板文件已存在')
  }
}

// 显示安装完成信息
function showCompletionInfo() {
  console.log('\x1b[32m%s\x1b[0m', `
=== PUBG Plugin 安装完成 ===

请确保完成以下步骤：
1. 编辑 config/config.js 文件，设置你的 PUBG API Key
   获取API Key: https://developer.pubg.com/

2. 重启 Yunzai-Bot

使用方法:
- #pubg帮助   - 查看帮助信息
- #pubg查询   - 查询玩家信息
- #pubg战绩图 - 生成战绩图片
- #pubg武器统计 - 查看武器使用统计
- #pubg绑定   - 绑定PUBG账号

`)
}

// 主函数
async function main() {
  try {
    installDependencies()
    createDirectories()
    checkConfig()
    checkTemplates()
    showCompletionInfo()
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', `安装过程中出错: ${error.message}`)
    process.exit(1)
  }
}

// 运行主函数
main() 