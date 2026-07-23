import axios from 'axios'

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api/v1',
  headers: {
    Accept: 'application/json',
  },
  timeout: 10_000,
  withCredentials: true,
})

let accessToken = null

apiClient.interceptors.request.use((config) => {
  config.headers.set('X-Correlation-Id', crypto.randomUUID())
  if (accessToken) config.headers.set('Authorization', `Bearer ${accessToken}`)
  return config
})

export function setAccessToken(token) {
  accessToken = token
}

export async function login(credentials) {
  const response = await apiClient.post('/auth/login', credentials)
  setAccessToken(response.data.data.accessToken)
  return response.data.data
}

export async function refreshSession() {
  const response = await apiClient.post('/auth/refresh')
  setAccessToken(response.data.data.accessToken)
  return response.data.data
}

export async function logout() {
  await apiClient.post('/auth/logout')
  setAccessToken(null)
}

export async function getCurrentUser() {
  const response = await apiClient.get('/auth/me')
  return response.data.data
}

export async function getHealth({ signal } = {}) {
  const response = await apiClient.get('/health', { signal })
  return response.data.data
}

export { apiClient }
