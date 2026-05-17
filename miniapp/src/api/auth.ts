import type { LoginPayload, LoginResponse, SessionPayload } from '../types'
import { request } from '../utils/request'

export const login = (payload: LoginPayload) =>
  request<LoginResponse>({
    url: '/api/auth/login',
    method: 'POST',
    data: payload
  })

export const logout = () =>
  request<{ success: boolean }>({
    url: '/api/auth/logout',
    method: 'POST'
  })

export const getSession = () =>
  request<SessionPayload>({
    url: '/api/auth/session'
  })
