import { lookupByPhone } from '~~/server/services/customer-service'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const phone = typeof query.phone === 'string' ? query.phone : ''

  if (!phone) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: '缺少手机号'
    })
  }

  return await lookupByPhone(phone)
})
