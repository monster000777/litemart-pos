import { Prisma } from '@prisma/client'
import { createError } from 'h3'
import { prisma } from '~~/server/lib/prisma'

export const CUSTOMER_LEVELS = {
  NORMAL: 'NORMAL',
  SILVER: 'SILVER',
  GOLD: 'GOLD'
} as const

const PHONE_PATTERN = /^1\d{10}$/

const normalizePhone = (phone: string) => phone.replace(/\D/g, '')

const assertPhone = (phone: string) => {
  const normalized = normalizePhone(phone)
  if (!PHONE_PATTERN.test(normalized)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: '手机号格式不正确'
    })
  }
  return normalized
}

const isCustomerLevel = (value: string) => Object.values(CUSTOMER_LEVELS).includes(value as never)

const toCustomerDto = (
  customer: {
    id: string
    phone: string
    name: string | null
    points: number
    level: string
    createdAt: Date
  },
  extras?: {
    totalSpent?: number
    pointLogs?: Array<{ id: string; change: number; reason: string; createdAt: Date }>
  }
) => ({
  id: customer.id,
  phone: customer.phone,
  name: customer.name,
  points: customer.points,
  level: customer.level,
  createdAt: customer.createdAt,
  totalSpent: extras?.totalSpent,
  pointLogs: extras?.pointLogs?.map((log) => ({
    id: log.id,
    change: log.change,
    reason: log.reason,
    createdAt: log.createdAt
  }))
})

export const getCustomers = async (params: {
  page?: number
  pageSize?: number
  search?: string
  level?: string
}) => {
  const page = Math.max(1, params.page || 1)
  const pageSize = Math.min(100, Math.max(1, params.pageSize || 20))
  const search = params.search?.trim()
  const level = params.level?.trim()

  if (level && !isCustomerLevel(level)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: '会员等级不正确'
    })
  }

  const where: Prisma.CustomerWhereInput = {
    ...(level ? { level } : {}),
    ...(search
      ? {
          OR: [{ phone: { contains: search } }, { name: { contains: search } }]
        }
      : {})
  }

  const [items, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.customer.count({ where })
  ])

  return {
    items: items.map((item) => toCustomerDto(item)),
    total,
    page,
    pageSize
  }
}

export const createCustomer = async (data: { phone: string; name?: string }) => {
  const phone = assertPhone(data.phone)
  const name = data.name?.trim() || null

  try {
    const customer = await prisma.customer.create({
      data: {
        phone,
        name
      }
    })
    return toCustomerDto(customer)
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw createError({
        statusCode: 409,
        statusMessage: 'Conflict',
        message: '手机号已存在'
      })
    }
    throw error
  }
}

export const getCustomerById = async (id: string) => {
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      pointLogs: {
        orderBy: { createdAt: 'desc' },
        take: 20
      },
      orders: {
        where: { status: 'COMPLETED' },
        select: { totalAmount: true }
      }
    }
  })

  if (!customer) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: '会员不存在'
    })
  }

  const totalSpent = customer.orders.reduce((sum, order) => sum + Number(order.totalAmount), 0)

  return toCustomerDto(customer, {
    totalSpent,
    pointLogs: customer.pointLogs
  })
}

export const updateCustomer = async (id: string, data: { name?: string; level?: string }) => {
  const payload: { name?: string | null; level?: string } = {}

  if (data.name !== undefined) {
    payload.name = data.name.trim() || null
  }

  if (data.level !== undefined) {
    const level = data.level.trim()
    if (!isCustomerLevel(level)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: '会员等级不正确'
      })
    }
    payload.level = level
  }

  const customer = await prisma.customer
    .update({
      where: { id },
      data: payload
    })
    .catch((error: unknown) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw createError({
          statusCode: 404,
          statusMessage: 'Not Found',
          message: '会员不存在'
        })
      }
      throw error
    })

  return toCustomerDto(customer)
}

export const deleteCustomer = async (id: string) => {
  const orderCount = await prisma.order.count({
    where: { memberId: id }
  })

  if (orderCount > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Conflict',
      message: '该会员已有订单记录，不能删除'
    })
  }

  await prisma.customer
    .delete({
      where: { id }
    })
    .catch((error: unknown) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw createError({
          statusCode: 404,
          statusMessage: 'Not Found',
          message: '会员不存在'
        })
      }
      throw error
    })
}

export const lookupByPhone = async (phone: string) => {
  const normalized = assertPhone(phone)
  const customer = await prisma.customer.findUnique({
    where: { phone: normalized }
  })
  return customer ? toCustomerDto(customer) : null
}

export const getPointDiscountAmount = (points: number) => Math.floor(points / 100)

export const getEarnedPoints = (amount: number) => Math.max(0, Math.floor(amount))
