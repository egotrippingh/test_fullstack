import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

import { apiBaseUrl } from '../config';
import { refreshSession } from './auth';
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from '../auth/token-storage';

const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 10000
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise: Promise<void> | null = null;

function notifyLogout() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('auth:logout'));
  }
}

async function refreshTokens(): Promise<void> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new Error('Missing refresh token');
  }

  const tokens = await refreshSession(refreshToken);
  setTokens(tokens.accessToken, tokens.refreshToken);
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    const status = error.response?.status;

    if (status === 401 && !original._retry && getRefreshToken()) {
      if (!refreshPromise) {
        refreshPromise = refreshTokens().finally(() => {
          refreshPromise = null;
        });
      }

      try {
        await refreshPromise;
        original._retry = true;
        const token = getAccessToken();
        if (token) {
          original.headers.Authorization = `Bearer ${token}`;
        }
        return api(original);
      } catch (refreshError) {
        clearTokens();
        notifyLogout();
        return Promise.reject(refreshError);
      }
    }

    if (status === 401) {
      clearTokens();
      notifyLogout();
    }

    return Promise.reject(error);
  }
);

export default api;
