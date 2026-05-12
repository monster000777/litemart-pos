import { describe, it, expect } from 'vitest'

const USER_ROLES = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  CASHIER: 'CASHIER'
} as const

type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES]

const roleHasAtLeast = (role: UserRole | null | undefined, required: UserRole) => {
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

const isReadMethod = (method: string) => method === 'GET' || method === 'HEAD'

const canAccessApiRoute = (role: UserRole, pathname: string, method: string) => {
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

describe('rbac-service', () => {
  describe('roleHasAtLeast', () => {
    it('should return true when role meets requirement', () => {
      expect(roleHasAtLeast('ADMIN', 'ADMIN')).toBe(true)
      expect(roleHasAtLeast('ADMIN', 'MANAGER')).toBe(true)
      expect(roleHasAtLeast('ADMIN', 'CASHIER')).toBe(true)
      expect(roleHasAtLeast('MANAGER', 'MANAGER')).toBe(true)
      expect(roleHasAtLeast('MANAGER', 'CASHIER')).toBe(true)
      expect(roleHasAtLeast('CASHIER', 'CASHIER')).toBe(true)
    })

    it('should return false when role is lower than requirement', () => {
      expect(roleHasAtLeast('CASHIER', 'MANAGER')).toBe(false)
      expect(roleHasAtLeast('CASHIER', 'ADMIN')).toBe(false)
      expect(roleHasAtLeast('MANAGER', 'ADMIN')).toBe(false)
    })

    it('should return false for null/undefined role', () => {
      expect(roleHasAtLeast(null, 'CASHIER')).toBe(false)
      expect(roleHasAtLeast(undefined, 'CASHIER')).toBe(false)
    })
  })

  describe('canAccessApiRoute', () => {
    describe('auth routes', () => {
      it('should allow all roles for public auth routes', () => {
        const publicPaths = ['/api/auth/login', '/api/auth/register', '/api/auth/status']
        for (const path of publicPaths) {
          expect(canAccessApiRoute('CASHIER', path, 'POST')).toBe(true)
          expect(canAccessApiRoute('MANAGER', path, 'POST')).toBe(true)
          expect(canAccessApiRoute('ADMIN', path, 'POST')).toBe(true)
        }
      })

      it('should restrict /api/auth/users to ADMIN', () => {
        expect(canAccessApiRoute('ADMIN', '/api/auth/users', 'GET')).toBe(true)
        expect(canAccessApiRoute('MANAGER', '/api/auth/users', 'GET')).toBe(false)
        expect(canAccessApiRoute('CASHIER', '/api/auth/users', 'GET')).toBe(false)
      })
    })

    describe('orders routes', () => {
      it('should allow all roles for checkout', () => {
        expect(canAccessApiRoute('CASHIER', '/api/orders/checkout', 'POST')).toBe(true)
        expect(canAccessApiRoute('MANAGER', '/api/orders/checkout', 'POST')).toBe(true)
        expect(canAccessApiRoute('ADMIN', '/api/orders/checkout', 'POST')).toBe(true)
      })

      it('should allow all roles for order listing (GET)', () => {
        expect(canAccessApiRoute('CASHIER', '/api/orders', 'GET')).toBe(true)
        expect(canAccessApiRoute('MANAGER', '/api/orders', 'GET')).toBe(true)
      })

      it('should restrict refund to MANAGER+', () => {
        expect(canAccessApiRoute('CASHIER', '/api/orders/123/refund', 'POST')).toBe(false)
        expect(canAccessApiRoute('MANAGER', '/api/orders/123/refund', 'POST')).toBe(true)
        expect(canAccessApiRoute('ADMIN', '/api/orders/123/refund', 'POST')).toBe(true)
      })
    })

    describe('products routes', () => {
      it('should allow all roles for alerts', () => {
        expect(canAccessApiRoute('CASHIER', '/api/products/alerts', 'GET')).toBe(true)
      })

      it('should allow all roles for product listing (GET)', () => {
        expect(canAccessApiRoute('CASHIER', '/api/products', 'GET')).toBe(true)
      })

      it('should restrict product creation to MANAGER+', () => {
        expect(canAccessApiRoute('CASHIER', '/api/products', 'POST')).toBe(false)
        expect(canAccessApiRoute('MANAGER', '/api/products', 'POST')).toBe(true)
        expect(canAccessApiRoute('ADMIN', '/api/products', 'POST')).toBe(true)
      })
    })

    describe('customers routes', () => {
      it('should allow GET for /api/customers/lookup', () => {
        expect(canAccessApiRoute('CASHIER', '/api/customers/lookup', 'GET')).toBe(true)
        expect(canAccessApiRoute('MANAGER', '/api/customers/lookup', 'GET')).toBe(true)
      })

      it('should restrict POST for /api/customers/lookup', () => {
        expect(canAccessApiRoute('CASHIER', '/api/customers/lookup', 'POST')).toBe(false)
      })

      it('should restrict customer management to MANAGER+', () => {
        expect(canAccessApiRoute('CASHIER', '/api/customers', 'GET')).toBe(false)
        expect(canAccessApiRoute('MANAGER', '/api/customers', 'GET')).toBe(true)
        expect(canAccessApiRoute('ADMIN', '/api/customers', 'GET')).toBe(true)
      })
    })

    describe('admin routes', () => {
      it('should restrict audit-logs to ADMIN', () => {
        expect(canAccessApiRoute('CASHIER', '/api/audit-logs', 'GET')).toBe(false)
        expect(canAccessApiRoute('MANAGER', '/api/audit-logs', 'GET')).toBe(false)
        expect(canAccessApiRoute('ADMIN', '/api/audit-logs', 'GET')).toBe(true)
      })
    })
  })
})
