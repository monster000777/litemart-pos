import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const products = await prisma.product.findMany({
  select: { name: true, sku: true, image: true }
})

console.log('商品图片状态:')
console.log('─'.repeat(60))
for (const p of products) {
  const status = p.image ? '✅' : '❌'
  console.log(`${status} ${p.sku} | ${p.name}`)
  if (p.image) {
    console.log(`   ${p.image}`)
  }
}

await prisma.$disconnect()
