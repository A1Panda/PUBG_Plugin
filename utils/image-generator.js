import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { StatsGenerator } from './generators/stats-generator.js'

// 获取当前文件的目录
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 资源路径
const RESOURCES_DIR = path.join(__dirname, '../resources')
const TEMP_DIR = path.join(RESOURCES_DIR, 'temp')
const TEMPLATES_DIR = path.join(RESOURCES_DIR, 'templates')

// 确保目录存在
if (!fs.existsSync(RESOURCES_DIR)) fs.mkdirSync(RESOURCES_DIR, { recursive: true })
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true })
if (!fs.existsSync(TEMPLATES_DIR)) fs.mkdirSync(TEMPLATES_DIR, { recursive: true })

/**
 * 图片生成器类 - 管理图片生成器
 */
export class ImageGenerator {
  constructor() {
    // 初始化统计生成器
    this.statsGenerator = new StatsGenerator(RESOURCES_DIR, TEMP_DIR, TEMPLATES_DIR)
  }

  /**
   * 获取格式化的战绩图片
   * @param {object} playerData 玩家数据
   * @param {object} seasonData 赛季数据
   * @param {string} platform 平台
   * @returns {Promise<string>} 图片路径或文本
   */
  async getFormattedStats(playerData, seasonData, platform) {
    try {
      // 生成文本格式的战绩数据
      const textStats = await this.statsGenerator.generatePlayerStats(playerData, seasonData, platform)
      
      // 提取玩家数据，用于图片生成
      const playerName = playerData.attributes.name
      const stats = seasonData.data.attributes.gameModeStats
      
      try {
        // 生成图片并返回路径
        const imgPath = await this.statsGenerator.generateStatsImage(playerName, stats, platform)
        
        if (!imgPath) {
          console.warn('[PUBG-Plugin] 图片生成失败，返回文本格式')
          return textStats
        }
        
        // 设置延迟删除
        setTimeout(async () => {
          try {
            await fs.promises.unlink(imgPath)
            console.log(`[PUBG-Plugin] 已清理临时图片: ${path.basename(imgPath)}`)
          } catch (error) {
            console.error(`[PUBG-Plugin] 清理临时图片失败: ${error.message}`)
          }
        }, 1000) // 1秒后删除，确保图片已经发送
        
        return imgPath
      } catch (error) {
        console.error(`[PUBG-Plugin] 图片生成失败: ${error.message}`)
        return textStats
      }
    } catch (error) {
      console.error(`[PUBG-Plugin] 获取战绩数据失败: ${error.message}`)
      throw error
    }
  }
  
  /**
   * 清理临时文件
   * 可用于定期清理生成的临时图片文件
   * @param {number} maxAge 文件最大保留时间（毫秒）
   * @returns {Promise<number>} 返回清理的文件数量
   */
  async cleanupTempFiles(maxAge = 1 * 60 * 60 * 1000) { // 默认1小时
    try {
      const now = Date.now()
      const files = await fs.promises.readdir(TEMP_DIR)
      
      let deletedCount = 0
      
      for (const file of files) {
        if (file.endsWith('.png') || file.endsWith('.html')) {
          const filePath = path.join(TEMP_DIR, file)
          const stats = await fs.promises.stat(filePath)
          
          // 检查文件是否超过最大保留时间
          if (now - stats.mtimeMs > maxAge) {
            await fs.promises.unlink(filePath)
            deletedCount++
          }
        }
      }
      
      if (deletedCount > 0) {
        logger.info(`[PUBG-Plugin] 已清理 ${deletedCount} 个临时文件`)
      }
      
      return deletedCount
    } catch (error) {
      logger.error(`[PUBG-Plugin] 清理临时文件失败: ${error.message}`)
      throw error // 向上传播错误
    }
  }
} 