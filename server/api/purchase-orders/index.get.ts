import { getPurchaseOrders } from '~~/server/services/purchase-service'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const status = typeof query.status === 'string' ? query.status.trim() : undefined
  const supplierId = typeof query.supplierId === 'string' ? query.supplierId.trim() : undefined
  const page = Number(query.page) || 1
  const pageSize = Number(query.pageSize) || 20

  return await getPurchaseOrders({ status, supplierId, page, pageSize })
})
