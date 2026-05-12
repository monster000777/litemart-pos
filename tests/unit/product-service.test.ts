import { describe, it, expect } from 'vitest'

const REMOTE_IMAGE_PATTERN = /^https?:\/\/[^\s]+$/i
const LOCAL_UPLOAD_PREFIX = '/uploads/'

const parseProductImage = (value: unknown, options?: { allowUndefined?: boolean }) => {
  if (value === undefined) {
    return options?.allowUndefined ? undefined : null
  }

  if (value === null) {
    return null
  }

  if (typeof value !== 'string') {
    throw new Error('商品图片格式错误')
  }

  const image = value.trim()
  if (!image) {
    return null
  }

  if (image.startsWith(LOCAL_UPLOAD_PREFIX) || REMOTE_IMAGE_PATTERN.test(image)) {
    return image
  }

  throw new Error('商品图片地址不合法')
}

const toProductResponse = (product: {
  id: string
  name: string
  sku: string
  image: string | null
  category: string
  price: number | { toString(): string }
  memberPrice: number | { toString(): string } | null
  stock: number
  minStock: number
  createdAt: Date
}) => ({
  id: product.id,
  name: product.name,
  sku: product.sku,
  image: product.image,
  category: product.category,
  price: Number(product.price),
  memberPrice: product.memberPrice == null ? null : Number(product.memberPrice),
  stock: product.stock,
  minStock: product.minStock,
  createdAt: product.createdAt
})

describe('product-service', () => {
  describe('parseProductImage', () => {
    it('should return null for null input', () => {
      expect(parseProductImage(null)).toBe(null)
    })

    it('should return null for empty string', () => {
      expect(parseProductImage('')).toBe(null)
      expect(parseProductImage('   ')).toBe(null)
    })

    it('should return undefined when allowUndefined is true', () => {
      expect(parseProductImage(undefined, { allowUndefined: true })).toBe(undefined)
    })

    it('should return null for undefined without allowUndefined', () => {
      expect(parseProductImage(undefined)).toBe(null)
    })

    it('should accept valid remote URLs', () => {
      expect(parseProductImage('https://example.com/image.jpg')).toBe(
        'https://example.com/image.jpg'
      )
      expect(parseProductImage('http://example.com/image.png')).toBe('http://example.com/image.png')
    })

    it('should accept local upload paths', () => {
      expect(parseProductImage('/uploads/image.jpg')).toBe('/uploads/image.jpg')
    })

    it('should reject invalid URLs', () => {
      expect(() => parseProductImage('ftp://example.com/image.jpg')).toThrow('商品图片地址不合法')
      expect(() => parseProductImage('not-a-url')).toThrow('商品图片地址不合法')
    })

    it('should reject non-string types', () => {
      expect(() => parseProductImage(123)).toThrow('商品图片格式错误')
      expect(() => parseProductImage(true)).toThrow('商品图片格式错误')
    })
  })

  describe('toProductResponse', () => {
    it('should convert product to response format', () => {
      const product = {
        id: '1',
        name: 'Test Product',
        sku: 'TEST-001',
        image: null,
        category: 'Test',
        price: 100,
        memberPrice: 80,
        stock: 10,
        minStock: 5,
        createdAt: new Date('2024-01-01')
      }

      const result = toProductResponse(product)
      expect(result.price).toBe(100)
      expect(result.memberPrice).toBe(80)
      expect(result.stock).toBe(10)
    })

    it('should handle null memberPrice', () => {
      const product = {
        id: '1',
        name: 'Test',
        sku: 'TEST',
        image: null,
        category: 'Test',
        price: 100,
        memberPrice: null,
        stock: 10,
        minStock: 5,
        createdAt: new Date()
      }

      const result = toProductResponse(product)
      expect(result.memberPrice).toBe(null)
    })

    it('should convert Decimal-like values to numbers', () => {
      const product = {
        id: '1',
        name: 'Test',
        sku: 'TEST',
        image: null,
        category: 'Test',
        price: { toString: () => '99.99' },
        memberPrice: { toString: () => '79.99' },
        stock: 10,
        minStock: 5,
        createdAt: new Date()
      }

      const result = toProductResponse(product)
      expect(result.price).toBe(99.99)
      expect(result.memberPrice).toBe(79.99)
    })
  })
})
