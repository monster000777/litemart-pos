import { PrismaClient } from '@prisma/client'
import { ORDER_STATUS } from '../shared/constants/order'

const prisma = new PrismaClient()

type SeedProductTemplate = {
  name: string
  category: string
  priceRange: [number, number]
  stockRange: [number, number]
  minStockRange: [number, number]
}

const productTemplates: SeedProductTemplate[] = [
  {
    name: '元气森林气泡水',
    category: '饮料',
    priceRange: [4.5, 6.5],
    stockRange: [20, 50],
    minStockRange: [8, 16]
  },
  {
    name: '乐事原味薯片',
    category: '零食',
    priceRange: [5.0, 7.5],
    stockRange: [18, 42],
    minStockRange: [8, 14]
  },
  {
    name: '得力 0.5mm 黑色签字笔',
    category: '文具',
    priceRange: [2.0, 3.5],
    stockRange: [30, 80],
    minStockRange: [12, 24]
  },
  {
    name: '农夫山泉550ml',
    category: '饮料',
    priceRange: [2.0, 3.5],
    stockRange: [24, 60],
    minStockRange: [10, 18]
  },
  {
    name: '康师傅红烧牛肉面',
    category: '速食',
    priceRange: [4.0, 6.0],
    stockRange: [16, 40],
    minStockRange: [6, 12]
  },
  {
    name: '伊利纯牛奶250ml',
    category: '乳品',
    priceRange: [3.0, 4.8],
    stockRange: [20, 45],
    minStockRange: [8, 14]
  },
  {
    name: '晨光A5软抄本',
    category: '文具',
    priceRange: [4.0, 6.5],
    stockRange: [20, 50],
    minStockRange: [8, 15]
  },
  {
    name: '德芙丝滑巧克力',
    category: '零食',
    priceRange: [6.0, 9.5],
    stockRange: [12, 36],
    minStockRange: [6, 12]
  }
]

const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min
const randomPrice = (min: number, max: number) =>
  Number((Math.random() * (max - min) + min).toFixed(2))

const buildSku = (index: number, used: Set<string>) => {
  let sku = ''
  do {
    const suffix = randomInt(1000, 9999)
    sku = `LM-CAMPUS-${String(index + 1).padStart(2, '0')}-${suffix}`
  } while (used.has(sku))
  used.add(sku)
  return sku
}

const getYesterdayAt = (hour: number, minute: number) => {
  const now = new Date()
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 1,
    hour,
    minute,
    randomInt(0, 59)
  )
}

const buildOrderNo = (prefix: string, idx: number) => {
  const now = new Date()
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  return `${prefix}${date}${String(idx + 1).padStart(3, '0')}`
}

async function main() {
  await prisma.$transaction([
    prisma.orderItem.deleteMany(),
    prisma.order.deleteMany(),
    prisma.product.deleteMany()
  ])

  const usedSkus = new Set<string>()
  const seededProducts = await Promise.all(
    productTemplates.map((template, index) =>
      prisma.product.create({
        data: {
          name: template.name,
          category: template.category,
          sku: buildSku(index, usedSkus),
          price: randomPrice(template.priceRange[0], template.priceRange[1]),
          stock: randomInt(template.stockRange[0], template.stockRange[1]),
          minStock: randomInt(template.minStockRange[0], template.minStockRange[1])
        }
      })
    )
  )

  const stockMap = new Map(seededProducts.map((product) => [product.id, product.stock]))
  const pricedProducts = seededProducts.map((product) => ({
    id: product.id,
    name: product.name,
    sku: product.sku,
    price: Number(product.price)
  }))

  const orderPlans = [
    { createdAt: getYesterdayAt(9, 18), status: ORDER_STATUS.COMPLETED, customerTail: '2841' },
    { createdAt: getYesterdayAt(11, 42), status: ORDER_STATUS.COMPLETED, customerTail: '7305' },
    { createdAt: getYesterdayAt(15, 9), status: ORDER_STATUS.COMPLETED, customerTail: '4419' },
    { createdAt: getYesterdayAt(19, 26), status: ORDER_STATUS.REFUNDED, customerTail: '1186' }
  ]

  for (let i = 0; i < orderPlans.length; i += 1) {
    const orderPlan = orderPlans[i]
    const candidates = [...pricedProducts]
      .sort(() => Math.random() - 0.5)
      .filter((product) => (stockMap.get(product.id) ?? 0) > 0)
      .slice(0, randomInt(2, 4))

    const items = candidates
      .map((product) => {
        const available = stockMap.get(product.id) ?? 0
        const quantity = randomInt(1, Math.min(3, available))
        return { ...product, quantity }
      })
      .filter((item) => item.quantity > 0)

    if (!items.length) {
      continue
    }

    const totalAmount = Number(
      items.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2)
    )

    await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          orderNo: buildOrderNo('LMSEED', i),
          status: orderPlan.status,
          customerTail: orderPlan.customerTail,
          totalAmount,
          createdAt: orderPlan.createdAt
        }
      })

      await tx.orderItem.createMany({
        data: items.map((item) => ({
          orderId: order.id,
          productId: item.id,
          quantity: item.quantity,
          unitPrice: item.price
        }))
      })

      if (orderPlan.status === ORDER_STATUS.COMPLETED) {
        for (const item of items) {
          await tx.product.update({
            where: { id: item.id },
            data: { stock: { decrement: item.quantity } }
          })
          stockMap.set(item.id, (stockMap.get(item.id) ?? 0) - item.quantity)
        }
      }
    })
  }

  const productCount = await prisma.product.count()
  const orderCount = await prisma.order.count()

  console.log(`Seed completed: ${productCount} products, ${orderCount} orders.`)
}

main()
  .catch((error) => {
    console.error('Seed failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
