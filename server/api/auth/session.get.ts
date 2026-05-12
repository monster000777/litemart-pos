export default defineEventHandler((event) => {
  const role = event.context.auth?.role
  const actualRole = event.context.auth?.user?.role
  const user = event.context.auth?.user

  return {
    authenticated: true,
    role,
    actualRole,
    user: user
      ? {
          uid: user.uid,
          phone: user.phone
        }
      : undefined
  }
})
