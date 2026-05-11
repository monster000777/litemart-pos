process.env.DATABASE_URL = 'file:./test-membership.db'

const fs = await import('node:fs/promises')
const path = await import('node:path')

const dbPath = path.resolve(process.cwd(), 'prisma', 'test-membership.db')
await fs.rm(dbPath, { force: true })

const { prisma } = await import('../server/lib/prisma')
const { ensureSchemaBootstrapped } = await import('../server/lib/schema-bootstrap')
const { createCustomer, lookupByPhone } = await import('../server/services/customer-service')
const { createOrderAtomic } = await import('../server/services/order-service')
const { refundOrderAtomic } = await import('../server/services/order-refund-service')

const assert = (condition: unknown, message: string) => {
  if (!condition) {
    throw new Error(message)
  }
}

const main = async () => {
  await ensureSchemaBootstrapped()

  const customer = await createCustomer({
    phone: '13800138000',
    name: '测试会员'
  })

  const product = await prisma.product.create({
    data: {
      name: '测试商品',
      sku: 'MEM-001',
      category: 'TEST',
      price: 100,
      memberPrice: 80,
      stock: 10,
      minStock: 0
    }
  })

  const firstOrder = await createOrderAtomic({
    items: [{ productId: product.id, quantity: 1 }],
    memberId: customer.id
  })

  assert(firstOrder.totalAmount === 80, '会员价未生效')
  assert(firstOrder.pointsEarned === 80, '积分累计错误')

  const memberAfterFirst = await lookupByPhone('13800138000')
  assert(memberAfterFirst?.points === 80, '首单积分未写入')

  const secondOrder = await createOrderAtomic({
    items: [{ productId: product.id, quantity: 1 }],
    memberId: customer.id,
    pointsToUse: 1000
  })

  assert(secondOrder.discountAmount === 0, '不足 100 积分时不应抵扣')

  await prisma.customer.update({
    where: { id: customer.id },
    data: { points: 500 }
  })

  const thirdOrder = await createOrderAtomic({
    items: [{ productId: product.id, quantity: 1 }],
    memberId: customer.id,
    pointsToUse: 500
  })

  assert(thirdOrder.discountAmount === 5, '积分抵扣金额计算错误')
  assert(thirdOrder.pointsUsed === 500, '实际使用积分应与抵扣金额一致')
  assert(thirdOrder.totalAmount === 75, '抵扣后金额错误')

  const beforeRefundMember = await lookupByPhone('13800138000')
  assert(beforeRefundMember?.points === 75, '第三单后会员积分余额错误')

  const stockBeforeRefund = await prisma.product.findUnique({
    where: { id: product.id },
    select: { stock: true }
  })
  assert(stockBeforeRefund?.stock === 7, '下单后库存扣减错误')

  const refundedOrder = await refundOrderAtomic(thirdOrder.id)
  assert(refundedOrder.status === 'COMPLETED', '退款前订单读取异常')

  const afterRefundMember = await lookupByPhone('13800138000')
  assert(afterRefundMember?.points === 500, '退款后积分回滚错误')

  const stockAfterRefund = await prisma.product.findUnique({
    where: { id: product.id },
    select: { stock: true }
  })
  assert(stockAfterRefund?.stock === 8, '退款后库存恢复错误')

  const refundedOrderState = await prisma.order.findUnique({
    where: { id: thirdOrder.id },
    select: { status: true }
  })
  assert(refundedOrderState?.status === 'REFUNDED', '退款后订单状态错误')

  console.log('membership tests passed')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
