import axios, { AxiosInstance, AxiosError } from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auditflow_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auditflow_token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// Types
export interface User {
  id: string
  email: string
  is_active: boolean
  created_at: string
}

export interface ApiKey {
  id: string
  name: string
  description?: string
  key_prefix: string
  is_active: boolean
  last_used_at?: string
  created_at: string
  key?: string
}

export interface Event {
  id: string
  event_type: string
  severity: 'debug' | 'info' | 'warning' | 'error' | 'critical'
  source: string
  payload: Record<string, unknown>
  timestamp: string
  created_at: string
  api_key_id: string
}

export interface Alert {
  id: string
  title: string
  description?: string
  level: 'low' | 'medium' | 'high' | 'critical'
  status: 'open' | 'acknowledged' | 'resolved'
  rule_name: string
  event_id: string
  created_at: string
  updated_at: string
  acknowledged_at?: string
  resolved_at?: string
}

export interface EventStats {
  total_events: number
  events_by_type: Record<string, number>
  events_by_severity: Record<string, number>
  events_today: number
  events_this_week: number
}

export interface AlertStats {
  total_alerts: number
  open_alerts: number
  acknowledged_alerts: number
  resolved_alerts: number
  alerts_by_level: Record<string, number>
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

// Auth API
export const authApi = {
  register: (email: string, password: string) =>
    api.post<User>('/api/auth/register', { email, password }),
  
  login: (email: string, password: string) =>
    api.post<{ access_token: string; token_type: string; expires_in: number }>(
      '/api/auth/login',
      { email, password }
    ),
  
  me: () => api.get<User>('/api/auth/me'),
}

// API Keys API
export const keysApi = {
  list: (includeInactive = false) =>
    api.get<{ items: ApiKey[]; total: number }>('/api/keys', {
      params: { include_inactive: includeInactive },
    }),
  
  create: (name: string, description?: string) =>
    api.post<ApiKey>('/api/keys', { name, description }),
  
  get: (id: string) => api.get<ApiKey>(`/api/keys/${id}`),
  
  delete: (id: string) => api.delete(`/api/keys/${id}`),
  
  regenerate: (id: string) => api.post<ApiKey>(`/api/keys/${id}/regenerate`),
}

// Events API
export const eventsApi = {
  list: (params: {
    page?: number
    page_size?: number
    event_type?: string
    severity?: string
    source?: string
    start_date?: string
    end_date?: string
    api_key_id?: string
  } = {}) =>
    api.get<PaginatedResponse<Event>>('/api/events', { params }),
  
  get: (id: string) => api.get<Event>(`/api/events/${id}`),
  
  stats: () => api.get<EventStats>('/api/events/stats'),
}

// Alerts API
export const alertsApi = {
  list: (params: {
    page?: number
    page_size?: number
    level?: string
    status?: string
    rule_name?: string
    start_date?: string
    end_date?: string
  } = {}) =>
    api.get<PaginatedResponse<Alert>>('/api/alerts', { params }),
  
  get: (id: string) => api.get<Alert>(`/api/alerts/${id}`),
  
  stats: () => api.get<AlertStats>('/api/alerts/stats'),
  
  updateStatus: (id: string, status: 'open' | 'acknowledged' | 'resolved') =>
    api.patch<Alert>(`/api/alerts/${id}`, { status }),
  
  acknowledge: (id: string) => api.post<Alert>(`/api/alerts/${id}/acknowledge`),
  
  resolve: (id: string) => api.post<Alert>(`/api/alerts/${id}/resolve`),
}

export default api
