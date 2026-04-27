import type { Product } from '@prisma/client'
import { createError } from 'h3'

type ProductLike = Pick<
  Product,
  'id' | 'name' | 'sku' | 'image' | 'category' | 'price' | 'stock' | 'minStock' | 'createdAt'
>

const REMOTE_IMAGE_PATTERN = /^https?:\/\/[^\s]+$/i
const LOCAL_UPLOAD_PREFIX = '/uploads/'

export const parseProductImage = (value: unknown, options?: { allowUndefined?: boolean }) => {
  if (value === undefined) {
    return options?.allowUndefined ? undefined : null
  }

  if (value === null) {
    return null
  }

  if (typeof value !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: '商品图片格式错误'
    })
  }

  const image = value.trim()
  if (!image) {
    return null
  }

  if (image.startsWith(LOCAL_UPLOAD_PREFIX) || REMOTE_IMAGE_PATTERN.test(image)) {
    return image
  }

  throw createError({
    statusCode: 400,
    statusMessage: 'Bad Request',
    message: '商品图片地址不合法'
  })
}

export const toProductResponse = (product: ProductLike) => {
  return {
    id: product.id,
    name: product.name,
    sku: product.sku,
    image: product.image,
    category: product.category,
    price: Number(product.price),
    stock: product.stock,
    minStock: product.minStock,
    createdAt: product.createdAt
  }
}
