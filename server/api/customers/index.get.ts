import { getCustomers } from '~~/server/services/customer-service'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)

  return await getCustomers({
    page: Number(query.page) || 1,
    pageSize: Number(query.pageSize) || 20,
    search: typeof query.search === 'string' ? query.search : undefined,
    level: typeof query.level === 'string' ? query.level : undefined
  })
})
