
import { ENV } from '../../config/env';

export type ApiError = {
  code?: string;
  message?: string;
};

export type ApiResponse<T> = {
  success: boolean;
  data?: T | null;
  message?: string;
  error?: ApiError | null;
};

export class ApiRequestError extends Error {
  status: number;
  code?: string;

  constructor(
    message: string,
    status: number,
    code?: string
  ) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
  }
}

export async function apiGet<T>(
  path: string,
  signal?: AbortSignal
): Promise<T> {
  const baseUrl = ENV.apiUrl.replace(/\/+$/, '');

  if (!baseUrl) {
    throw new Error(
      'Chưa cấu hình EXPO_PUBLIC_API_URL.'
    );
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    signal,
  });

  let body: ApiResponse<T> | null = null;

  try {
    body = (await response.json()) as ApiResponse<T>;
  } catch {
    throw new ApiRequestError(
      'Server không trả về JSON hợp lệ.',
      response.status
    );
  }

  if (!response.ok || !body.success) {
    throw new ApiRequestError(
      body.error?.message ??
        body.message ??
        `API gặp lỗi HTTP ${response.status}.`,
      response.status,
      body.error?.code
    );
  }

  if (body.data === null || body.data === undefined) {
    throw new ApiRequestError(
      'API không trả về dữ liệu.',
      response.status
    );
  }

  return body.data;
}
