/**
 * 补充抓取失败商品的图片
 */
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const UPLOADS_DIR = path.resolve(__dirname, '../public/uploads')

const prisma = new PrismaClient()

function safeParseJSON(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

async function searchBaiduImage(term: string): Promise<string | null> {
  try {
    const url = `https://image.baidu.com/search/acjson?tn=resultjson_com&word=${encodeURIComponent(term)}&pn=0&rn=3`
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Referer: 'https://image.baidu.com/'
      }
    })
    const text = await res.text()
    const data = safeParseJSON(text) as { data?: Array<{ thumbURL?: string }> }
    const item = data?.data?.find((d) => d.thumbURL)
    return item?.thumbURL || null
  } catch {
    return null
  }
}

async function download(url: string, filepath: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://image.baidu.com/' }
    })
    if (!res.ok) return false
    const buf = await res.arrayBuffer()
    fs.writeFileSync(filepath, Buffer.from(buf))
    return true
  } catch {
    return false
  }
}

async function main() {
  const products = await prisma.product.findMany({
    where: { image: null },
    select: { id: true, name: true, sku: true }
  })

  console.log(`待处理 ${products.length} 个商品\n`)

  for (const p of products) {
    console.log(`[${p.sku}] ${p.name}`)

    // 尝试不同的搜索词
    const terms = [p.name, p.name.split(' ')[0], p.name.replace(/[^一-龥a-zA-Z0-9]/g, '')]

    let url: string | null = null
    for (const t of terms) {
      url = await searchBaiduImage(t)
      if (url) break
    }

    if (!url) {
      console.log('  未找到图片\n')
      continue
    }

    // 跳过 HTTP
    if (url.startsWith('http://')) {
      console.log('  跳过 HTTP 图片，尝试其他来源...')
      // 用简化的搜索词再试一次
      url = await searchBaiduImage(p.name.split(' ')[0])
      if (!url || url.startsWith('http://')) {
        console.log('  失败\n')
        continue
      }
    }

    const filepath = path.join(UPLOADS_DIR, `product-${p.id}.jpg`)
    const ok = await download(url, filepath)

    if (ok) {
      await prisma.product.update({
        where: { id: p.id },
        data: { image: `/uploads/product-${p.id}.jpg` }
      })
      console.log(`  成功: /uploads/product-${p.id}.jpg\n`)
    } else {
      console.log('  下载失败\n')
    }

    await new Promise((r) => setTimeout(r, 500))
  }

  // 检查剩余未处理的
  const remaining = await prisma.product.count({ where: { image: null } })
  console.log(`\n剩余未设置图片: ${remaining} 个`)

  await prisma.$disconnect()
}

main()
