process.env.DATABASE_URL = 'file:./dev.db'

const { prisma } = await import('../server/lib/prisma')

const assert = (condition: unknown, message: string) => {
  if (!condition) {
    throw new Error(message)
  }
}

const main = async () => {
  const customerCount = await prisma.customer.count()
  const productCount = await prisma.product.count()
  const memberPriceCount = await prisma.product.count({
    where: {
      memberPrice: {
        not: null
      }
    }
  })
  const orderCount = await prisma.order.count()
  const refundedCount = await prisma.order.count({
    where: { status: 'REFUNDED' }
  })

  assert(customerCount >= 3, 'seed 后会员数量不足')
  assert(productCount >= 8, 'seed 后商品数量不足')
  assert(memberPriceCount >= 5, 'seed 后会员价商品不足')
  assert(orderCount >= 2, 'seed 后订单数量不足')
  assert(refundedCount >= 1, 'seed 后退款订单不足')

  const sampleMember = await prisma.customer.findUnique({
    where: { phone: '13800138000' }
  })
  assert(sampleMember, '缺少测试会员 13800138000')

  console.log('seed verification passed')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
