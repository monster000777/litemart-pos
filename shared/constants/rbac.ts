export const USER_ROLES = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  CASHIER: 'CASHIER'
} as const

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES]

export const ALL_USER_ROLES = Object.values(USER_ROLES) as UserRole[]

export const isUserRole = (value: unknown): value is UserRole =>
  typeof value === 'string' && ALL_USER_ROLES.includes(value as UserRole)

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: '管理员',
  MANAGER: '店长',
  CASHIER: '收银员'
}

export const DEFAULT_USER_ROLE: UserRole = USER_ROLES.ADMIN
export const LOWEST_USER_ROLE: UserRole = USER_ROLES.CASHIER

export const normalizeUserRole = (value: unknown): UserRole =>
  isUserRole(value) ? value : LOWEST_USER_ROLE

export const roleHasAtLeast = (role: UserRole | null | undefined, required: UserRole) => {
  const rank: Record<UserRole, number> = {
    CASHIER: 1,
    MANAGER: 2,
    ADMIN: 3
  }

  if (!role) {
    return false
  }

  return rank[role] >= rank[required]
}

export const canAccessAppPath = (role: UserRole | null | undefined, path: string) => {
  if (!role) {
    return false
  }

  if (path === '/' || path.startsWith('/orders') || path.startsWith('/settings')) {
    return true
  }

  if (
    path.startsWith('/inventory') ||
    path.startsWith('/suppliers') ||
    path.startsWith('/members') ||
    path.startsWith('/purchase-orders')
  ) {
    return roleHasAtLeast(role, USER_ROLES.MANAGER)
  }

  if (path.startsWith('/insights') || path.startsWith('/dashboard')) {
    return roleHasAtLeast(role, USER_ROLES.CASHIER)
  }

  if (path.startsWith('/ai')) {
    return roleHasAtLeast(role, USER_ROLES.MANAGER)
  }

  if (path.startsWith('/logs') || path.startsWith('/users')) {
    return roleHasAtLeast(role, USER_ROLES.ADMIN)
  }

  return roleHasAtLeast(role, USER_ROLES.ADMIN)
}
