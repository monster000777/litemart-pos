import { prisma } from '~~/server/lib/prisma'
import { AUTH_CONFIG_ID } from '~~/shared/constants/auth'
import { DEFAULT_USER_ROLE, normalizeUserRole, type UserRole } from '~~/shared/constants/rbac'

export type AuthConfigRow = {
  id: string
  adminPin: string
  role: UserRole
}

export const getAuthConfig = async () => {
  const rows = await prisma.$queryRaw<AuthConfigRow[]>`
    SELECT "id", "adminPin", COALESCE("role", ${DEFAULT_USER_ROLE}) AS "role"
    FROM "Config"
    WHERE "id" = ${AUTH_CONFIG_ID}
    LIMIT 1
  `
  const row = rows[0]
  if (!row) {
    return null
  }

  return {
    ...row,
    role: row.role == null ? DEFAULT_USER_ROLE : normalizeUserRole(row.role)
  }
}

export const createAuthConfigIfMissing = async (
  hashedPin: string,
  role: UserRole = DEFAULT_USER_ROLE
) => {
  await prisma.$executeRaw`
    INSERT OR IGNORE INTO "Config" ("id", "adminPin", "role", "createdAt", "updatedAt")
    VALUES (${AUTH_CONFIG_ID}, ${hashedPin}, ${role}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `
}

export const updateAuthConfig = async (hashedPin: string) => {
  await prisma.$executeRaw`
    UPDATE "Config"
    SET "adminPin" = ${hashedPin}, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${AUTH_CONFIG_ID}
  `
}

export const updateAuthRole = async (role: UserRole) => {
  await prisma.$executeRaw`
    UPDATE "Config"
    SET "role" = ${role}, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${AUTH_CONFIG_ID}
  `
}
