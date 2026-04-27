import { prisma } from '~~/server/lib/prisma'

const globalForSchemaBootstrap = globalThis as unknown as {
  schemaBootstrapPromise?: Promise<void>
}

const isDuplicateColumnError = (error: unknown) => {
  const message = (error as { message?: string } | null)?.message ?? ''
  return message.includes('duplicate column name') && message.includes('image')
}

const bootstrapSchema = async () => {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Product" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "sku" TEXT NOT NULL,
      "price" DECIMAL NOT NULL,
      "stock" INTEGER NOT NULL DEFAULT 0,
      "category" TEXT NOT NULL,
      "minStock" INTEGER NOT NULL DEFAULT 0,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "Product_sku_key" ON "Product"("sku")
  `)

  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Product" ADD COLUMN "image" TEXT
    `)
  } catch (error) {
    if (!isDuplicateColumnError(error)) {
      throw error
    }
  }

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Order" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "orderNo" TEXT NOT NULL,
      "totalAmount" DECIMAL NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'COMPLETED',
      "customerTail" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "Order_orderNo_key" ON "Order"("orderNo")
  `)

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "OrderItem" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "orderId" TEXT NOT NULL,
      "productId" TEXT NOT NULL,
      "quantity" INTEGER NOT NULL,
      "unitPrice" DECIMAL NOT NULL,
      CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
    )
  `)

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "OrderItem_orderId_idx" ON "OrderItem"("orderId")
  `)

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "OrderItem_productId_idx" ON "OrderItem"("productId")
  `)

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Config" (
      "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
      "adminPin" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)
}

export const ensureSchemaBootstrapped = () => {
  if (!globalForSchemaBootstrap.schemaBootstrapPromise) {
    globalForSchemaBootstrap.schemaBootstrapPromise = bootstrapSchema().catch((error) => {
      globalForSchemaBootstrap.schemaBootstrapPromise = undefined
      throw error
    })
  }
  return globalForSchemaBootstrap.schemaBootstrapPromise
}
