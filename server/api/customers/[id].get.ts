import { getCustomerById } from '~~/server/services/customer-service'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: '缺少会员 ID'
    })
  }

  return await getCustomerById(id)
})
