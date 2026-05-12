import { describe, it, expect } from 'vitest'

const roundMoney = (value: number) => Math.round(value * 100) / 100

const getEffectiveUnitPrice = (
  product: { price: number; memberPrice: number | null },
  memberId?: string
) => (memberId && product.memberPrice != null ? product.memberPrice : product.price)

const getPointDiscountAmount = (points: number) => Math.floor(points / 100)

const calculateOrderDiscount = (subtotal: number, memberPoints: number, pointsToUse: number) => {
  const maxDiscountByPoints = getPointDiscountAmount(memberPoints)
  const requestedDiscount = getPointDiscountAmount(pointsToUse)
  const rawDiscount = Math.min(maxDiscountByPoints, requestedDiscount)
  const maxDiscountByAmount = Math.floor(subtotal * 0.5)
  const discountAmount = Math.min(rawDiscount, maxDiscountByAmount)
  const finalPointsUsed = discountAmount * 100
  return { discountAmount, finalPointsUsed }
}

describe('order-service', () => {
  describe('roundMoney', () => {
    it('should round to 2 decimal places', () => {
      expect(roundMoney(10.126)).toBe(10.13)
      expect(roundMoney(10.124)).toBe(10.12)
      expect(roundMoney(10.125)).toBe(10.13)
    })

    it('should handle integers', () => {
      expect(roundMoney(10)).toBe(10)
      expect(roundMoney(0)).toBe(0)
    })

    it('should handle floating point precision', () => {
      expect(roundMoney(0.1 + 0.2)).toBe(0.3)
    })
  })

  describe('getEffectiveUnitPrice', () => {
    it('should return member price when memberId present and memberPrice set', () => {
      const product = { price: 100, memberPrice: 80 }
      expect(getEffectiveUnitPrice(product, 'user-1')).toBe(80)
    })

    it('should return regular price when no memberId', () => {
      const product = { price: 100, memberPrice: 80 }
      expect(getEffectiveUnitPrice(product)).toBe(100)
      expect(getEffectiveUnitPrice(product, undefined)).toBe(100)
    })

    it('should return regular price when memberPrice is null', () => {
      const product = { price: 100, memberPrice: null }
      expect(getEffectiveUnitPrice(product, 'user-1')).toBe(100)
    })

    it('should handle zero prices', () => {
      const product = { price: 0, memberPrice: 0 }
      expect(getEffectiveUnitPrice(product, 'user-1')).toBe(0)
    })
  })

  describe('calculateOrderDiscount', () => {
    it('should calculate discount correctly with enough points', () => {
      const result = calculateOrderDiscount(100, 500, 500)
      expect(result.discountAmount).toBe(5)
      expect(result.finalPointsUsed).toBe(500)
    })

    it('should cap discount at 50% of subtotal', () => {
      const result = calculateOrderDiscount(10, 1000, 1000)
      expect(result.discountAmount).toBe(5)
      expect(result.finalPointsUsed).toBe(500)
    })

    it('should limit by available points', () => {
      const result = calculateOrderDiscount(100, 200, 500)
      expect(result.discountAmount).toBe(2)
      expect(result.finalPointsUsed).toBe(200)
    })

    it('should return 0 when no points', () => {
      const result = calculateOrderDiscount(100, 0, 500)
      expect(result.discountAmount).toBe(0)
      expect(result.finalPointsUsed).toBe(0)
    })

    it('should handle pointsToUse less than available', () => {
      const result = calculateOrderDiscount(100, 1000, 200)
      expect(result.discountAmount).toBe(2)
      expect(result.finalPointsUsed).toBe(200)
    })
  })
})
