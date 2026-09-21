export interface FunctionsResponse<T = any> {
  data: T | null
  error: { message: string } | null
}

export interface PaginatedResponse<T> {
  data: T[]
  count: number
  error: { message: string } | null
}

export interface FunctionInvokeResponse<T = any> {
  data: T | null
  error: { message: string } | null
  count?: number
}