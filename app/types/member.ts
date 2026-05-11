export interface MemberDto {
  id: string
  phone: string
  name: string | null
  points: number
  level: string
  createdAt: string
  totalSpent?: number
  pointLogs?: PointLogDto[]
}

export interface MemberListResponse {
  items: MemberDto[]
  total: number
  page: number
  pageSize: number
}

export interface PointLogDto {
  id: string
  change: number
  reason: string
  createdAt: string
}
