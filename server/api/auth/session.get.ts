export default defineEventHandler((event) => {
  const role = event.context.auth?.role

  return {
    authenticated: true,
    role
  }
})
