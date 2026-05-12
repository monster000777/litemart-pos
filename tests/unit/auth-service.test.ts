import { describe, it, expect } from 'vitest'

import {
  hashPin,
  verifyPin,
  createSessionToken,
  verifySessionToken,
  isValidPinFormat
} from '../../server/services/auth-service'

const encode = (value: string) => Buffer.from(value, 'utf8').toString('base64url')
const decode = (value: string) => Buffer.from(value, 'base64url').toString('utf8')

const createSessionPayload = (userId: string) => ({
  sid: 'test-sid',
  uid: userId,
  exp: Math.floor(Date.now() / 1000) + 3600
})

describe('auth-service', () => {
  describe('isValidPinFormat', () => {
    it('should accept valid 6-digit PINs', () => {
      expect(isValidPinFormat('123456')).toBe(true)
      expect(isValidPinFormat('000000')).toBe(true)
      expect(isValidPinFormat('999999')).toBe(true)
    })

    it('should reject non-6-digit inputs', () => {
      expect(isValidPinFormat('12345')).toBe(false)
      expect(isValidPinFormat('1234567')).toBe(false)
      expect(isValidPinFormat('')).toBe(false)
    })

    it('should reject non-numeric inputs', () => {
      expect(isValidPinFormat('abcdef')).toBe(false)
      expect(isValidPinFormat('12345a')).toBe(false)
      expect(isValidPinFormat('123 45')).toBe(false)
    })
  })

  describe('encode/decode', () => {
    it('should encode and decode correctly', () => {
      const original = 'Hello, World!'
      const encoded = encode(original)
      const decoded = decode(encoded)
      expect(decoded).toBe(original)
    })

    it('should handle JSON payloads', () => {
      const payload = { uid: 'user-123', exp: 1234567890 }
      const encoded = encode(JSON.stringify(payload))
      const decoded = JSON.parse(decode(encoded))
      expect(decoded).toEqual(payload)
    })

    it('should handle empty string', () => {
      expect(decode(encode(''))).toBe('')
    })

    it('should handle unicode', () => {
      const original = '你好世界'
      expect(decode(encode(original))).toBe(original)
    })
  })

  describe('session payload', () => {
    it('should create valid payload structure', () => {
      const payload = createSessionPayload('user-123')
      expect(payload).toHaveProperty('sid')
      expect(payload).toHaveProperty('uid', 'user-123')
      expect(payload).toHaveProperty('exp')
      expect(typeof payload.exp).toBe('number')
    })

    it('should have future expiration', () => {
      const payload = createSessionPayload('user-123')
      const now = Math.floor(Date.now() / 1000)
      expect(payload.exp).toBeGreaterThan(now)
    })
  })

  describe('PIN Hashing (hashPin & verifyPin)', () => {
    it('should hash PIN correctly', async () => {
      const pin = '123456'
      const hash = await hashPin(pin)
      expect(hash).toContain('scrypt$')
    })

    it('should verify correct PIN', async () => {
      const pin = '123456'
      const hash = await hashPin(pin)
      const isValid = await verifyPin(pin, hash)
      expect(isValid).toBe(true)
    })

    it('should reject incorrect PIN', async () => {
      const pin = '123456'
      const hash = await hashPin(pin)
      const isValid = await verifyPin('654321', hash)
      expect(isValid).toBe(false)
    })

    it('should reject invalid hash formats', async () => {
      const isValid = await verifyPin('123456', 'invalid-hash-string')
      expect(isValid).toBe(false)
    })
  })

  describe('Session Tokens (create & verify)', () => {
    const testSecret = 'super-secret-test-key'

    it('should create a valid session token', () => {
      const token = createSessionToken(testSecret, 'user-999')
      expect(token).toContain('.')
    })

    it('should verify a valid session token', () => {
      const token = createSessionToken(testSecret, 'user-999')
      const decodedPayload = verifySessionToken(token, testSecret)
      expect(decodedPayload).not.toBeNull()
      expect(decodedPayload?.uid).toBe('user-999')
    })

    it('should reject missing tokens', () => {
      expect(verifySessionToken(undefined, testSecret)).toBeNull()
      expect(verifySessionToken('', testSecret)).toBeNull()
    })

    it('should reject tokens customized with wrong secret', () => {
      const token = createSessionToken(testSecret, 'user-999')
      const result = verifySessionToken(token, 'wrong-secret')
      expect(result).toBeNull()
    })

    it('should reject tampered tokens', () => {
      const token = createSessionToken(testSecret, 'user-999')
      const [payload, sig] = token.split('.')

      // Tamper with payload
      const fakePayloadPayload = { ...JSON.parse(decode(payload)), uid: 'user-000' }
      const fakeToken = `${encode(JSON.stringify(fakePayloadPayload))}.${sig}`

      const result = verifySessionToken(fakeToken, testSecret)
      expect(result).toBeNull()
    })
  })
})
