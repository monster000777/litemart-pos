/**
 * 库存商品图片抓取脚本 v4
 *
 * 使用方式：
 *   npx tsx scripts/fetch-product-images.ts        # 只抓取无图片商品
 *   npx tsx scripts/fetch-product-images.ts --force  # 强制重新抓取所有商品
 */

import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const UPLOADS_DIR = path.resolve(__dirname, '../public/uploads')

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true })
}

const prisma = new PrismaClient()
const forceUpdate = process.argv.includes('--force')

interface ProductInfo {
  id: string
  name: string
  sku: string
}

/**
 * 安全解析 JSON，处理转义问题
 */
function safeParseJSON(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    // 尝试修复常见的转义问题
    const fixed = text
      .replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/\\\\/g, '\\')
    return JSON.parse(fixed)
  }
}

/**
 * 通过百度图片接口搜索图片
 */
async function searchImageOnBaidu(productName: string): Promise<string | null> {
  try {
    const url = `https://image.baidu.com/search/acjson?tn=resultjson_com&word=${encodeURIComponent(productName)}&pn=0&rn=5`

    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json',
        Referer: 'https://image.baidu.com/'
      }
    })

    if (!response.ok) {
      console.log(`    接口失败: ${response.status}`)
      return null
    }

    const text = await response.text()
    const data = safeParseJSON(text) as {
      data?: Array<{ thumbURL?: string; middleURL?: string; hoverURL?: string }>
    }

    if (data.data && data.data.length > 0) {
      const item = data.data.find((d) => d.thumbURL) || data.data[0]
      const imageUrl = item?.thumbURL || item?.middleURL || item?.hoverURL
      if (imageUrl) {
        console.log(`    找到: ${imageUrl.substring(0, 50)}...`)
        return imageUrl
      }
    }

    console.log(`    无结果`)
    return null
  } catch (err) {
    console.log(`    异常: ${err}`)
    return null
  }
}

/**
 * 下载图片到本地
 */
async function downloadImage(url: string, filename: string): Promise<string | null> {
  try {
    // 跳过 HTTP URL（百度有些图片是 HTTP）
    if (url.startsWith('http://')) {
      console.log(`    跳过 HTTP 图片`)
      return null
    }

    console.log(`    下载: ${url.substring(0, 60)}...`)

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Referer: 'https://image.baidu.com/'
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const contentType = response.headers.get('content-type') || ''
    if (!contentType.startsWith('image/')) {
      throw new Error(`非图片: ${contentType}`)
    }

    const buffer = await response.arrayBuffer()
    const filePath = path.join(UPLOADS_DIR, filename)
    fs.writeFileSync(filePath, Buffer.from(buffer))

    const localPath = `/uploads/${filename}`
    console.log(`    保存成功 (${(buffer.byteLength / 1024).toFixed(1)}KB)`)
    return localPath
  } catch (err) {
    console.error(`    下载失败: ${err}`)
    return null
  }
}

async function main() {
  console.log('=== 商品图片抓取脚本 v4 ===\n')

  const products: ProductInfo[] = await prisma.product.findMany({
    where: forceUpdate ? {} : { image: null },
    select: { id: true, name: true, sku: true }
  })

  console.log(`找到 ${products.length} 个商品待处理\n`)

  if (products.length === 0) {
    console.log('全部完成。')
    await prisma.$disconnect()
    return
  }

  let success = 0
  let fail = 0

  for (const product of products) {
    console.log(`\n[${product.sku}] ${product.name}`)

    // 生成唯一文件名（使用完整 ID 避免冲突）
    const filename = `product-${product.id}.jpg`

    // 尝试多个搜索词
    const searchTerms = [
      product.name,
      product.name.replace(/\s+/g, ''), // 无空格版本
      product.name.split(' ')[0] // 只取第一个词
    ]

    let imageUrl: string | null = null
    for (const term of searchTerms) {
      if (imageUrl) break
      imageUrl = await searchImageOnBaidu(term)
      if (!imageUrl) {
        console.log(`    重试: ${term}`)
      }
    }

    if (!imageUrl) {
      fail++
      continue
    }

    const localPath = await downloadImage(imageUrl, filename)
    if (localPath) {
      await prisma.product.update({
        where: { id: product.id },
        data: { image: localPath }
      })
      success++
    } else {
      fail++
    }

    await new Promise((r) => setTimeout(r, 800))
  }

  console.log('\n=== 完成 ===')
  console.log(`成功: ${success}  失败: ${fail}`)

  await prisma.$disconnect()
  process.exit(fail > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('失败:', err)
  process.exit(1)
})
