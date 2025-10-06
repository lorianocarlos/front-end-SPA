import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { refreshSession, setAuthToken } from '../api/client';
import type { SpaAuthProfile } from '../types/api';

type AuthSession = {
  token: string;
  refreshToken: string | null;
  user: SpaAuthProfile | null;
};

type AuthContextValue = {
  token: string | null;
  refreshToken: string | null;
  user: SpaAuthProfile | null;
  isAuthenticated: boolean;
  setToken: (token: string, extras?: { refreshToken?: string | null; user?: SpaAuthProfile | null }) => void;
  clearToken: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const STORAGE_KEY = 'spa_session';
const LEGACY_STORAGE_KEY = 'spa_token';
const REFRESH_INTERVAL_MS = 60_000;

const readStoredSession = (): AuthSession | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as Partial<AuthSession>;
      if (parsed && typeof parsed === 'object' && typeof parsed.token === 'string') {
        return {
          token: parsed.token,
          refreshToken: parsed.refreshToken ?? null,
          user: parsed.user ?? null,
        };
      }
    } catch {
      return {
        token: stored,
        refreshToken: null,
        user: null,
      };
    }
  }

  const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
  if (legacy) {
    return {
      token: legacy,
      refreshToken: null,
      user: null,
    };
  }

  return null;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<AuthSession | null>(() => readStoredSession());

  useEffect(() => {
    const token = session?.token ?? null;
    setAuthToken(token);

    if (typeof window === 'undefined') {
      return;
    }

    const storage = window.localStorage;

    if (session) {
      storage.setItem(STORAGE_KEY, JSON.stringify(session));
    } else {
      storage.removeItem(STORAGE_KEY);
    }

    storage.removeItem(LEGACY_STORAGE_KEY);
  }, [session]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const refreshToken = session?.refreshToken?.trim();
    if (!refreshToken) {
      return;
    }

    let cancelled = false;

    const runRefresh = async () => {
      try {
        const response = await refreshSession(refreshToken);
        const payload = response.data;
        const tokens = payload.data;

        if (payload.cod !== 0 || !tokens?.AccessToken) {
          throw new Error('Invalid refresh response');
        }

        if (cancelled) {
          return;
        }

        setSession((current) => {
          if (!current) {
            return current;
          }

          return {
            token: tokens.AccessToken,
            refreshToken: tokens.RefreshToken ?? current.refreshToken,
            user: current.user,
          };
        });
      } catch (error) {
        console.error('Failed to refresh session', error);
        if (!cancelled) {
          setSession(null);
        }
      }
    };

    const intervalId = window.setInterval(() => {
      void runRefresh();
    }, REFRESH_INTERVAL_MS);

    void runRefresh();

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [session?.refreshToken]);

  const value = useMemo<AuthContextValue>(() => ({
    token: session?.token ?? null,
    refreshToken: session?.refreshToken ?? null,
    user: session?.user ?? null,
    isAuthenticated: Boolean(session?.token),
    setToken: (rawToken: string, extras) => {
      const token = rawToken.trim();
      if (!token) {
        setSession(null);
        return;
      }

      const refreshToken = extras?.refreshToken ? extras.refreshToken.trim() : null;

      setSession({
        token,
        refreshToken: refreshToken || null,
        user: extras?.user ?? null,
      });
    },
    clearToken: () => setSession(null),
  }), [session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}



