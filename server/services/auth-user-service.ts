import { prisma } from '~~/server/lib/prisma'
import { getAuthConfig } from '~~/server/services/auth-config-service'
import { verifyPin } from '~~/server/services/auth-service'
import { USER_ROLES, normalizeUserRole, type UserRole } from '~~/shared/constants/rbac'

type AuthUserRow = {
  id: string
  name: string
  pinHash: string
  role: string
  status: string
}

export type AuthUserRecord = {
  id: string
  name: string
  pinHash: string
  role: UserRole
  status: string
}

export const AUTH_USER_STATUS = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE'
} as const

export type AuthUserStatus = (typeof AUTH_USER_STATUS)[keyof typeof AUTH_USER_STATUS]

export const isAuthUserStatus = (value: unknown): value is AuthUserStatus =>
  value === AUTH_USER_STATUS.ACTIVE || value === AUTH_USER_STATUS.INACTIVE

const toAuthUserRecord = (row: AuthUserRow): AuthUserRecord => ({
  id: row.id,
  name: row.name,
  pinHash: row.pinHash,
  role: normalizeUserRole(row.role),
  status: row.status
})

export const listAuthUsers = async () => {
  const users = await prisma.$queryRaw<AuthUserRow[]>`
    SELECT "id", "name", "pinHash", "role", "status"
    FROM "AuthUser"
    ORDER BY "createdAt" ASC
  `

  return users.map(toAuthUserRecord)
}

export const countAuthUsers = async () => {
  const rows = await prisma.$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(*) AS count FROM "AuthUser"
  `

  return Number(rows[0]?.count ?? 0)
}

export const findAuthUserById = async (id: string) => {
  const rows = await prisma.$queryRaw<AuthUserRow[]>`
    SELECT "id", "name", "pinHash", "role", "status"
    FROM "AuthUser"
    WHERE "id" = ${id}
    LIMIT 1
  `

  const row = rows[0]
  return row ? toAuthUserRecord(row) : null
}

export const createAuthUser = async (input: { name: string; pinHash: string; role: UserRole }) => {
  const id = crypto.randomUUID()
  await prisma.$executeRaw`
    INSERT INTO "AuthUser" ("id", "name", "pinHash", "role", "status", "createdAt", "updatedAt")
    VALUES (${id}, ${input.name}, ${input.pinHash}, ${input.role}, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `
  return id
}

export const countActiveAdminUsers = async () => {
  const rows = await prisma.$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(*) AS count
    FROM "AuthUser"
    WHERE "role" = ${USER_ROLES.ADMIN} AND "status" = ${AUTH_USER_STATUS.ACTIVE}
  `

  return Number(rows[0]?.count ?? 0)
}

export const updateAuthUser = async (
  userId: string,
  input: { name?: string; role?: UserRole; status?: AuthUserStatus }
) => {
  const updates: string[] = []
  const values: Array<string> = []

  if (input.name !== undefined) {
    updates.push(`"name" = ?`)
    values.push(input.name)
  }

  if (input.role !== undefined) {
    updates.push(`"role" = ?`)
    values.push(input.role)
  }

  if (input.status !== undefined) {
    updates.push(`"status" = ?`)
    values.push(input.status)
  }

  if (!updates.length) {
    return
  }

  updates.push(`"updatedAt" = CURRENT_TIMESTAMP`)

  await prisma.$executeRawUnsafe(
    `UPDATE "AuthUser" SET ${updates.join(', ')} WHERE "id" = ?`,
    ...values,
    userId
  )
}

export const updateAuthUserPin = async (userId: string, hashedPin: string) => {
  await prisma.$executeRaw`
    UPDATE "AuthUser"
    SET "pinHash" = ${hashedPin}, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${userId}
  `
}

export const ensureLegacyAdminUserMigrated = async () => {
  const userCount = await countAuthUsers()
  if (userCount > 0) {
    return
  }

  const legacy = await getAuthConfig()
  if (!legacy) {
    return
  }

  await createAuthUser({
    name: '管理员',
    pinHash: legacy.adminPin,
    role: USER_ROLES.ADMIN
  })
}

export const findAuthUserByPin = async (pin: string) => {
  await ensureLegacyAdminUserMigrated()

  const users = await listAuthUsers()
  for (const user of users) {
    if (user.status !== AUTH_USER_STATUS.ACTIVE) {
      continue
    }

    if (await verifyPin(pin, user.pinHash)) {
      return user
    }
  }

  return null
}

export const isPinInUse = async (pin: string, options?: { excludeUserId?: string }) => {
  await ensureLegacyAdminUserMigrated()

  const users = await listAuthUsers()
  for (const user of users) {
    if (options?.excludeUserId && user.id === options.excludeUserId) {
      continue
    }

    if (await verifyPin(pin, user.pinHash)) {
      return true
    }
  }

  return false
}
