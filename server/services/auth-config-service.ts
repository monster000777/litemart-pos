import { prisma } from '~~/server/lib/prisma'
import { AUTH_CONFIG_ID } from '~~/shared/constants/auth'

export type AuthConfigRow = {
  id: string
  adminPin: string
}

export const getAuthConfig = async () => {
  const rows = await prisma.$queryRaw<AuthConfigRow[]>`
    SELECT "id", "adminPin"
    FROM "Config"
    WHERE "id" = ${AUTH_CONFIG_ID}
    LIMIT 1
  `
  return rows[0] ?? null
}

export const createAuthConfigIfMissing = async (hashedPin: string) => {
  await prisma.$executeRaw`
    INSERT OR IGNORE INTO "Config" ("id", "adminPin", "createdAt", "updatedAt")
    VALUES (${AUTH_CONFIG_ID}, ${hashedPin}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `
}
