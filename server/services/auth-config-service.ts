import { prisma } from '~~/server/lib/prisma'
import { AUTH_CONFIG_ID } from '~~/shared/constants/auth'
import { DEFAULT_USER_ROLE, normalizeUserRole, type UserRole } from '~~/shared/constants/rbac'

export type AuthConfigRow = {
  id: string
  adminPin: string
  role: UserRole
  inviteCode: string | null
}

export const getAuthConfig = async () => {
  const rows = await prisma.$queryRaw<AuthConfigRow[]>`
    SELECT "id", "adminPin", COALESCE("role", ${DEFAULT_USER_ROLE}) AS "role", "inviteCode"
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
    role: normalizeUserRole(row.role)
  }
}

export const createAuthConfigIfMissing = async (
  hashedPin: string,
  role: UserRole = DEFAULT_USER_ROLE,
  inviteCode: string | null = null
) => {
  await prisma.$executeRaw`
    INSERT OR IGNORE INTO "Config" ("id", "adminPin", "role", "inviteCode", "createdAt", "updatedAt")
    VALUES (${AUTH_CONFIG_ID}, ${hashedPin}, ${role}, ${inviteCode}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `
}

export const updateInviteCode = async (inviteCode: string) => {
  await prisma.$executeRaw`
    UPDATE "Config"
    SET "inviteCode" = ${inviteCode}, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${AUTH_CONFIG_ID}
  `
}
