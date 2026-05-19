import { H3Error } from 'h3'
import { Prisma } from '@prisma/client'
import { prisma } from '~~/server/lib/prisma'
import { parseProductImage, toProductResponse } from '~~/server/services/product-service'
import { AUDIT_ACTIONS, writeAuditLog } from '~~/server/services/audit-service'
import { getClientIp } from '~~/server/utils/request'

type UpdateProductBody = {
  name?: string
  sku?: string
  image?: string | null
  category?: string
  price?: number
  memberPrice?: number | null
  stock?: number
  minStock?: number
}

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

    const body = await readBody<UpdateProductBody>(event)
    const product = await prisma.product.findUnique({
      where: { id },
      select: { id: true, price: true, memberPrice: true }
    })

    if (!product) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Not Found',
        message: '商品不存在'
      })
    }

    const data: Prisma.ProductUpdateInput = {}
    if (body.name !== undefined) {
      const name = body.name.trim()
      if (!name) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Bad Request',
          message: '商品名称不能为空'
        })
      }
      data.name = name
    }
    if (body.sku !== undefined) {
      const sku = body.sku.trim()
      if (!sku) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Bad Request',
          message: 'SKU 不能为空'
        })
      }
      data.sku = sku
    }
    if (body.image !== undefined) {
      data.image = parseProductImage(body.image, { allowUndefined: true })
    }
    if (body.category !== undefined) {
      const category = body.category.trim()
      if (!category) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Bad Request',
          message: '分类不能为空'
        })
      }
      data.category = category
    }
    if (body.price !== undefined) {
      const price = Number(body.price)
      if (Number.isNaN(price) || price < 0) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Bad Request',
          message: '价格格式错误'
        })
      }
      data.price = price
    }
    if (body.memberPrice !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (body.memberPrice === null || (body.memberPrice as any) === '') {
        data.memberPrice = null
      } else {
        const memberPrice = Number(body.memberPrice)
        if (Number.isNaN(memberPrice) || memberPrice < 0) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Bad Request',
            message: '会员价格式错误'
          })
        }
        data.memberPrice = memberPrice
      }
    }

    const nextPrice = Number(data.price ?? product.price)
    const nextMemberPriceValue =
      data.memberPrice === undefined ? product.memberPrice : data.memberPrice
    const nextMemberPrice = nextMemberPriceValue == null ? null : Number(nextMemberPriceValue)

    if (nextMemberPrice != null && nextMemberPrice > nextPrice) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: '会员价不能高于售价'
      })
    }

    if (body.stock !== undefined) {
      const stock = Math.floor(Number(body.stock))
      if (Number.isNaN(stock) || stock < 0) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Bad Request',
          message: '库存格式错误'
        })
      }
      data.stock = stock
    }
    if (body.minStock !== undefined) {
      const minStock = Math.floor(Number(body.minStock))
      if (Number.isNaN(minStock) || minStock < 0) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Bad Request',
          message: '预警值格式错误'
        })
      }
      data.minStock = minStock
    }

    if (!Object.keys(data).length) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: '未提供可更新字段'
      })
    }

    const updatedProduct = await prisma.product.update({
      where: { id },
      data
    })

    await writeAuditLog(
      AUDIT_ACTIONS.PRODUCT_UPDATE,
      `更新商品 ${updatedProduct.name} (${updatedProduct.sku})`,
      getClientIp(event)
    )

    return toProductResponse(updatedProduct)
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
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      throw createError({
        statusCode: 404,
        statusMessage: 'Not Found',
        message: '商品不存在'
      })
    }
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: '更新商品失败'
    })
  }
})
