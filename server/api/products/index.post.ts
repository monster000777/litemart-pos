import { H3Error } from 'h3'
import { Prisma } from '@prisma/client'
import { prisma } from '~~/server/lib/prisma'
import { parseProductImage, toProductResponse } from '~~/server/services/product-service'
import { AUDIT_ACTIONS, writeAuditLog } from '~~/server/services/audit-service'
import { getClientIp } from '~~/server/utils/request'

type CreateProductBody = {
  name?: string
  sku?: string
  image?: string | null
  category?: string
  price?: number
  stock?: number
  minStock?: number
}

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<CreateProductBody>(event)
    const name = body.name?.trim()
    const sku = body.sku?.trim()
    const image = parseProductImage(body.image)
    const category = body.category?.trim()
    const price = Number(body.price)
    const stock = Math.floor(Number(body.stock))
    const minStock = Math.floor(Number(body.minStock))

    if (!name || !sku || !category || Number.isNaN(price) || Number.isNaN(stock) || Number.isNaN(minStock)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: '商品字段不完整或格式错误'
      })
    }

    if (price < 0 || stock < 0 || minStock < 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: '价格、库存和预警值必须大于等于 0'
      })
    }

    const product = await prisma.product.create({
      data: {
        name,
        sku,
        image,
        category,
        price,
        stock,
        minStock
      }
    })

    await writeAuditLog(
      AUDIT_ACTIONS.PRODUCT_CREATE,
      `新增商品「${name}」(${sku})`,
      getClientIp(event)
    )

    return toProductResponse(product)
  } catch (error) {
    if (error instanceof H3Error) {
      throw error
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw createError({
        statusCode: 409,
        statusMessage: 'Conflict',
        message: 'SKU 已存在'
      })
    }
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: '新增商品失败'
    })
  }
})
