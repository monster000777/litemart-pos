import { PrismaClient } from '@prisma/client'
import { ORDER_STATUS } from '../shared/constants/order'

const prisma = new PrismaClient()

type SeedProductTemplate = {
  name: string
  category: string
  priceRange: [number, number]
  costPriceRange: [number, number]
  stockRange: [number, number]
  minStockRange: [number, number]
  supplierIndex: number
}

type SeedSupplier = {
  name: string
  contactName: string
  phone: string
  email: string
  address: string
}

const suppliers: SeedSupplier[] = [
  {
    name: '华润饮料批发',
    contactName: '张经理',
    phone: '13800138001',
    email: 'zhang@huarun-drink.com',
    address: '广州市天河区天河路385号'
  },
  {
    name: '百味零食供应链',
    contactName: '李主管',
    phone: '13900139002',
    email: 'li@baiwei-snack.com',
    address: '深圳市南山区科技园南路66号'
  },
  {
    name: '得力文具经销商',
    contactName: '王业务',
    phone: '13700137003',
    email: 'wang@deler-supply.com',
    address: '上海市浦东新区张江高科技园区'
  },
  {
    name: '蒙牛乳业直供',
    contactName: '赵经理',
    phone: '13600136004',
    email: 'zhao@mengniu-direct.com',
    address: '呼和浩特市和林格尔县盛乐经济园区'
  },
  {
    name: '统一食品经销',
    contactName: '陈主管',
    phone: '13500135005',
    email: 'chen@tonyfood-dist.com',
    address: '天津市滨海新区经济技术开发区'
  }
]

const productTemplates: SeedProductTemplate[] = [
  {
    name: '元气森林气泡水',
    category: '饮料',
    priceRange: [4.5, 6.5],
    costPriceRange: [2.5, 3.5],
    stockRange: [20, 50],
    minStockRange: [8, 16],
    supplierIndex: 0
  },
  {
    name: '乐事原味薯片',
    category: '零食',
    priceRange: [5.0, 7.5],
    costPriceRange: [3.0, 4.0],
    stockRange: [18, 42],
    minStockRange: [8, 14],
    supplierIndex: 1
  },
  {
    name: '得力 0.5mm 黑色签字笔',
    category: '文具',
    priceRange: [2.0, 3.5],
    costPriceRange: [0.8, 1.5],
    stockRange: [30, 80],
    minStockRange: [12, 24],
    supplierIndex: 2
  },
  {
    name: '农夫山泉550ml',
    category: '饮料',
    priceRange: [2.0, 3.5],
    costPriceRange: [1.0, 1.5],
    stockRange: [24, 60],
    minStockRange: [10, 18],
    supplierIndex: 0
  },
  {
    name: '康师傅红烧牛肉面',
    category: '速食',
    priceRange: [4.0, 6.0],
    costPriceRange: [2.5, 3.5],
    stockRange: [16, 40],
    minStockRange: [6, 12],
    supplierIndex: 4
  },
  {
    name: '伊利纯牛奶250ml',
    category: '乳品',
    priceRange: [3.0, 4.8],
    costPriceRange: [1.8, 2.5],
    stockRange: [20, 45],
    minStockRange: [8, 14],
    supplierIndex: 3
  },
  {
    name: '晨光A5软抄本',
    category: '文具',
    priceRange: [4.0, 6.5],
    costPriceRange: [1.5, 2.5],
    stockRange: [20, 50],
    minStockRange: [8, 15],
    supplierIndex: 2
  },
  {
    name: '德芙丝滑巧克力',
    category: '零食',
    priceRange: [6.0, 9.5],
    costPriceRange: [3.5, 5.0],
    stockRange: [12, 36],
    minStockRange: [6, 12],
    supplierIndex: 1
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

const getDaysAgoAt = (days: number, hour: number, minute: number) => {
  const now = new Date()
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - days,
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
  console.log('Clearing existing data...')
  await prisma.$transaction([
    prisma.purchaseItem.deleteMany(),
    prisma.purchaseOrder.deleteMany(),
    prisma.orderItem.deleteMany(),
    prisma.order.deleteMany(),
    prisma.product.deleteMany(),
    prisma.supplier.deleteMany()
  ])

  console.log('Seeding suppliers...')
  const seededSuppliers = await Promise.all(
    suppliers.map((s) =>
      prisma.supplier.create({
        data: {
          name: s.name,
          contactName: s.contactName,
          phone: s.phone,
          email: s.email,
          address: s.address,
          status: 'ACTIVE'
        }
      })
    )
  )

  console.log('Seeding products...')
  const usedSkus = new Set<string>()
  const seededProducts = await Promise.all(
    productTemplates.map((template, index) =>
      prisma.product.create({
        data: {
          name: template.name,
          category: template.category,
          sku: buildSku(index, usedSkus),
          price: randomPrice(template.priceRange[0], template.priceRange[1]),
          costPrice: randomPrice(template.costPriceRange[0], template.costPriceRange[1]),
          stock: randomInt(template.stockRange[0], template.stockRange[1]),
          minStock: randomInt(template.minStockRange[0], template.minStockRange[1]),
          supplierId: seededSuppliers[template.supplierIndex].id
        }
      })
    )
  )

  console.log('Seeding purchase orders...')
  const purchasePlans = [
    {
      supplierIndex: 0,
      createdAt: getDaysAgoAt(7, 10, 30),
      status: 'RECEIVED',
      items: [
        { productIndex: 0, quantity: 50, unitCost: 3.0 },
        { productIndex: 3, quantity: 100, unitCost: 1.2 }
      ]
    },
    {
      supplierIndex: 1,
      createdAt: getDaysAgoAt(5, 14, 20),
      status: 'RECEIVED',
      items: [
        { productIndex: 1, quantity: 30, unitCost: 3.5 },
        { productIndex: 7, quantity: 20, unitCost: 4.2 }
      ]
    },
    {
      supplierIndex: 2,
      createdAt: getDaysAgoAt(3, 9, 15),
      status: 'RECEIVED',
      items: [
        { productIndex: 2, quantity: 100, unitCost: 1.0 },
        { productIndex: 6, quantity: 50, unitCost: 2.0 }
      ]
    },
    {
      supplierIndex: 3,
      createdAt: getYesterdayAt(11, 0),
      status: 'PENDING',
      items: [{ productIndex: 5, quantity: 40, unitCost: 2.2 }]
    },
    {
      supplierIndex: 0,
      createdAt: getYesterdayAt(16, 30),
      status: 'PENDING',
      items: [
        { productIndex: 0, quantity: 30, unitCost: 3.0 },
        { productIndex: 3, quantity: 60, unitCost: 1.2 }
      ]
    }
  ]

  for (let i = 0; i < purchasePlans.length; i++) {
    const plan = purchasePlans[i]
    const totalAmount = Number(
      plan.items.reduce((sum, item) => sum + item.unitCost * item.quantity, 0).toFixed(2)
    )

    await prisma.purchaseOrder.create({
      data: {
        orderNo: buildOrderNo('PO', i),
        supplierId: seededSuppliers[plan.supplierIndex].id,
        totalAmount,
        status: plan.status,
        notes: i === 3 ? '急单，请优先处理' : null,
        createdAt: plan.createdAt,
        updatedAt: plan.createdAt,
        items: {
          create: plan.items.map((item) => ({
            productId: seededProducts[item.productIndex].id,
            quantity: item.quantity,
            unitCost: item.unitCost
          }))
        }
      }
    })
  }

  console.log('Seeding sales orders...')
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
  const supplierCount = await prisma.supplier.count()
  const purchaseOrderCount = await prisma.purchaseOrder.count()

  console.log(`Seed completed:`)
  console.log(`  - ${supplierCount} suppliers`)
  console.log(`  - ${productCount} products`)
  console.log(`  - ${orderCount} sales orders`)
  console.log(`  - ${purchaseOrderCount} purchase orders`)
}

main()
  .catch((error) => {
    console.error('Seed failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
