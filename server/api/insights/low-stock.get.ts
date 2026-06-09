import { ORDER_STATUS } from '~~/shared/constants/order'
import { prisma } from '~~/server/lib/prisma'

/**
 * Dify HTTP Tool 专用接口：低库存商品 + 供应商 + 近30天动销
 * Dify Agent 在「检查库存 / 起草补货单」流程中调用此接口。
 */
export default defineEventHandler(async () => {
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [allProducts, salesLast30Days] = await Promise.all([
    prisma.product.findMany({
      select: {
        id: true,
        name: true,
        sku: true,
        stock: true,
        minStock: true,
        supplier: { select: { name: true, contact: true } }
      }
    }),
    prisma.orderItem.findMany({
      where: {
        order: {
          status: ORDER_STATUS.COMPLETED,
          createdAt: { gte: thirtyDaysAgo }
        }
      },
      select: {
        productId: true,
        quantity: true
      }
    })
  ])

  // 低库存：stock <= minStock
  const lowStockProducts = allProducts
    .filter((p) => p.stock <= p.minStock)
    .sort((a, b) => a.stock - b.stock)

  // 近30天日均销量（按商品汇总）
  const salesMap = new Map<string, number>()
  for (const item of salesLast30Days) {
    salesMap.set(item.productId, (salesMap.get(item.productId) ?? 0) + item.quantity)
  }

  const result = lowStockProducts.map((product) => {
    const totalQty = salesMap.get(product.id) ?? 0
    const avgDaily = Math.round((totalQty / 30) * 100) / 100
    const sellableDays = avgDaily > 0 ? Math.round(product.stock / avgDaily) : null

    return {
      name: product.name,
      sku: product.sku,
      stock: product.stock,
      min_stock: product.minStock,
      supplier_name: product.supplier?.name ?? null,
      supplier_contact: product.supplier?.contact ?? null,
      avg_daily_sales_last30d: avgDaily,
      sellable_days: sellableDays,
      // 建议补货量 = max(0, minStock × 2 − stock)
      suggested_reorder_qty: Math.max(0, product.minStock * 2 - product.stock)
    }
  })

  return {
    count: result.length,
    low_stock_warnings: result
  }
})
