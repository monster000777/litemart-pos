import { prisma } from '~~/server/lib/prisma'

const globalForSchemaBootstrap = globalThis as unknown as {
  schemaBootstrapPromise?: Promise<void>
}

const isDuplicateColumnError = (error: unknown, columnName?: string) => {
  const message = (error as { message?: string } | null)?.message ?? ''
  if (!message.includes('duplicate column name')) return false
  return columnName ? message.includes(columnName) : true
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
    if (!isDuplicateColumnError(error, 'image')) {
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

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AuditLog" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "action" TEXT NOT NULL,
      "detail" TEXT,
      "ip" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "AuditLog_action_idx" ON "AuditLog"("action")
  `)

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt")
  `)

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Supplier" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "contactName" TEXT,
      "phone" TEXT,
      "email" TEXT,
      "address" TEXT,
      "status" TEXT NOT NULL DEFAULT 'ACTIVE',
      "notes" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "Supplier_status_idx" ON "Supplier"("status")
  `)

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PurchaseOrder" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "orderNo" TEXT NOT NULL,
      "supplierId" TEXT NOT NULL,
      "totalAmount" DECIMAL NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'PENDING',
      "notes" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
    )
  `)

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "PurchaseOrder_orderNo_key" ON "PurchaseOrder"("orderNo")
  `)

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "PurchaseOrder_supplierId_idx" ON "PurchaseOrder"("supplierId")
  `)

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "PurchaseOrder_status_idx" ON "PurchaseOrder"("status")
  `)

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PurchaseItem" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "purchaseOrderId" TEXT NOT NULL,
      "productId" TEXT NOT NULL,
      "quantity" INTEGER NOT NULL,
      "unitCost" DECIMAL NOT NULL,
      CONSTRAINT "PurchaseItem_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "PurchaseItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
    )
  `)

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "PurchaseItem_purchaseOrderId_idx" ON "PurchaseItem"("purchaseOrderId")
  `)

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "PurchaseItem_productId_idx" ON "PurchaseItem"("productId")
  `)

  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Product" ADD COLUMN "costPrice" DECIMAL DEFAULT 0
    `)
  } catch (error) {
    if (!isDuplicateColumnError(error, 'costPrice')) {
      throw error
    }
  }

  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Product" ADD COLUMN "supplierId" TEXT
    `)
  } catch (error) {
    if (!isDuplicateColumnError(error, 'supplierId')) {
      throw error
    }
  }
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
