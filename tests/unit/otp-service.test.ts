import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { generateMockOtp, verifyOtp } from '../../server/services/otp-service'

describe('otp-service', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('should generate a 6-digit OTP code', async () => {
    const phone = '13800138000'
    const code = await generateMockOtp(phone)
    expect(code).toMatch(/^\d{6}$/)
  })

  it('should verify correct OTP', async () => {
    const phone = '13800138000'
    const code = await generateMockOtp(phone)
    expect(verifyOtp(phone, code)).toBe(true)
  })

  it('should fail with incorrect OTP', async () => {
    const phone = '13800138000'
    await generateMockOtp(phone)
    expect(verifyOtp(phone, '000000')).toBe(false)
  })

  it('should fail if OTP does not exist for phone', () => {
    expect(verifyOtp('13800138001', '123456')).toBe(false)
  })

  it('should invalidate OTP after first successful verification (one-time use)', async () => {
    const phone = '13800138002'
    const code = await generateMockOtp(phone)

    // First verification should pass
    expect(verifyOtp(phone, code)).toBe(true)

    // Second verification should fail
    expect(verifyOtp(phone, code)).toBe(false)
  })

  it('should expire OTP after 5 minutes', async () => {
    const phone = '13800138003'
    const code = await generateMockOtp(phone)

    // Fast forward 5 minutes and 1 second
    vi.advanceTimersByTime(5 * 60 * 1000 + 1000)

    expect(verifyOtp(phone, code)).toBe(false)
  })
})
