import { createError } from 'h3'
import { findAuthUserById } from '~~/server/services/auth-user-service'
import { isUserRole, USER_ROLES, roleHasAtLeast, type UserRole } from '~~/shared/constants/rbac'

const isReadMethod = (method: string) => method === 'GET' || method === 'HEAD'

export const getCurrentAuthContext = async (session: { uid: string; vrole?: UserRole }) => {
  const user = await findAuthUserById(session.uid)
  if (!user || user.status !== 'ACTIVE') {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: '登录状态已失效'
    })
  }

  const role =
    user.role === USER_ROLES.ADMIN && session.vrole && isUserRole(session.vrole)
      ? session.vrole
      : user.role

  return {
    user,
    role
  }
}

export const canAccessApiRoute = (role: UserRole, pathname: string, method: string) => {
  if (pathname.startsWith('/api/auth/users')) {
    return roleHasAtLeast(role, USER_ROLES.ADMIN)
  }

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

  if (pathname.startsWith('/api/customers')) {
    if (pathname === '/api/customers/lookup') {
      return isReadMethod(method)
    }
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
