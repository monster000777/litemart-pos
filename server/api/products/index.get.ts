import { H3Error } from 'h3'
import { prisma } from '~~/server/lib/prisma'
import { toProductResponse } from '~~/server/services/product-service'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const name = typeof query.name === 'string' ? query.name.trim() : ''

    const products = await prisma.product.findMany({
      where: name
        ? {
            name: {
              contains: name
            }
          }
        : undefined,
      orderBy: { createdAt: 'desc' }
    })

    return products.map(toProductResponse)
  } catch (error) {
    if (error instanceof H3Error) {
      throw error
    }
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: '获取商品列表失败'
    })
  }
})
