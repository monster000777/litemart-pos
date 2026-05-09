import type { UserRole } from '~~/shared/constants/rbac'

export type AuthUserDto = {
  id: string
  name: string
  role: UserRole
  status: string
}

export type AuthUserListResponse = {
  currentUserId: string
  users: AuthUserDto[]
}
