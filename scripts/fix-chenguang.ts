/**
 * 补充晨光 A5 软抄本的图片
 */
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const UPLOADS_DIR = path.resolve(__dirname, '../public/uploads')

const prisma = new PrismaClient()

async function searchBaiduImage(term: string): Promise<string | null> {
  try {
    const url = `https://image.baidu.com/search/acjson?tn=resultjson_com&word=${encodeURIComponent(term)}&pn=0&rn=5`
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Referer: 'https://image.baidu.com/'
      }
    })
    const text = await res.text()
    // 手动解析，避开转义问题
    const match = text.match(/"thumbURL"\s*:\s*"([^"]+)"/)
    return match ? match[1] : null
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
  const product = await prisma.product.findFirst({
    where: { name: { contains: '晨光' } },
    select: { id: true, name: true }
  })

  if (!product) {
    console.log('未找到晨光商品')
    return
  }

  console.log(`商品: ${product.name}`)
  console.log(`ID: ${product.id}`)

  // 搜索图片
  const terms = ['晨光A5软抄本', '晨光笔记本A5', 'A5软抄本', '晨光笔记本']
  let url: string | null = null

  for (const t of terms) {
    console.log(`搜索: ${t}`)
    url = await searchBaiduImage(t)
    if (url) {
      console.log(`找到: ${url.substring(0, 60)}...`)
      break
    }
  }

  if (!url) {
    console.log('未找到图片')
    await prisma.$disconnect()
    return
  }

  // 跳过 HTTP
  if (url.startsWith('http://')) {
    console.log('跳过 HTTP 图片')
    // 尝试 HTTPS 版本
    url = url.replace('http://', 'https://')
    if (url.startsWith('http://')) {
      console.log('失败')
      await prisma.$disconnect()
      return
    }
  }

  const filename = `product-${product.id}.jpg`
  const filepath = path.join(UPLOADS_DIR, filename)

  console.log(`下载到: ${filepath}`)
  const ok = await download(url, filepath)

  if (ok) {
    await prisma.product.update({
      where: { id: product.id },
      data: { image: `/uploads/${filename}` }
    })
    console.log('更新成功!')
  } else {
    console.log('下载失败')
  }

  await prisma.$disconnect()
}

main()
