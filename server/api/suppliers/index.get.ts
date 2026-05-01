import { getSuppliers } from '~~/server/services/supplier-service'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const status = typeof query.status === 'string' ? query.status.trim() : undefined
  const search = typeof query.search === 'string' ? query.search.trim() : undefined

  return await getSuppliers({ status, search })
})
