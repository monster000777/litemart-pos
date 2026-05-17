import type { Customer } from '../types'
import { request } from '../utils/request'

export const lookupMember = (phone: string) =>
  request<Customer | null>({
    url: `/api/customers/lookup?phone=${encodeURIComponent(phone)}`
  })
