import { H3Error } from 'h3'
import { Prisma } from '@prisma/client'
import { prisma } from '~~/server/lib/prisma'

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')
    if (!id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: '缺少商品 ID'
      })
    }

    await prisma.product.delete({ where: { id } })

    return {
      success: true,
      id
    }
  } catch (error) {
    if (error instanceof H3Error) {
      throw error
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      throw createError({
        statusCode: 404,
        statusMessage: 'Not Found',
        message: '商品不存在'
      })
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      throw createError({
        statusCode: 409,
        statusMessage: 'Conflict',
        message: '商品已有关联订单，无法删除'
      })
    }
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: '删除商品失败'
    })
  }
})
