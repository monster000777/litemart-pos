import { prisma } from '~~/server/lib/prisma'

export default defineEventHandler(async () => {
  const alerts = await prisma.$queryRaw<
    Array<{
      id: string
      name: string
      sku: string
      stock: number
      minStock: number
      category: string
    }>
  >`
    SELECT "id", "name", "sku", "stock", "minStock", "category"
    FROM "Product"
    WHERE "stock" <= "minStock"
    ORDER BY ("minStock" - "stock") DESC
  `

  return {
    count: alerts.length,
    items: alerts
  }
})
