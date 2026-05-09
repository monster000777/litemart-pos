export default defineEventHandler((event) => {
  const role = event.context.auth?.role
  const actualRole = event.context.auth?.user?.role

  return {
    authenticated: true,
    role,
    actualRole
  }
})
