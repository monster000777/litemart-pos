import type { CheckoutPayload, CheckoutResult, OrdersResponse } from '../types'
import { request } from '../utils/request'

export const checkout = (payload: CheckoutPayload) =>
  request<CheckoutResult>({
    url: '/api/orders/checkout',
    method: 'POST',
    data: payload
  })

export const getOrders = (page = 1, pageSize = 20) =>
  request<OrdersResponse>({
    url: `/api/orders?page=${page}&pageSize=${pageSize}`
  })
