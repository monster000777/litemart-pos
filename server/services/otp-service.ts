type OtpRecord = {
  code: string
  expiresAt: number
}

// In-memory store for mock OTPs. In a real app, this would use Redis or DB.
const otpStore = new Map<string, OtpRecord>()

export const generateMockOtp = async (phone: string): Promise<string> => {
  // Generate a random 6-digit code. In this mock, we can just use "123456" or a random number.
  // We'll use a fixed mock code "123456" for easier testing, or generate a random one and return it
  // so the caller can mock sending it (e.g. by printing to console or returning in dev mode).

  // Actually, let's create a random 6-digit code.
  const code = Math.floor(100000 + Math.random() * 900000).toString()

  // Expires in 5 minutes
  const expiresAt = Date.now() + 5 * 60 * 1000

  otpStore.set(phone, { code, expiresAt })

  // In a real scenario, you'd call SMS provider here.
  console.log(`[MOCK SMS] Sending OTP ${code} to phone ${phone}`)

  return code
}

export const verifyOtp = (phone: string, code: string): boolean => {
  const record = otpStore.get(phone)

  if (!record) return false

  if (Date.now() > record.expiresAt) {
    otpStore.delete(phone)
    return false
  }

  if (record.code !== code) {
    return false
  }

  // Verification successful, remove OTP to prevent reuse
  otpStore.delete(phone)
  return true
}
