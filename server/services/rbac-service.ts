import { createError } from 'h3'
import { getAuthConfig } from '~~/server/services/auth-config-service'
import { USER_ROLES, roleHasAtLeast, type UserRole } from '~~/shared/constants/rbac'

const isReadMethod = (method: string) => method === 'GET' || method === 'HEAD'

export const getCurrentUserRole = async (): Promise<UserRole> => {
  const authConfig = await getAuthConfig()
  return authConfig?.role ?? USER_ROLES.ADMIN
}

export const canAccessApiRoute = (role: UserRole, pathname: string, method: string) => {
  if (pathname.startsWith('/api/auth/')) {
    return true
  }

  if (pathname === '/api/orders/checkout') {
    return true
  }

  if (pathname.startsWith('/api/orders')) {
    if (pathname.endsWith('/refund')) {
      return roleHasAtLeast(role, USER_ROLES.MANAGER)
    }
    return isReadMethod(method)
  }

  if (pathname.startsWith('/api/products/alerts')) {
    return true
  }

  if (pathname.startsWith('/api/products')) {
    return isReadMethod(method) || roleHasAtLeast(role, USER_ROLES.MANAGER)
  }

  if (pathname.startsWith('/api/upload')) {
    return roleHasAtLeast(role, USER_ROLES.MANAGER)
  }

  if (pathname.startsWith('/api/suppliers') || pathname.startsWith('/api/purchase-orders')) {
    return roleHasAtLeast(role, USER_ROLES.MANAGER)
  }

  if (pathname.startsWith('/api/insights')) {
    return roleHasAtLeast(role, USER_ROLES.MANAGER)
  }

  if (pathname.startsWith('/api/audit-logs')) {
    return roleHasAtLeast(role, USER_ROLES.ADMIN)
  }

  return roleHasAtLeast(role, USER_ROLES.ADMIN)
}

export const assertApiRouteAccess = (role: UserRole, pathname: string, method: string) => {
  if (canAccessApiRoute(role, pathname, method)) {
    return
  }

  throw createError({
    statusCode: 403,
    statusMessage: 'Forbidden',
    message: '当前角色无权执行该操作'
  })
}
