import { AUTH_COOKIE_NAME } from '~~/shared/constants/auth'

export default defineEventHandler((event) => {
  deleteCookie(event, AUTH_COOKIE_NAME, {
    path: '/'
  })

  return {
    success: true
  }
})
