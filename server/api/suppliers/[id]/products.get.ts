import { prisma } from '~~/server/lib/prisma'

export default defineEventHandler(async (event) => {
  const supplierId = getRouterParam(event, 'id')

  if (!supplierId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: '请提供供应商ID'
    })
  }

  const products = await prisma.product.findMany({
    where: { supplierId },
    select: {
      id: true,
      name: true,
      sku: true,
      price: true,
      costPrice: true,
      stock: true,
      category: true
    },
    orderBy: { name: 'asc' }
  })

  return products.map((p) => ({
    ...p,
    price: Number(p.price),
    costPrice: Number(p.costPrice)
  }))
})
