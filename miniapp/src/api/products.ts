import type { Product } from '../types'
import { request } from '../utils/request'

export const getProducts = (name = '') =>
  request<Product[]>({
    url: `/api/products${name ? `?name=${encodeURIComponent(name)}` : ''}`
  })
