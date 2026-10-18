
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { AuthSession } from '../types/auth.types';

const SESSION_KEY = 'savibite_v2_auth_session';

// Bộ nhớ tạm, dùng khi Web không cho phép localStorage.
let webMemorySession: AuthSession | null = null;

function isAuthSession(value: unknown): value is AuthSession {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value)
  ) {
    return false;
  }

  const data = value as Record<string, unknown>;

  if (
    typeof data.accessToken !== 'string' ||
    !data.accessToken ||
    typeof data.refreshToken !== 'string' ||
    !data.refreshToken ||
    typeof data.accessTokenExpiresAt !== 'string' ||
    typeof data.refreshTokenExpiresAt !== 'string'
  ) {
    return false;
  }

  if (
    typeof data.user !== 'object' ||
    data.user === null ||
    Array.isArray(data.user)
  ) {
    return false;
  }

  const user = data.user as Record<string, unknown>;

  return (
    typeof user.id === 'string' &&
    user.id.length > 0 &&
    typeof user.email === 'string'
  );
}

function parseSession(value: string | null): AuthSession | null {
  if (!value) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(value);

    return isAuthSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function getWebStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    // Một số trình duyệt chặn storage.
    return null;
  }
}

export const tokenStorage = {
  async get(): Promise<AuthSession | null> {
    if (Platform.OS === 'web') {
      const storage = getWebStorage();

      if (!storage) {
        return webMemorySession;
      }

      try {
        const raw = storage.getItem(SESSION_KEY);

        if (!raw) {
          return null;
        }

        const session = parseSession(raw);

        if (!session) {
          storage.removeItem(SESSION_KEY);
          webMemorySession = null;
          return null;
        }

        webMemorySession = session;
        return session;
      } catch {
        return webMemorySession;
      }
    }

    try {
      const raw = await SecureStore.getItemAsync(SESSION_KEY);
      const session = parseSession(raw);

      if (raw && !session) {
        await SecureStore.deleteItemAsync(SESSION_KEY);
      }

      return session;
    } catch {
      return null;
    }
  },

  async set(session: AuthSession): Promise<void> {
    if (!isAuthSession(session)) {
      throw new Error('Phiên đăng nhập không hợp lệ.');
    }

    if (Platform.OS === 'web') {
      const storage = getWebStorage();

      if (storage) {
        // Ghi vào bộ nhớ bền vững trước khi xác nhận.
        // Không âm thầm tuyên bố đã lưu nếu storage bị chặn.
        storage.setItem(SESSION_KEY, JSON.stringify(session));
      }

      webMemorySession = session;
      return;
    }

    await SecureStore.setItemAsync(
      SESSION_KEY,
      JSON.stringify(session)
    );
  },

  async clear(): Promise<void> {
    if (Platform.OS === 'web') {
      webMemorySession = null;

      const storage = getWebStorage();

      if (storage) {
        storage.removeItem(SESSION_KEY);
      }

      return;
    }

    await SecureStore.deleteItemAsync(SESSION_KEY);
  },
};
