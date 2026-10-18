import type { AuthSession } from '../types/auth.types';

const REFRESH_EARLY_MS = 60_000;

function expiresAfter(value: string, marginMs: number): boolean {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp > Date.now() + marginMs;
}

export function isAccessTokenValid(session: AuthSession): boolean {
  return expiresAfter(session.accessTokenExpiresAt, REFRESH_EARLY_MS);
}

export function isRefreshTokenValid(session: AuthSession): boolean {
  return expiresAfter(session.refreshTokenExpiresAt, 0);
}