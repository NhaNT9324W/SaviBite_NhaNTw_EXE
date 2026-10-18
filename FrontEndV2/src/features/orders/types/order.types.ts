
export type CreateOrderItemRequest = {
  offerId: string;
  quantity: number;
  expectedUnitPrice: number;
};

export type CreateOrderRequest = {
  requestId: string;
  receiverName: string;
  receiverPhone: string;
  note?: string | null;
  items: CreateOrderItemRequest[];
};

export type PaymentOutcome = 'SUCCESS' | 'FAILED';

export type MockPaymentRequest = {
  requestId: string;
  outcome: PaymentOutcome;
};

export type UnknownOrderResponse = unknown;

export function isValidReceiverPhone(
  value: string
): boolean {
  return /^\+?[0-9]{9,15}$/.test(value);
}

export function validateOrderReceiver(
  receiverName: string,
  receiverPhone: string,
  note: string
): string | null {
  const name = receiverName.trim();
  const phone = receiverPhone.trim();

  if (!name) {
    return 'Vui lòng nhập tên người nhận.';
  }

  if (name.length > 100) {
    return 'Tên người nhận không được vượt quá 100 ký tự.';
  }

  if (!isValidReceiverPhone(phone)) {
    return 'Số điện thoại phải có từ 9 đến 15 chữ số, có thể bắt đầu bằng dấu +.';
  }

  if (note.length > 1000) {
    return 'Ghi chú không được vượt quá 1.000 ký tự.';
  }

  return null;
}

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

function getString(
  value: Record<string, unknown>,
  key: string
): string | null {
  const field = value[key];
  return typeof field === 'string' ? field : null;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Backend chưa khai báo response schema cho GET/POST Order.
 * Chỉ lấy UUID khi response thật có trường id/orderId.
 * Không tự dựng ra một ID đơn hàng.
 */
export function extractOrderId(
  response: unknown
): string | null {
  if (!isRecord(response)) {
    return null;
  }

  const direct =
    getString(response, 'id') ??
    getString(response, 'orderId');

  if (direct && UUID_PATTERN.test(direct)) {
    return direct;
  }

  const nested = response.order;

  if (isRecord(nested)) {
    return extractOrderId(nested);
  }

  const data = response.data;

  if (isRecord(data)) {
    return extractOrderId(data);
  }

  return null;
}

export function getOrderText(
  response: unknown,
  keys: string[]
): string | null {
  if (!isRecord(response)) {
    return null;
  }

  for (const key of keys) {
    const value = response[key];

    if (
      typeof value === 'string' ||
      typeof value === 'number'
    ) {
      return String(value);
    }
  }

  return null;
}
