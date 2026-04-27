import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { AUTH_MAX_AGE_SECONDS } from '~~/shared/constants/auth'

const scrypt = promisify(scryptCallback)

type SessionPayload = {
  sid: string
  exp: number
}

const PIN_HASH_PREFIX = 'scrypt'
const PIN_HASH_KEY_LEN = 64

const encode = (value: string) => Buffer.from(value, 'utf8').toString('base64url')
const decode = (value: string) => Buffer.from(value, 'base64url').toString('utf8')

const sign = (payload: string, secret: string) =>
  createHmac('sha256', secret).update(payload).digest('base64url')

export const hashPin = async (pin: string) => {
  const salt = randomBytes(16).toString('hex')
  const derived = (await scrypt(pin, salt, PIN_HASH_KEY_LEN)) as Buffer
  return `${PIN_HASH_PREFIX}$${salt}$${derived.toString('hex')}`
}

export const verifyPin = async (pin: string, hash: string) => {
  const [prefix, salt, storedHash] = hash.split('$')
  if (prefix !== PIN_HASH_PREFIX || !salt || !storedHash) {
    return false
  }

  const derived = (await scrypt(pin, salt, PIN_HASH_KEY_LEN)) as Buffer
  const actual = Buffer.from(storedHash, 'hex')
  if (derived.length !== actual.length) {
    return false
  }

  return timingSafeEqual(derived, actual)
}

export const createSessionToken = (secret: string) => {
  const payload: SessionPayload = {
    sid: randomBytes(24).toString('base64url'),
    exp: Math.floor(Date.now() / 1000) + AUTH_MAX_AGE_SECONDS
  }

  const encodedPayload = encode(JSON.stringify(payload))
  const signature = sign(encodedPayload, secret)
  return `${encodedPayload}.${signature}`
}

export const verifySessionToken = (token: string | undefined, secret: string) => {
  if (!token) {
    return null
  }

  const [encodedPayload, incomingSignature] = token.split('.')
  if (!encodedPayload || !incomingSignature) {
    return null
  }

  const expectedSignature = sign(encodedPayload, secret)
  const incoming = Buffer.from(incomingSignature)
  const expected = Buffer.from(expectedSignature)
  if (incoming.length !== expected.length || !timingSafeEqual(incoming, expected)) {
    return null
  }

  try {
    const payload = JSON.parse(decode(encodedPayload)) as SessionPayload
    if (typeof payload.exp !== 'number' || typeof payload.sid !== 'string') {
      return null
    }
    if (payload.exp <= Math.floor(Date.now() / 1000)) {
      return null
    }
    return payload
  } catch {
    return null
  }
}

export const isValidPinFormat = (pin: string) => /^\d{6}$/.test(pin)
