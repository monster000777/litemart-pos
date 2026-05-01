import { H3Error } from 'h3'
import { getPurchaseOrderById } from '~~/server/services/purchase-service'

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')
    if (!id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: '缺少采购单 ID'
      })
    }

    const order = await getPurchaseOrderById(id)
    if (!order) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Not Found',
        message: '采购单不存在'
      })
    }

    return order
  } catch (error) {
    if (error instanceof H3Error) throw error
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: '获取采购单详情失败'
    })
  }
})
