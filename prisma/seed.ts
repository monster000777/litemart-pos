import { PrismaClient } from '@prisma/client'
import { ORDER_STATUS } from '../shared/constants/order'

const prisma = new PrismaClient()

type SeedSupplier = {
  name: string
  contactName: string
  phone: string
  email: string
  address: string
}

type SeedProductTemplate = {
  name: string
  category: string
  price: number
  memberPrice: number | null
  costPrice: number
  stock: number
  minStock: number
  supplierIndex: number
}

type SeedCustomer = {
  phone: string
  name: string
  points: number
  level: string
}

const suppliers: SeedSupplier[] = [
  {
    name: '华润饮料批发',
    contactName: '张经理',
    phone: '13800138001',
    email: 'zhang@huarun-drink.com',
    address: '广州市天河区天河路 185 号'
  },
  {
    name: '百味零食供应链',
    contactName: '李主管',
    phone: '13900139002',
    email: 'li@baiwei-snack.com',
    address: '深圳市南山区科技园南路 16 号'
  },
  {
    name: '得力文具经销商',
    contactName: '王业务',
    phone: '13700137003',
    email: 'wang@deli-supply.com',
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
    price: 6,
    memberPrice: 5.5,
    costPrice: 3.2,
    stock: 36,
    minStock: 10,
    supplierIndex: 0
  },
  {
    name: '乐事原味薯片',
    category: '零食',
    price: 7,
    memberPrice: 6.2,
    costPrice: 3.8,
    stock: 28,
    minStock: 8,
    supplierIndex: 1
  },
  {
    name: '得力 0.5mm 黑色签字笔',
    category: '文具',
    price: 3,
    memberPrice: 2.5,
    costPrice: 1.2,
    stock: 60,
    minStock: 15,
    supplierIndex: 2
  },
  {
    name: '农夫山泉 550ml',
    category: '饮料',
    price: 3,
    memberPrice: 2.5,
    costPrice: 1.3,
    stock: 45,
    minStock: 12,
    supplierIndex: 0
  },
  {
    name: '康师傅红烧牛肉面',
    category: '速食',
    price: 5,
    memberPrice: 4.5,
    costPrice: 2.9,
    stock: 30,
    minStock: 8,
    supplierIndex: 4
  },
  {
    name: '伊利纯牛奶 250ml',
    category: '乳品',
    price: 4,
    memberPrice: 3.5,
    costPrice: 2.2,
    stock: 32,
    minStock: 10,
    supplierIndex: 3
  },
  {
    name: '晨光 A5 软抄本',
    category: '文具',
    price: 5,
    memberPrice: null,
    costPrice: 2.1,
    stock: 42,
    minStock: 10,
    supplierIndex: 2
  },
  {
    name: '德芙丝滑巧克力',
    category: '零食',
    price: 8,
    memberPrice: 7,
    costPrice: 4.5,
    stock: 22,
    minStock: 6,
    supplierIndex: 1
  }
]

const customers: SeedCustomer[] = [
  {
    phone: '13800138000',
    name: '测试会员',
    points: 320,
    level: 'NORMAL'
  },
  {
    phone: '13911112222',
    name: '王晓琳',
    points: 980,
    level: 'SILVER'
  },
  {
    phone: '13799998888',
    name: '陈志远',
    points: 1680,
    level: 'GOLD'
  }
]

const getDaysAgoAt = (days: number, hour: number, minute: number) => {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - days, hour, minute, 0)
}

const buildSku = (index: number) =>
  `LM-CAMPUS-${String(index + 1).padStart(2, '0')}-${String(1000 + index)}`

const buildOrderNo = (prefix: string, idx: number) => {
  const now = new Date()
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  return `${prefix}${date}${String(idx + 1).padStart(3, '0')}`
}

async function main() {
  console.log('Clearing existing data...')
  await prisma.$transaction([
    prisma.pointLog.deleteMany(),
    prisma.purchaseItem.deleteMany(),
    prisma.purchaseOrder.deleteMany(),
    prisma.orderItem.deleteMany(),
    prisma.order.deleteMany(),
    prisma.customer.deleteMany(),
    prisma.product.deleteMany(),
    prisma.supplier.deleteMany()
  ])

  console.log('Seeding suppliers...')
  const seededSuppliers = await Promise.all(
    suppliers.map((supplier) =>
      prisma.supplier.create({
        data: {
          ...supplier,
          status: 'ACTIVE'
        }
      })
    )
  )

  console.log('Seeding products...')
  const seededProducts = await Promise.all(
    productTemplates.map((template, index) =>
      prisma.product.create({
        data: {
          name: template.name,
          category: template.category,
          sku: buildSku(index),
          price: template.price,
          memberPrice: template.memberPrice,
          costPrice: template.costPrice,
          stock: template.stock,
          minStock: template.minStock,
          supplierId: seededSuppliers[template.supplierIndex].id
        }
      })
    )
  )

  console.log('Seeding customers...')
  const seededCustomers = await Promise.all(
    customers.map((customer) =>
      prisma.customer.create({
        data: customer
      })
    )
  )

  console.log('Seeding purchase orders...')
  await prisma.purchaseOrder.create({
    data: {
      orderNo: buildOrderNo('PO', 0),
      supplierId: seededSuppliers[0].id,
      totalAmount: 174,
      status: 'RECEIVED',
      notes: '首批饮料补货',
      createdAt: getDaysAgoAt(7, 10, 30),
      updatedAt: getDaysAgoAt(7, 10, 30),
      items: {
        create: [
          {
            productId: seededProducts[0].id,
            quantity: 30,
            unitCost: 3.2
          },
          {
            productId: seededProducts[3].id,
            quantity: 60,
            unitCost: 1.3
          }
        ]
      }
    }
  })

  await prisma.purchaseOrder.create({
    data: {
      orderNo: buildOrderNo('PO', 1),
      supplierId: seededSuppliers[1].id,
      totalAmount: 186,
      status: 'PENDING',
      notes: '零食周补货',
      createdAt: getDaysAgoAt(2, 15, 0),
      updatedAt: getDaysAgoAt(2, 15, 0),
      items: {
        create: [
          {
            productId: seededProducts[1].id,
            quantity: 24,
            unitCost: 3.8
          },
          {
            productId: seededProducts[7].id,
            quantity: 18,
            unitCost: 4.5
          }
        ]
      }
    }
  })

  console.log('Seeding sales orders...')
  const completedOrder = await prisma.order.create({
    data: {
      orderNo: buildOrderNo('LMSEED', 0),
      status: ORDER_STATUS.COMPLETED,
      customerTail: seededCustomers[1].phone.slice(-4),
      memberId: seededCustomers[1].id,
      totalAmount: 15.2,
      pointsUsed: 0,
      pointsEarned: 15,
      discountAmount: 0,
      createdAt: getDaysAgoAt(1, 11, 20)
    }
  })

  await prisma.orderItem.createMany({
    data: [
      {
        orderId: completedOrder.id,
        productId: seededProducts[0].id,
        quantity: 2,
        unitPrice: 5.5
      },
      {
        orderId: completedOrder.id,
        productId: seededProducts[1].id,
        quantity: 1,
        unitPrice: 6.2
      }
    ]
  })

  await prisma.product.update({
    where: { id: seededProducts[0].id },
    data: { stock: { decrement: 2 } }
  })
  await prisma.product.update({
    where: { id: seededProducts[1].id },
    data: { stock: { decrement: 1 } }
  })
  await prisma.customer.update({
    where: { id: seededCustomers[1].id },
    data: { points: { increment: 15 } }
  })
  await prisma.pointLog.create({
    data: {
      customerId: seededCustomers[1].id,
      orderId: completedOrder.id,
      change: 15,
      reason: '消费积分'
    }
  })

  const refundedOrder = await prisma.order.create({
    data: {
      orderNo: buildOrderNo('LMSEED', 1),
      status: ORDER_STATUS.REFUNDED,
      customerTail: seededCustomers[2].phone.slice(-4),
      memberId: seededCustomers[2].id,
      totalAmount: 9.5,
      pointsUsed: 200,
      pointsEarned: 11,
      discountAmount: 2,
      createdAt: getDaysAgoAt(1, 18, 45)
    }
  })

  await prisma.orderItem.createMany({
    data: [
      {
        orderId: refundedOrder.id,
        productId: seededProducts[4].id,
        quantity: 1,
        unitPrice: 4.5
      },
      {
        orderId: refundedOrder.id,
        productId: seededProducts[5].id,
        quantity: 2,
        unitPrice: 3.5
      }
    ]
  })

  await prisma.pointLog.createMany({
    data: [
      {
        customerId: seededCustomers[2].id,
        orderId: refundedOrder.id,
        change: -200,
        reason: '积分抵扣'
      },
      {
        customerId: seededCustomers[2].id,
        orderId: refundedOrder.id,
        change: 11,
        reason: '消费积分'
      },
      {
        customerId: seededCustomers[2].id,
        orderId: refundedOrder.id,
        change: 189,
        reason: '退款积分回滚'
      }
    ]
  })

  const productCount = await prisma.product.count()
  const orderCount = await prisma.order.count()
  const customerCount = await prisma.customer.count()
  const supplierCount = await prisma.supplier.count()
  const purchaseOrderCount = await prisma.purchaseOrder.count()

  console.log('Seed completed:')
  console.log(`  - ${supplierCount} suppliers`)
  console.log(`  - ${customerCount} customers`)
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
