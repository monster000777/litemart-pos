import { defineStore } from 'pinia'
import { authService } from '../services'
import type { AuthUser } from '../types'
import { clearAuthToken, setAuthToken } from '../utils/request'

type AuthState = {
  authenticated: boolean
  role: string
  user: AuthUser | null
  ready: boolean
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    authenticated: false,
    role: '',
    user: null,
    ready: false
  }),
  actions: {
    async bootstrap() {
      try {
        const session = await authService.getSession()
        this.authenticated = session.authenticated
        this.role = session.actualRole || session.role || ''
        this.user = session.user || null
      } catch {
        this.authenticated = false
        this.role = ''
        this.user = null
      } finally {
        this.ready = true
      }
    },
    applyLogin(payload: { token: string; role: string; user: AuthUser }) {
      setAuthToken(payload.token)
      this.authenticated = true
      this.role = payload.role
      this.user = payload.user
      this.ready = true
    },
    logoutLocal() {
      clearAuthToken()
      this.authenticated = false
      this.role = ''
      this.user = null
      this.ready = true
    }
  }
})
