import type { PrismaClient } from '@prisma/client'
import pkg from '@prisma/client'
const { PrismaClient: PrismaClientConstructor } = pkg

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
}

const isTest = process.env.NODE_ENV === 'test'
const dbUrl = isTest
? process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || 'file:./test.db'
: process.env.DATABASE_URL || 'file:./dev.db'

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClientConstructor({
    datasources: {
      db: {
        url: dbUrl
      }
    }
  })

if (import.meta.dev) {
  globalForPrisma.prisma = prisma
}
