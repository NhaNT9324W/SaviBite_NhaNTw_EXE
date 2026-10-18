
import { ENV } from '../../../config/env';

import type {
    CreateOrderRequest,
    MockPaymentRequest,
    UnknownOrderResponse,
} from '../types/order.types';

type ApiResponse<T> = {
  success: boolean;
  data?: T | null;
  message?: string;
  error?:
    | {
        code?: string;
        message?: string;
      }
    | null;
};

export class OrderApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'OrderApiError';
  }
}

async function request<T>(
  path: string,
  method: 'GET' | 'POST',
  accessToken: string,
  body?: unknown
): Promise<T> {
  if (!accessToken) {
    throw new OrderApiError(
      'Bạn cần đăng nhập trước khi thực hiện thao tác này.',
      401,
      'AUTH_REQUIRED'
    );
  }

  const baseUrl = ENV.apiUrl.replace(/\/+$/, '');

  if (!baseUrl) {
    throw new OrderApiError(
      'Chưa cấu hình EXPO_PUBLIC_API_URL.',
      0,
      'CONFIG_ERROR'
    );
  }

  let response: Response;

  try {
    response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
        ...(body !== undefined
          ? { 'Content-Type': 'application/json' }
          : {}),
      },
      ...(body !== undefined
        ? { body: JSON.stringify(body) }
        : {}),
    });
  } catch {
    throw new OrderApiError(
      'Không thể xác nhận kết quả từ máy chủ. Đơn hàng có thể đã được tạo; vui lòng kiểm tra trước khi thử lại.',
      0,
      'NETWORK_ERROR'
    );
  }

  let json: ApiResponse<T>;

  try {
    json = (await response.json()) as ApiResponse<T>;
  } catch {
    throw new OrderApiError(
      'Máy chủ trả về dữ liệu không hợp lệ. Không nên gửi lại yêu cầu khi chưa kiểm tra đơn hàng.',
      response.status,
      'INVALID_RESPONSE'
    );
  }

  if (!response.ok || !json.success) {
    throw new OrderApiError(
      json.error?.message ??
        json.message ??
        'Thao tác đơn hàng thất bại.',
      response.status,
      json.error?.code
    );
  }

  return json.data as T;
}

export const orderApi = {
  create(
    accessToken: string,
    data: CreateOrderRequest
  ): Promise<UnknownOrderResponse> {
    return request<UnknownOrderResponse>(
      '/api/orders',
      'POST',
      accessToken,
      data
    );
  },

  getDetail(
    accessToken: string,
    orderId: string
  ): Promise<UnknownOrderResponse> {
    return request<UnknownOrderResponse>(
      `/api/orders/${encodeURIComponent(orderId)}`,
      'GET',
      accessToken
    );
  },

  mockPayment(
    accessToken: string,
    orderId: string,
    data: MockPaymentRequest
  ): Promise<UnknownOrderResponse> {
    return request<UnknownOrderResponse>(
      `/api/orders/${encodeURIComponent(orderId)}/mock-payment`,
      'POST',
      accessToken,
      data
    );
  },
};
