import { describe, it, expect } from 'vitest'

const CUSTOMER_LEVELS = {
  NORMAL: 'NORMAL',
  SILVER: 'SILVER',
  GOLD: 'GOLD'
} as const

const isCustomerLevel = (value: string) => Object.values(CUSTOMER_LEVELS).includes(value as never)

const getPointDiscountAmount = (points: number) => Math.floor(points / 100)

const getEarnedPoints = (amount: number) => Math.max(0, Math.floor(amount))

const normalizePhone = (phone: string) => phone.replace(/\D/g, '')

const PHONE_PATTERN = /^1\d{10}$/

const isValidPhone = (phone: string) => PHONE_PATTERN.test(normalizePhone(phone))

describe('customer-service', () => {
  describe('isCustomerLevel', () => {
    it('should return true for valid levels', () => {
      expect(isCustomerLevel('NORMAL')).toBe(true)
      expect(isCustomerLevel('SILVER')).toBe(true)
      expect(isCustomerLevel('GOLD')).toBe(true)
    })

    it('should return false for invalid levels', () => {
      expect(isCustomerLevel('PLATINUM')).toBe(false)
      expect(isCustomerLevel('')).toBe(false)
      expect(isCustomerLevel('normal')).toBe(false)
    })
  })

  describe('getPointDiscountAmount', () => {
    it('should calculate discount correctly', () => {
      expect(getPointDiscountAmount(100)).toBe(1)
      expect(getPointDiscountAmount(500)).toBe(5)
      expect(getPointDiscountAmount(1000)).toBe(10)
    })

    it('should floor to integer', () => {
      expect(getPointDiscountAmount(150)).toBe(1)
      expect(getPointDiscountAmount(199)).toBe(1)
    })

    it('should return 0 for less than 100 points', () => {
      expect(getPointDiscountAmount(99)).toBe(0)
      expect(getPointDiscountAmount(0)).toBe(0)
    })
  })

  describe('getEarnedPoints', () => {
    it('should return amount as integer', () => {
      expect(getEarnedPoints(100)).toBe(100)
      expect(getEarnedPoints(50)).toBe(50)
    })

    it('should floor decimal amounts', () => {
      expect(getEarnedPoints(99.9)).toBe(99)
      expect(getEarnedPoints(50.5)).toBe(50)
    })

    it('should return 0 for negative amounts', () => {
      expect(getEarnedPoints(-10)).toBe(0)
      expect(getEarnedPoints(0)).toBe(0)
    })
  })

  describe('normalizePhone', () => {
    it('should remove non-digit characters', () => {
      expect(normalizePhone('138-0013-8000')).toBe('13800138000')
      expect(normalizePhone('138 0013 8000')).toBe('13800138000')
      expect(normalizePhone('+8613800138000')).toBe('8613800138000')
    })

    it('should keep digits unchanged', () => {
      expect(normalizePhone('13800138000')).toBe('13800138000')
    })
  })

  describe('isValidPhone', () => {
    it('should validate correct phone numbers', () => {
      expect(isValidPhone('13800138000')).toBe(true)
      expect(isValidPhone('15900001111')).toBe(true)
      expect(isValidPhone('18888888888')).toBe(true)
    })

    it('should reject invalid phone numbers', () => {
      expect(isValidPhone('23456789012')).toBe(false)
      expect(isValidPhone('1380013800')).toBe(false)
      expect(isValidPhone('138001380001')).toBe(false)
      expect(isValidPhone('')).toBe(false)
    })

    it('should handle phones with formatting', () => {
      expect(isValidPhone('138-0013-8000')).toBe(true)
      expect(isValidPhone('138 0013 8000')).toBe(true)
    })
  })
})
