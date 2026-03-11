/**
 * Axios API client — Signal Intelligence
 *
 * Features:
 *  - Base URL from VITE_API_URL env var (falls back to '' for same-origin proxy)
 *  - Attaches Bearer token from localStorage on every request
 *  - Automatic token refresh on 401: calls POST /api/auth/refresh,
 *    retries the original request once, then logs out if refresh fails
 *  - Exports typed helper functions: api.get(), api.post(), api.put(), api.delete()
 */

import axios from 'axios';

// ── Create instance ──────────────────────────────────────────────────────────

const BASE_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000,
});

// ── Request interceptor: attach JWT ─────────────────────────────────────────

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ── Response interceptor: token refresh on 401 ──────────────────────────────

let _isRefreshing = false;
let _refreshQueue = []; // Queued requests waiting for a new token

function _processQueue(error, token = null) {
  _refreshQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  _refreshQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    // Only attempt refresh on 401, and only once per request (_retry flag)
    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    // Skip refresh for auth endpoints to avoid infinite loops
    if (original.url?.includes('/api/auth/')) {
      _logout();
      return Promise.reject(error);
    }

    if (_isRefreshing) {
      // Queue this request until the refresh completes
      return new Promise((resolve, reject) => {
        _refreshQueue.push({ resolve, reject });
      }).then((token) => {
        original.headers['Authorization'] = `Bearer ${token}`;
        return api(original);
      });
    }

    original._retry = true;
    _isRefreshing = true;

    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
      _logout();
      return Promise.reject(error);
    }

    try {
      const { data } = await axios.post(
        `${BASE_URL}/api/auth/refresh?refresh_token=${encodeURIComponent(refreshToken)}`
      );

      const newToken = data.access_token;
      localStorage.setItem('access_token', newToken);
      if (data.refresh_token) {
        localStorage.setItem('refresh_token', data.refresh_token);
      }

      api.defaults.headers['Authorization'] = `Bearer ${newToken}`;
      original.headers['Authorization'] = `Bearer ${newToken}`;

      _processQueue(null, newToken);
      return api(original);
    } catch (refreshError) {
      _processQueue(refreshError, null);
      _logout();
      return Promise.reject(refreshError);
    } finally {
      _isRefreshing = false;
    }
  },
);

// ── Auth helpers ─────────────────────────────────────────────────────────────

export function setTokens(accessToken, refreshToken) {
  localStorage.setItem('access_token', accessToken);
  if (refreshToken) localStorage.setItem('refresh_token', refreshToken);
  api.defaults.headers['Authorization'] = `Bearer ${accessToken}`;
}

export function clearTokens() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  delete api.defaults.headers['Authorization'];
}

function _logout() {
  clearTokens();
  // Emit a custom event so the auth store can react without a circular import
  window.dispatchEvent(new CustomEvent('signal:logout'));
}

// ── Typed convenience wrappers ───────────────────────────────────────────────

// Unwrap response.data so callers receive the parsed JSON directly.
// Errors still propagate — the interceptor handles 401 refresh on the Axios level.

/** GET /api/<path> → response body */
export const get = (path, params) => api.get(`/api${path}`, { params }).then(r => r.data);

/** POST /api/<path> with body → response body */
export const post = (path, body) => api.post(`/api${path}`, body).then(r => r.data);

/** PUT /api/<path> with body → response body */
export const put = (path, body) => api.put(`/api${path}`, body).then(r => r.data);

/** PATCH /api/<path> with body → response body */
export const patch = (path, body) => api.patch(`/api${path}`, body).then(r => r.data);

/** DELETE /api/<path> → response body */
export const del = (path) => api.delete(`/api${path}`).then(r => r.data);

export default api;
