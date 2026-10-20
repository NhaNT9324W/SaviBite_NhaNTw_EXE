
export type SystemRole = 'USER' | 'ADMIN';

export type AuthUser = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  systemRole: SystemRole;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type RegisterRequest = {
  fullName: string;
  email: string;
  phone: string;
  password: string;
};

export type RefreshRequest = {
  refreshToken: string;
};

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
  user: AuthUser;
};

export type AuthStatus =
  | 'loading'
  | 'authenticated'
  | 'guest';

export type GoogleLoginRequest = {
  idToken: string;
  email?: string;
  fullName?: string;
  avatarUrl?: string;
};

export type AuthContextValue = {
  user: AuthUser | null;
  status: AuthStatus;
  isAuthenticated: boolean;
  login: (
    email: string,
    password: string
  ) => Promise<void>;
  loginWithGoogle: (
    request: GoogleLoginRequest
  ) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
  getAccessToken: () => Promise<string | null>;
  syncUser: () => Promise<boolean>;
};
