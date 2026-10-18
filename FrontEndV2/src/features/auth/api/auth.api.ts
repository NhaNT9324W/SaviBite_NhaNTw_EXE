
import { ENV } from '../../../config/env';

import type {
  AuthSession,
  AuthUser,
  LoginRequest,
  RefreshRequest,
  RegisterRequest,
} from '../types/auth.types';

type ApiEnvelope<T> = {
  success: boolean;
  data?: T | null;
  message?: string;
  error?: {
    code?: string;
    message?: string;
  } | null;
};

export class AuthApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'AuthApiError';
  }
}

async function authRequest<T>(
  path: string,
  method: 'GET' | 'POST',
  body?: unknown,
  accessToken?: string
): Promise<T> {
  const baseUrl = ENV.apiUrl.replace(/\/+$/, '');

  if (!baseUrl) {
    throw new AuthApiError(
      'Chưa cấu hình EXPO_PUBLIC_API_URL.',
      0
    );
  }

  let response: Response;

  try {
    response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined
          ? { 'Content-Type': 'application/json' }
          : {}),
        ...(accessToken
          ? { Authorization: `Bearer ${accessToken}` }
          : {}),
      },
      ...(body !== undefined
        ? { body: JSON.stringify(body) }
        : {}),
    });
  } catch {
    throw new AuthApiError(
      'Không thể kết nối đến máy chủ SaviBite.',
      0,
      'NETWORK_ERROR'
    );
  }

  let result: ApiEnvelope<T>;

  try {
    result = (await response.json()) as ApiEnvelope<T>;
  } catch {
    throw new AuthApiError(
      'Máy chủ trả về dữ liệu không hợp lệ.',
      response.status
    );
  }

  if (!response.ok || !result.success) {
    throw new AuthApiError(
      result.error?.message ??
        result.message ??
        'Yêu cầu xác thực thất bại.',
      response.status,
      result.error?.code
    );
  }

  return result.data as T;
}

export const authApi = {
  register(
    request: RegisterRequest
  ): Promise<unknown> {
    return authRequest<unknown>(
      '/api/auth/register',
      'POST',
      request
    );
  },

  login(request: LoginRequest): Promise<AuthSession> {
    return authRequest<AuthSession>(
      '/api/auth/login',
      'POST',
      request
    );
  },

  refresh(
    request: RefreshRequest
  ): Promise<AuthSession> {
    return authRequest<AuthSession>(
      '/api/auth/refresh',
      'POST',
      request
    );
  },

  me(accessToken: string): Promise<AuthUser> {
    return authRequest<AuthUser>(
      '/api/auth/me',
      'GET',
      undefined,
      accessToken
    );
  },

  logout(
    refreshToken: string,
    accessToken: string
  ): Promise<null> {
    return authRequest<null>(
      '/api/auth/logout',
      'POST',
      { refreshToken },
      accessToken
    );
  },
};
