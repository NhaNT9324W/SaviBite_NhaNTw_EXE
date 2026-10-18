import { apiRequest, ApiRequestError } from '../../../shared/api/api-client';
import type {
  AuthSession,
  AuthUser,
  LoginRequest,
  RefreshRequest,
  RegisterRequest,
} from '../types/auth.types';

/** Backwards-compatible error type: AuthProvider handles 401/403 using instanceof. */
export class AuthApiError extends ApiRequestError {
  constructor(message: string, status: number, code?: string) {
    super(message, status, code);
    this.name = 'AuthApiError';
  }
}

async function authRequest<T>(
  path: string,
  method: 'GET' | 'POST',
  body?: unknown,
  accessToken?: string
): Promise<T> {
  try {
    return await apiRequest<T>(path, {
      method,
      body,
      accessToken,
      // Backend returns {success:true,data:null} for successful logout.
      allowNullData: path === '/api/auth/logout',
    });
  } catch (error: unknown) {
    if (error instanceof ApiRequestError) {
      throw new AuthApiError(error.message, error.status, error.code);
    }
    throw error;
  }
}

export const authApi = {
  register(request: RegisterRequest): Promise<unknown> {
    return authRequest<unknown>('/api/auth/register', 'POST', request);
  },
  login(request: LoginRequest): Promise<AuthSession> {
    return authRequest<AuthSession>('/api/auth/login', 'POST', request);
  },
  refresh(request: RefreshRequest): Promise<AuthSession> {
    return authRequest<AuthSession>('/api/auth/refresh', 'POST', request);
  },
  me(accessToken: string): Promise<AuthUser> {
    return authRequest<AuthUser>('/api/auth/me', 'GET', undefined, accessToken);
  },
  logout(refreshToken: string, accessToken: string): Promise<null> {
    return authRequest<null>(
      '/api/auth/logout',
      'POST',
      { refreshToken },
      accessToken
    );
  },
};