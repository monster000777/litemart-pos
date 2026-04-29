import { H3Error } from 'h3'
import { Prisma } from '@prisma/client'
import { prisma } from '~~/server/lib/prisma'
import { AUDIT_ACTIONS, writeAuditLog } from '~~/server/services/audit-service'
import { getClientIp } from '~~/server/utils/request'

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

    const product = await prisma.product.findUnique({
      where: { id },
      select: { name: true, sku: true }
    })

    if (!product) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Not Found',
        message: '商品不存在'
      })
    }

    await prisma.product.delete({ where: { id } })

    await writeAuditLog(
      AUDIT_ACTIONS.PRODUCT_DELETE,
      `删除商品「${product.name}」(${product.sku})`,
      getClientIp(event)
    )

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
