import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('pw_token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('pw_token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// ── Auth ──────────────────────────────────────────────
export const authApi = {
  setupStatus: () => api.get('/auth/setup').then(r => r.data),
  register: (data) => api.post('/auth/register', data).then(r => r.data),
  login: (email, password) => {
    const form = new FormData()
    form.append('username', email)
    form.append('password', password)
    return api.post('/auth/login', form).then(r => r.data)
  },
  me: () => api.get('/auth/me').then(r => r.data),
  listStaff: () => api.get('/auth/staff').then(r => r.data),
  createStaff: (data) => api.post('/auth/staff', data).then(r => r.data),
  updateStaff: (id, data) => api.patch(`/auth/staff/${id}`, data).then(r => r.data),
  removeStaff: (id) => api.delete(`/auth/staff/${id}`),
}

// ── Monitors ──────────────────────────────────────────
export const monitorsApi = {
  list:   ()           => api.get('/monitors/').then(r => r.data),
  get:    (id)         => api.get(`/monitors/${id}`).then(r => r.data),
  create: (data)       => api.post('/monitors/', data).then(r => r.data),
  update: (id, data)   => api.patch(`/monitors/${id}`, data).then(r => r.data),
  remove: (id)         => api.delete(`/monitors/${id}`),
}

// ── Results ───────────────────────────────────────────
export const resultsApi = {
  history: (id, limit = 100) => api.get(`/monitors/${id}/results?limit=${limit}`).then(r => r.data),
  stats:   (id, hours = 24)  => api.get(`/monitors/${id}/stats?hours=${hours}`).then(r => r.data),
}

// ── Alert Channels ────────────────────────────────────
export const alertsApi = {
  list:   ()           => api.get('/alert-channels/').then(r => r.data),
  create: (data)       => api.post('/alert-channels/', data).then(r => r.data),
  update: (id, data)   => api.patch(`/alert-channels/${id}`, data).then(r => r.data),
  remove: (id)         => api.delete(`/alert-channels/${id}`),
  test:   (id)         => api.post(`/alert-channels/${id}/test`).then(r => r.data),
}

// ── Status Pages ──────────────────────────────────────
export const statusPagesApi = {
  list:        ()           => api.get('/status-pages').then(r => r.data),
  create:      (data)       => api.post('/status-pages', data).then(r => r.data),
  update:      (id, data)   => api.patch(`/status-pages/${id}`, data).then(r => r.data),
  remove:      (id)         => api.delete(`/status-pages/${id}`),
  getPublic:   (slug)       => axios.get(`/api/status/${slug}`).then(r => r.data),
}
export default api
