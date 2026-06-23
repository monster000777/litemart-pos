import { beforeEach, describe, expect, it, vi } from 'vitest'

const findUnique = vi.fn()
const findMany = vi.fn()

vi.mock('../../server/lib/prisma', () => ({
  prisma: {
    order: { findUnique, findMany }
  }
}))

vi.mock('ai', () => ({
  tool: (config: Record<string, unknown>) => config
}))

describe('lookupOrderTool', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return order with items.product by orderNo', async () => {
    const yesterdayOrder = {
      id: 'cuid-1',
      orderNo: 'LM20260622123456',
      status: 'COMPLETED',
      totalAmount: 42,
      createdAt: new Date('2026-06-22T10:30:00Z'),
      items: [
        {
          id: 'oi-1',
          quantity: 2,
          unitPrice: 21,
          product: { name: '可乐', sku: 'SKU-001' }
        }
      ]
    }
    findUnique.mockResolvedValueOnce(yesterdayOrder)

    const { lookupOrderTool } = await import('../../server/ai/tools/lookup-order')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (lookupOrderTool.execute as any)({ orderNo: 'LM20260622123456' })

    expect(findUnique).toHaveBeenCalledWith({
      where: { orderNo: 'LM20260622123456' },
      include: {
        items: {
          include: {
            product: { select: { name: true, sku: true } }
          }
        }
      }
    })
    expect(result).toEqual(yesterdayOrder)
  })

  // 回归测试 —— 历史订单（昨天 / 更早）也必须能查到，修复前曾因 where 字段错误返回 null
  it('should return historical order (created yesterday) by orderNo', async () => {
    const historical = {
      id: 'cuid-hist',
      orderNo: 'LM20260615009999',
      status: 'COMPLETED',
      totalAmount: 9.9,
      createdAt: new Date('2026-06-15T08:00:00Z'),
      items: []
    }
    findUnique.mockResolvedValueOnce(historical)

    const { lookupOrderTool } = await import('../../server/ai/tools/lookup-order')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (lookupOrderTool.execute as any)({ orderNo: 'LM20260615009999' })

    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orderNo: 'LM20260615009999' } })
    )
    expect(result).toEqual(historical)
  })

  it('should return null when orderNo not found', async () => {
    findUnique.mockResolvedValueOnce(null)

    const { lookupOrderTool } = await import('../../server/ai/tools/lookup-order')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (lookupOrderTool.execute as any)({ orderNo: 'LM_NOT_EXIST' })

    expect(result).toBeNull()
  })

  it('should query by orderNo (business key), not by id (cuid)', async () => {
    findUnique.mockResolvedValueOnce(null)

    const { lookupOrderTool } = await import('../../server/ai/tools/lookup-order')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (lookupOrderTool.execute as any)({ orderNo: 'LM20260623987908' })

    const whereArg = findUnique.mock.calls[0]?.[0]?.where
    expect(whereArg).toEqual({ orderNo: 'LM20260623987908' })
    expect(whereArg).not.toHaveProperty('id')
  })

  it('should validate orderNo is a non-empty string', async () => {
    const { lookupOrderTool } = await import('../../server/ai/tools/lookup-order')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inputSchema = (lookupOrderTool as any).inputSchema
    expect(() => inputSchema.parse({ orderNo: '' })).toThrow()
    expect(() => inputSchema.parse({ orderNo: 123 })).toThrow()
    expect(inputSchema.parse({ orderNo: 'LM20260623987908' })).toEqual({
      orderNo: 'LM20260623987908'
    })
  })
})

describe('listOrdersByDateTool', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return orders in the given date range with items summary', async () => {
    const rows = [
      {
        orderNo: 'LM20260602000001',
        status: 'COMPLETED',
        totalAmount: 25,
        createdAt: new Date('2026-06-02T11:00:00Z'),
        items: [{ quantity: 2, unitPrice: 12.5 }]
      },
      {
        orderNo: 'LM20260602000002',
        status: 'REFUNDED',
        totalAmount: 10,
        createdAt: new Date('2026-06-02T18:30:00Z'),
        items: [
          { quantity: 1, unitPrice: 6 },
          { quantity: 1, unitPrice: 4 }
        ]
      }
    ]
    findMany.mockResolvedValueOnce(rows)

    const { listOrdersByDateTool } = await import('../../server/ai/tools/list-orders-by-date')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (listOrdersByDateTool.execute as any)({
      startDate: '2026-06-02',
      endDate: '2026-06-02'
    })

    expect(findMany).toHaveBeenCalledTimes(1)
    const callArg = findMany.mock.calls[0]?.[0]
    expect(callArg.where.createdAt.gte).toBeInstanceOf(Date)
    expect(callArg.where.createdAt.lte).toBeInstanceOf(Date)
    // endDate 应该是当天 23:59:59.999，确保整日都覆盖
    expect(callArg.where.createdAt.lte.getHours()).toBe(23)
    expect(callArg.where.createdAt.lte.getMinutes()).toBe(59)
    expect(callArg.where.createdAt.lte.getSeconds()).toBe(59)
    expect(callArg.orderBy).toEqual({ createdAt: 'desc' })
    expect(callArg.take).toBe(50) // 默认 50
    expect(callArg.select.orderNo).toBe(true)
    expect(callArg.select.items.select).toEqual({ quantity: true, unitPrice: true })
    expect(result).toEqual(rows)
  })

  it('should respect custom limit and cap at 200', async () => {
    findMany.mockResolvedValueOnce([])

    const { listOrdersByDateTool } = await import('../../server/ai/tools/list-orders-by-date')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (listOrdersByDateTool.execute as any)({
      startDate: '2026-06-01',
      endDate: '2026-06-30',
      limit: 100
    })
    expect(findMany.mock.calls[0]?.[0].take).toBe(100)
  })

  it('should reject invalid input via zod schema', async () => {
    const { listOrdersByDateTool } = await import('../../server/ai/tools/list-orders-by-date')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inputSchema = (listOrdersByDateTool as any).inputSchema
    expect(() => inputSchema.parse({ startDate: 123, endDate: '2026-06-30' })).toThrow()
    expect(() => inputSchema.parse({ startDate: '2026-06-01' })).toThrow()
    expect(() =>
      inputSchema.parse({ startDate: '2026-06-01', endDate: '2026-06-30', limit: 0 })
    ).toThrow()
    expect(() =>
      inputSchema.parse({ startDate: '2026-06-01', endDate: '2026-06-30', limit: 500 })
    ).toThrow()
  })

  it('should return empty array when no orders in range', async () => {
    findMany.mockResolvedValueOnce([])
    const { listOrdersByDateTool } = await import('../../server/ai/tools/list-orders-by-date')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (listOrdersByDateTool.execute as any)({
      startDate: '2020-01-01',
      endDate: '2020-01-02'
    })
    expect(result).toEqual([])
  })
})
