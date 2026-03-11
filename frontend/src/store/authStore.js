/**
 * Auth store — Zustand
 *
 * Manages authentication state across the entire app.
 *
 * State:
 *   isAuthenticated  boolean  — true when a valid JWT is stored
 *   customer         object   — { id, name, email, plan }
 *   loading          boolean  — true while checking token on startup
 *
 * Actions:
 *   login(email, password)   — POST /api/auth/login, store tokens
 *   logout()                 — clear tokens + reset state
 *   register(name, email, pw) — POST /api/auth/register, auto-login
 *   fetchMe()                — GET /api/auth/me, populate customer
 *   initAuth()               — called on app mount: verify stored token
 *
 * The store also listens for the `signal:logout` custom event fired by the
 * Axios client when token refresh fails, so the UI reacts automatically.
 *
 * NOTE: The auth backend endpoints (/login, /register, /refresh) expect
 * parameters as URL query strings, not as a JSON body. All calls here use
 * encodeURIComponent to build the query string.
 */

import { create } from 'zustand';
import { setTokens, clearTokens, get, post } from '../api/client';

const useAuthStore = create((set, getState) => ({
  // ── State ──────────────────────────────────────────────────────────────────
  isAuthenticated: false,
  customer: null,
  loading: true,  // true until initAuth() resolves

  // ── Actions ────────────────────────────────────────────────────────────────

  /** Verify the stored access token and populate customer. */
  initAuth: async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      set({ isAuthenticated: false, loading: false });
      return;
    }
    try {
      const data = await get('/auth/me');
      set({ isAuthenticated: true, customer: data, loading: false });
    } catch {
      clearTokens();
      set({ isAuthenticated: false, customer: null, loading: false });
    }
  },

  /** Log in with email + password. Throws on failure. */
  login: async (email, password) => {
    // Auth endpoints expect query params, not JSON body
    const data = await post(
      `/auth/login?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`
    );
    setTokens(data.access_token, data.refresh_token);
    set({ isAuthenticated: true });
    // Fetch customer profile
    try {
      const me = await get('/auth/me');
      set({ customer: me });
    } catch { /* ignore — not critical */ }
  },

  /** Register a new account. Auto-logs in on success. Throws on failure. */
  register: async (name, email, password) => {
    // Auth endpoints expect query params, not JSON body
    const data = await post(
      `/auth/register?name=${encodeURIComponent(name)}&email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`
    );
    setTokens(data.access_token, data.refresh_token);
    set({ isAuthenticated: true, customer: data });
  },

  /** Log out: clear tokens + reset store. */
  logout: () => {
    clearTokens();
    set({ isAuthenticated: false, customer: null });
  },

  /** Refresh customer profile from API. */
  fetchMe: async () => {
    try {
      const data = await get('/auth/me');
      set({ customer: data });
    } catch { /* ignore */ }
  },
}));

// ── Listen for forced logout from Axios interceptor ───────────────────────────
window.addEventListener('signal:logout', () => {
  useAuthStore.getState().logout();
});

export default useAuthStore;
