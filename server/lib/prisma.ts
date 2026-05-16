import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
}

const isTest = process.env.NODE_ENV === 'test'
const dbUrl = isTest
  ? process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || 'file:./test.db'
  : process.env.DATABASE_URL || 'file:./dev.db'

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: dbUrl
      }
    }
  })

if (import.meta.dev) {
  globalForPrisma.prisma = prisma
}
