import { useEffect, useState } from 'react';

import { login, logout as logoutRequest, refreshSession, register } from '../api/auth';
import api from '../api/client';
import type { User } from '../api/types';
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  hasTokens,
  isTokenExpired,
  setTokens
} from './token-storage';
import { AuthContext, type AuthContextValue } from './auth-context-store';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isAuthenticated = Boolean(user);

  useEffect(() => {
    let isMounted = true;

    const loadUser = async () => {
      if (!hasTokens()) {
        if (isMounted) {
          setUser(null);
          setIsLoading(false);
        }
        return;
      }

      try {
        const refreshToken = getRefreshToken();
        if (isTokenExpired(refreshToken)) {
          clearTokens();
          if (isMounted) {
            setUser(null);
          }
          return;
        }

        const accessToken = getAccessToken();
        if (isTokenExpired(accessToken) && refreshToken) {
          const tokens = await refreshSession(refreshToken);
          setTokens(tokens.accessToken, tokens.refreshToken);
        }

        const { data } = await api.get<User>('/users/me');
        if (isMounted) {
          setUser(data);
        }
      } catch {
        clearTokens();
        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadUser();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const handler = () => {
      setUser(null);
      setIsLoading(false);
    };
    window.addEventListener('auth:logout', handler);
    return () => window.removeEventListener('auth:logout', handler);
  }, []);

  const value: AuthContextValue = {
    user,
    isAuthenticated,
    isLoading,
    login: async (payload) => {
      const tokens = await login(payload);
      try {
        setTokens(tokens.accessToken, tokens.refreshToken);
        const { data } = await api.get<User>('/users/me');
        setUser(data);
      } catch (error) {
        clearTokens();
        throw error;
      }
    },
    register: async (payload) => {
      const tokens = await register(payload);
      try {
        setTokens(tokens.accessToken, tokens.refreshToken);
        const { data } = await api.get<User>('/users/me');
        setUser(data);
      } catch (error) {
        clearTokens();
        throw error;
      }
    },
    logout: async () => {
      const refreshToken = getRefreshToken();
      if (refreshToken) {
        try {
          await logoutRequest(refreshToken);
        } catch {
          // ignore
        }
      }
      clearTokens();
      setUser(null);
      setIsLoading(false);
    }
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
