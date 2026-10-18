import { ENV } from '../../config/env';

export type ApiError = {
  code?: string;
  message?: string;
  details?: unknown;
};

export type ApiResponse<T> = {
  success: boolean;
  data?: T | null;
  message?: string;
  error?: ApiError | null;
};

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

type ApiMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type ApiOptions = {
  method?: ApiMethod;
  body?: unknown;
  accessToken?: string | null;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  allowNullData?: boolean;
};

/**
 * Chá»‰ nháº­n Ä‘Æ°á»ng dáº«n ná»™i bá»™ /api/...; khÃ´ng gá»­i token Ä‘áº¿n URL tÃ¹y Ã½.
 * Pháº§n refresh token tiáº¿p tá»¥c do AuthProvider hiá»‡n táº¡i phá»¥ trÃ¡ch.
 */
export async function apiRequest<T>(
  path: string,
  options: ApiOptions = {}
): Promise<T> {
  const baseUrl = ENV.apiUrl.trim().replace(/\/+$/, '');
  if (!baseUrl) {
    throw new ApiRequestError('ChÆ°a cáº¥u hÃ¬nh EXPO_PUBLIC_API_URL.', 0, 'CONFIG_ERROR');
  }
  if (!path.startsWith('/api/') || path.startsWith('//')) {
    throw new ApiRequestError('ÄÆ°á»ng dáº«n API khÃ´ng há»£p lá»‡.', 0, 'INVALID_API_PATH');
  }

  const { method = 'GET', body, accessToken, signal, headers, allowNullData = false } = options;
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...headers,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ApiRequestError('KhÃ´ng thá»ƒ káº¿t ná»‘i Ä‘áº¿n mÃ¡y chá»§ SaviBite.', 0, 'NETWORK_ERROR');
  }

  const text = await response.text();
  let envelope: ApiResponse<T>;
  try {
    envelope = JSON.parse(text) as ApiResponse<T>;
  } catch {
    throw new ApiRequestError('MÃ¡y chá»§ khÃ´ng tráº£ vá» JSON há»£p lá»‡.', response.status, 'INVALID_RESPONSE');
  }
  if (!envelope || typeof envelope !== 'object' || typeof envelope.success !== 'boolean') {
    throw new ApiRequestError('Cáº¥u trÃºc pháº£n há»“i API khÃ´ng há»£p lá»‡.', response.status, 'INVALID_RESPONSE');
  }
  if (!response.ok || !envelope.success) {
    throw new ApiRequestError(
      envelope.error?.message ?? envelope.message ?? `API gáº·p lá»—i HTTP ${response.status}.`,
      response.status,
      envelope.error?.code
    );
  }
  if (envelope.data === undefined || envelope.data === null) {
    if (allowNullData) return null as T;
    throw new ApiRequestError('API khÃ´ng tráº£ vá» dá»¯ liá»‡u.', response.status, 'EMPTY_RESPONSE');
  }
  return envelope.data;
}

/** API GET cÅ© váº«n giá»¯ nguyÃªn chá»¯ kÃ½ Ä‘á»ƒ khÃ´ng lÃ m há»ng cÃ¡c screen Ä‘ang dÃ¹ng. */
export function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  return apiRequest<T>(path, { method: 'GET', signal });
}