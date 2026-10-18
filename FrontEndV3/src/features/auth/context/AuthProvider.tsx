
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useCart } from '../../cart/context/CartProvider';
import { authApi, AuthApiError } from '../api/auth.api';
import { tokenStorage } from '../services/tokenStorage';
import { isAccessTokenValid, isRefreshTokenValid } from '../services/sessionExpiry';

import type {
  AuthContextValue,
  AuthSession,
  AuthStatus,
  AuthUser,
} from '../types/auth.types';

const AuthContext =
  createContext<AuthContextValue | null>(null);



export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { clearCart } = useCart();

  const [user, setUser] =
    useState<AuthUser | null>(null);

  const [status, setStatus] =
    useState<AuthStatus>('loading');

  const sessionRef =
    useRef<AuthSession | null>(null);

  const operationVersionRef = useRef(0);

  const refreshPromiseRef =
    useRef<Promise<boolean> | null>(null);

  const clearLocalSession = useCallback(
    async (): Promise<void> => {
      operationVersionRef.current += 1;
      sessionRef.current = null;

      setUser(null);
      setStatus('guest');

      clearCart();
      await tokenStorage.clear();
    },
    [clearCart]
  );

  const refreshSession = useCallback(
    async (): Promise<boolean> => {
      if (refreshPromiseRef.current) {
        return refreshPromiseRef.current;
      }

      const session = sessionRef.current;

      if (!session || !isRefreshTokenValid(session)) {
        await clearLocalSession();
        return false;
      }

      const version = operationVersionRef.current;

      const promise = (async (): Promise<boolean> => {
        try {
          const updated = await authApi.refresh({
            refreshToken: session.refreshToken,
          });

          if (
            version !== operationVersionRef.current
          ) {
            return false;
          }

          if (
            session.user.id &&
            updated.user.id !== session.user.id
          ) {
            clearCart();
          }

          /*
           * Nếu refresh vẫn là cùng một tài khoản,
           * giữ thông tin user mới đồng bộ từ Profile.
           * Token và thời gian hết hạn lấy từ Backend.
           */
          const currentUser = sessionRef.current?.user;

          const nextSession: AuthSession =
            currentUser?.id === updated.user.id
              ? {
                  ...updated,
                  user: {
                    ...updated.user,
                    ...currentUser,
                  },
                }
              : updated;

          await tokenStorage.set(nextSession);

          if (
            version !== operationVersionRef.current
          ) {
            return false;
          }

          sessionRef.current = nextSession;
          setUser(nextSession.user);
          setStatus('authenticated');

          return true;
        } catch (error: unknown) {
          if (
            version !== operationVersionRef.current
          ) {
            return false;
          }

          if (
            error instanceof AuthApiError &&
            (
              error.status === 401 ||
              error.status === 403
            )
          ) {
            await clearLocalSession();
          }

          return false;
        }
      })();

      refreshPromiseRef.current = promise;

      try {
        return await promise;
      } finally {
        if (
          refreshPromiseRef.current === promise
        ) {
          refreshPromiseRef.current = null;
        }
      }
    },
    [clearCart, clearLocalSession]
  );

  const getAccessToken = useCallback(
    async (): Promise<string | null> => {
      const session = sessionRef.current;

      if (!session) {
        return null;
      }

      if (isAccessTokenValid(session)) {
        return session.accessToken;
      }

      const refreshed = await refreshSession();

      return refreshed
        ? sessionRef.current?.accessToken ?? null
        : null;
    },
    [refreshSession]
  );

  /*
   * Đồng bộ tài khoản sau khi sửa Profile.
   *
   * 1. Lấy token hợp lệ (tự refresh nếu cần).
   * 2. GET /api/auth/me qua authApi.me.
   * 3. Không nhận dữ liệu của tài khoản khác.
   * 4. Ghi lại session.user và cập nhật Header.
   */
  const syncUser = useCallback(
    async (): Promise<boolean> => {
      const originalSession = sessionRef.current;

      if (!originalSession) {
        return false;
      }

      const version = operationVersionRef.current;
      const originalUserId = originalSession.user.id;

      const token = await getAccessToken();

      if (
        !token ||
        version !== operationVersionRef.current
      ) {
        return false;
      }

      const currentUser = await authApi.me(token);

      if (
        version !== operationVersionRef.current
      ) {
        return false;
      }

      const currentSession = sessionRef.current;

      if (
        !currentSession ||
        currentSession.user.id !== originalUserId ||
        currentUser.id !== originalUserId
      ) {
        return false;
      }

      const nextSession: AuthSession = {
        ...currentSession,
        user: currentUser,
      };

      await tokenStorage.set(nextSession);

      if (
        version !== operationVersionRef.current ||
        sessionRef.current?.user.id !== originalUserId
      ) {
        return false;
      }

      sessionRef.current = nextSession;

      setUser(currentUser);
      setStatus('authenticated');

      return true;
    },
    [getAccessToken]
  );

  const login = useCallback(
    async (
      email: string,
      password: string
    ): Promise<void> => {
      const version =
        ++operationVersionRef.current;

      const previousSession = sessionRef.current;

      const session = await authApi.login({
        email: email.trim(),
        password,
      });

      if (
        version !== operationVersionRef.current
      ) {
        return;
      }

      await tokenStorage.set(session);

      if (
        version !== operationVersionRef.current
      ) {
        return;
      }

      if (
        previousSession &&
        previousSession.user.id !== session.user.id
      ) {
        clearCart();
      }

      sessionRef.current = session;
      setUser(session.user);
      setStatus('authenticated');
    },
    [clearCart]
  );

  const logout = useCallback(
    async (): Promise<void> => {
      const session = sessionRef.current;

      await clearLocalSession();

      if (!session) {
        return;
      }

      try {
        await authApi.logout(
          session.refreshToken,
          session.accessToken
        );
      } catch {
        // Local session đã được xóa.
      }
    },
    [clearLocalSession]
  );

  useEffect(() => {
    let active = true;

    const version = operationVersionRef.current;

    async function restoreSession() {
      try {
        const saved = await tokenStorage.get();

        if (
          !active ||
          version !== operationVersionRef.current
        ) {
          return;
        }

        if (!saved) {
          setStatus('guest');
          return;
        }

        if (!isRefreshTokenValid(saved)) {
          await clearLocalSession();
          return;
        }

        const previousSession = sessionRef.current;

        if (
          previousSession &&
          previousSession.user.id !== saved.user.id
        ) {
          clearCart();
        }

        sessionRef.current = saved;

        let accessToken: string | null = null;

        if (isAccessTokenValid(saved)) {
          accessToken = saved.accessToken;
        } else {
          const refreshed = await refreshSession();

          accessToken = refreshed
            ? sessionRef.current?.accessToken ?? null
            : null;
        }

        if (!active) {
          return;
        }

        if (!accessToken) {
          setStatus('guest');
          return;
        }

        const currentUser =
          await authApi.me(accessToken);

        if (
          !active ||
          version !== operationVersionRef.current
        ) {
          return;
        }

        if (currentUser.id !== saved.user.id) {
          clearCart();
        }

        /*
         * Lưu thông tin mới đọc từ Backend
         * để lần mở ứng dụng sau cũng đúng tên.
         */
        const session = sessionRef.current;

        if (
          session &&
          session.user.id === currentUser.id
        ) {
          const nextSession: AuthSession = {
            ...session,
            user: currentUser,
          };

          sessionRef.current = nextSession;

          await tokenStorage.set(nextSession);

          if (
            !active ||
            version !== operationVersionRef.current
          ) {
            return;
          }
        }

        setUser(currentUser);
        setStatus('authenticated');
      } catch (error: unknown) {
        if (
          !active ||
          version !== operationVersionRef.current
        ) {
          return;
        }

        if (
          error instanceof AuthApiError &&
          (
            error.status === 401 ||
            error.status === 403
          )
        ) {
          await clearLocalSession();
        } else {
          // Không xóa token vì lỗi mạng tạm thời.
          setStatus('guest');
        }
      }
    }

    void restoreSession();

    return () => {
      active = false;
    };
  }, [
    clearCart,
    clearLocalSession,
    refreshSession,
  ]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      isAuthenticated:
        status === 'authenticated' &&
        user !== null,
      login,
      logout,
      refreshSession,
      getAccessToken,
      syncUser,
    }),
    [
      user,
      status,
      login,
      logout,
      refreshSession,
      getAccessToken,
      syncUser,
    ]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      'useAuth phải được sử dụng bên trong AuthProvider.'
    );
  }

  return context;
}
