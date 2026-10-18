
import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';

import CustomerLayout from '../../../shared/components/layout/CustomerLayout';
import ScreenContainer from '../../../shared/components/layout/ScreenContainer';
import AppButton from '../../../shared/components/ui/AppButton';
import {
  colors,
  radius,
  spacing,
} from '../../../shared/theme';

import { ENV } from '../../../config/env';
import { useAuth } from '../../auth/context/AuthProvider';
import {
  orderApi,
  OrderApiError,
} from '../api/order.api';

type DataObject = Record<string, unknown>;
type PaymentOutcome = 'SUCCESS' | 'FAILED';

function isObject(
  value: unknown
): value is DataObject {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

function field(
  object: unknown,
  ...keys: string[]
): unknown {
  if (!isObject(object)) return null;

  for (const key of keys) {
    const result = object[key];
    if (result !== undefined && result !== null) {
      return result;
    }
  }

  return null;
}

function textField(
  object: unknown,
  ...keys: string[]
): string | null {
  const value = field(object, ...keys);

  if (typeof value === 'string') {
    return value.trim() || null;
  }

  if (
    typeof value === 'number' &&
    Number.isFinite(value)
  ) {
    return String(value);
  }

  return null;
}

function getOrderData(response: unknown): unknown {
  const data = field(response, 'data');
  const order = field(response, 'order');

  if (isObject(order)) return order;
  if (isObject(data)) {
    const nested = field(data, 'order');
    return isObject(nested) ? nested : data;
  }

  return response;
}

function formatMoney(value: unknown): string | null {
  const amount =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : NaN;

  if (!Number.isFinite(amount)) return null;

  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(value: unknown): string | null {
  if (typeof value !== 'string' || !value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour12: false,
  }).format(date);
}

function statusLabel(value: string | null) {
  switch (value?.toUpperCase()) {
    case 'PENDING_PAYMENT':
      return 'Chờ thanh toán';
    case 'UNPAID':
      return 'Chưa thanh toán';
    case 'PAID':
      return 'Đã thanh toán';
    case 'READY_FOR_PICKUP':
      return 'Sẵn sàng nhận hàng';
    case 'COMPLETED':
      return 'Đã hoàn thành';
    case 'CANCELLED':
      return 'Đã hủy';
    case 'EXPIRED':
      return 'Đã hết hạn';
    case 'FAILED':
      return 'Thất bại';
    default:
      return value ?? 'Chưa xác định';
  }
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  if (!value) return null;

  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function getPickupResponse(
  response: unknown
): {
  code: string | null;
  expiresAt: string | null;
  message: string | null;
} {
  // Swagger chưa công bố schema response.
  // Chỉ nhận những trường mã phổ biến và có giá trị thực.
  const data = field(response, 'data');
  const pickup = field(response, 'pickup');

  const source = isObject(data)
    ? data
    : isObject(pickup)
      ? pickup
      : response;

  const nested = field(
    source,
    'pickupCodeInfo',
    'pickup',
    'pickupCode'
  );

  const nestedObject = isObject(nested) ? nested : null;

  const code =
    textField(
      source,
      'pickupCode',
      'code',
      'verificationCode'
    ) ??
    (nestedObject
      ? textField(
          nestedObject,
          'pickupCode',
          'code',
          'verificationCode',
          'value'
        )
      : null) ??
    (typeof nested === 'string' ? nested : null);

  return {
    code,
    expiresAt:
      textField(
        source,
        'expiresAt',
        'pickupCodeExpiresAt',
        'expiryTime'
      ) ??
      (nestedObject
        ? textField(
            nestedObject,
            'expiresAt',
            'pickupCodeExpiresAt'
          )
        : null),
    message: textField(source, 'message'),
  };
}

function getItems(order: unknown): unknown[] {
  const items = field(
    order,
    'items',
    'orderItems',
    'details'
  );

  return Array.isArray(items) ? items : [];
}

export default function OrderDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();

  const orderId =
    typeof params.id === 'string' ? params.id : '';

  const {
    status,
    getAccessToken,
  } = useAuth();

  const [order, setOrder] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [paying, setPaying] = useState(false);
  const [paymentMessage, setPaymentMessage] =
    useState('');
  const [paymentUncertain, setPaymentUncertain] =
    useState(false);

  const [pickupLoading, setPickupLoading] =
    useState(false);
  const [pickupCode, setPickupCode] =
    useState<string | null>(null);
  const [pickupExpiry, setPickupExpiry] =
    useState<string | null>(null);
  const [pickupMessage, setPickupMessage] =
    useState('');

  const paymentRequestRef = useRef<string | null>(
    null
  );
  const paymentPendingRef = useRef(false);
  const pickupPendingRef = useRef(false);

  const loadOrder = useCallback(async () => {
    if (!orderId || status !== 'authenticated') {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const token = await getAccessToken();

      if (!token) {
        throw new Error(
          'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
        );
      }

      const response = await orderApi.getDetail(
        token,
        orderId
      );

      setOrder(getOrderData(response));
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Không thể tải đơn hàng.'
      );
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, orderId, status]);

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  useEffect(() => {
    setPickupCode(null);
    setPickupExpiry(null);
    setPickupMessage('');
    setPaymentMessage('');
    setPaymentUncertain(false);
    paymentRequestRef.current = null;
  }, [orderId]);

  const handlePayment = async (
    outcome: PaymentOutcome
  ) => {
    if (
      paymentPendingRef.current ||
      paymentUncertain ||
      !orderId
    ) {
      return;
    }

    paymentPendingRef.current = true;
    setPaying(true);
    setPaymentMessage('');

    try {
      const token = await getAccessToken();

      if (!token) {
        throw new Error(
          'Phiên đăng nhập đã hết hạn.'
        );
      }

      const requestId =
        paymentRequestRef.current ??
        Crypto.randomUUID();

      paymentRequestRef.current = requestId;

      await orderApi.mockPayment(
        token,
        orderId,
        {
          requestId,
          outcome,
        }
      );

      paymentRequestRef.current = null;

      setPaymentMessage(
        outcome === 'SUCCESS'
          ? 'Backend đã ghi nhận thanh toán mô phỏng thành công.'
          : 'Backend đã ghi nhận thanh toán mô phỏng thất bại.'
      );

      await loadOrder();
    } catch (caught: unknown) {
      setPaymentMessage(
        caught instanceof Error
          ? caught.message
          : 'Không thể xác định kết quả thanh toán.'
      );

      if (
        !(caught instanceof OrderApiError) ||
        caught.code === 'NETWORK_ERROR' ||
        caught.code === 'INVALID_RESPONSE'
      ) {
        setPaymentUncertain(true);
      }
    } finally {
      paymentPendingRef.current = false;
      setPaying(false);
    }
  };

  const handlePickupCode = async () => {
    if (
      pickupPendingRef.current ||
      !orderId ||
      status !== 'authenticated'
    ) {
      return;
    }

    pickupPendingRef.current = true;
    setPickupLoading(true);
    setPickupMessage('');

    try {
      const token = await getAccessToken();

      if (!token) {
        throw new Error(
          'Phiên đăng nhập đã hết hạn.'
        );
      }

      const url =
        ENV.apiUrl.replace(/\/+$/, '') +
        `/api/orders/${encodeURIComponent(
          orderId
        )}/pickup-code`;

      // Endpoint chỉ yêu cầu orderId trên URL,
      // không có request body theo Swagger.
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      let json: unknown = null;

      try {
        json = await response.json();
      } catch {
        throw new Error(
          'Backend trả về dữ liệu mã nhận hàng không hợp lệ.'
        );
      }

      if (
        !response.ok ||
        (isObject(json) && json.success === false)
      ) {
        const apiError = field(json, 'error');
        const message =
          textField(apiError, 'message') ??
          textField(json, 'message') ??
          `Không thể lấy mã nhận hàng (HTTP ${response.status}).`;

        throw new Error(message);
      }

      const result = getPickupResponse(json);

      if (!result.code) {
        setPickupMessage(
          'Backend đã phản hồi thành công nhưng chưa nhận diện được trường mã nhận hàng. Cần kiểm tra cấu trúc response.'
        );
        return;
      }

      setPickupCode(result.code);
      setPickupExpiry(result.expiresAt);
      setPickupMessage(
        'Mã nhận hàng đã được Backend cấp. Chỉ cung cấp mã cho nhân viên cửa hàng khi đến nhận món.'
      );

      await loadOrder();
    } catch (caught: unknown) {
      setPickupMessage(
        caught instanceof Error
          ? caught.message
          : 'Không thể lấy mã nhận hàng.'
      );
    } finally {
      pickupPendingRef.current = false;
      setPickupLoading(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <CustomerLayout>
        <ScreenContainer style={styles.centered}>
          <ActivityIndicator
            size="large"
            color={colors.primary}
          />
          <Text style={styles.muted}>
            Đang tải đơn hàng...
          </Text>
        </ScreenContainer>
      </CustomerLayout>
    );
  }

  if (status !== 'authenticated') {
    return (
      <CustomerLayout>
        <ScreenContainer style={styles.centered}>
          <Ionicons
            name="lock-closed-outline"
            size={40}
            color={colors.primary}
          />
          <Text style={styles.title}>
            Đăng nhập để xem đơn hàng
          </Text>
          <AppButton
            title="Đăng nhập"
            onPress={() => router.push('/login')}
          />
        </ScreenContainer>
      </CustomerLayout>
    );
  }

  const orderStatus = textField(
    order,
    'status',
    'orderStatus'
  );

  const paymentStatus = textField(
    order,
    'paymentStatus'
  );

  const orderCode =
    textField(
      order,
      'orderCode',
      'orderNumber',
      'code'
    ) ?? orderId;

  const paid =
    orderStatus?.toUpperCase() === 'PAID' ||
    paymentStatus?.toUpperCase() === 'PAID';

  const completed =
    orderStatus?.toUpperCase() === 'COMPLETED';

  const cancelled =
    orderStatus?.toUpperCase() === 'CANCELLED' ||
    orderStatus?.toUpperCase() === 'EXPIRED';

  const canGetPickup =
    order !== null &&
    paid &&
    !completed &&
    !cancelled;

  const canPay =
    order !== null &&
    !paid &&
    !completed &&
    !cancelled &&
    !paymentUncertain &&
    (orderStatus?.toUpperCase() === 'PENDING_PAYMENT' ||
      paymentStatus?.toUpperCase() === 'UNPAID');

  const items = getItems(order);

  const shop = field(order, 'shop');

  const shopName =
    textField(order, 'shopName') ??
    textField(shop, 'name');

  const pickupStart = formatDate(
    field(order, 'pickupStartAt')
  );

  const pickupEnd = formatDate(
    field(order, 'pickupEndAt')
  );

  return (
    <CustomerLayout>
      <ScreenContainer style={styles.page}>
        <Pressable
          onPress={() => router.push('/orders')}
          style={styles.backLink}
        >
          <Ionicons
            name="arrow-back"
            size={18}
            color={colors.primary}
          />
          <Text style={styles.backText}>
            Quay lại đơn hàng
          </Text>
        </Pressable>

        <View style={styles.heading}>
          <View style={styles.iconBox}>
            <Ionicons
              name="receipt-outline"
              size={29}
              color={colors.primary}
            />
          </View>

          <Text style={styles.title}>
            Chi tiết đơn hàng
          </Text>

          <Text style={styles.orderCode} selectable>
            {orderCode}
          </Text>

          <View style={styles.statusTag}>
            <Text style={styles.statusText}>
              {statusLabel(orderStatus)}
            </Text>
          </View>
        </View>

        {!!error && (
          <View style={styles.errorPanel}>
            <Text style={styles.errorText}>
              {error}
            </Text>

            <AppButton
              title="Tải lại đơn hàng"
              variant="outline"
              onPress={() => {
                void loadOrder();
              }}
            />
          </View>
        )}

        {order !== null && (
          <>
            <View style={styles.panel}>
              <Text style={styles.sectionTitle}>
                Thông tin đơn hàng
              </Text>

              <DetailRow
                label="Mã đơn"
                value={orderCode}
              />
              <DetailRow
                label="Trạng thái"
                value={statusLabel(orderStatus)}
              />
              <DetailRow
                label="Thanh toán"
                value={statusLabel(paymentStatus)}
              />
              <DetailRow
                label="Cửa hàng"
                value={shopName}
              />
              <DetailRow
                label="Người nhận"
                value={textField(
                  order,
                  'receiverName'
                )}
              />
              <DetailRow
                label="Số điện thoại"
                value={textField(
                  order,
                  'receiverPhone'
                )}
              />
              <DetailRow
                label="Tổng tiền"
                value={formatMoney(
                  field(
                    order,
                    'totalAmount',
                    'totalPrice',
                    'total',
                    'finalAmount'
                  )
                )}
              />
            </View>

            {(pickupStart || pickupEnd) && (
              <View style={styles.panel}>
                <Text style={styles.sectionTitle}>
                  Thời gian nhận hàng
                </Text>

                <DetailRow
                  label="Bắt đầu"
                  value={pickupStart}
                />
                <DetailRow
                  label="Kết thúc"
                  value={pickupEnd}
                />

                <Text style={styles.muted}>
                  Đến nhận trực tiếp tại cửa hàng
                  trong thời gian quy định.
                </Text>
              </View>
            )}

            {items.length > 0 && (
              <View style={styles.panel}>
                <Text style={styles.sectionTitle}>
                  Sản phẩm đã đặt
                </Text>

                {items.map((item, index) => {
                  const product = field(
                    item,
                    'product'
                  );

                  const title =
                    textField(
                      item,
                      'offerTitle',
                      'productName',
                      'title',
                      'name'
                    ) ??
                    textField(product, 'name') ??
                    `Sản phẩm ${index + 1}`;

                  const quantity = textField(
                    item,
                    'quantity'
                  );

                  const price = formatMoney(
                    field(
                      item,
                      'unitPrice',
                      'salePrice',
                      'price'
                    )
                  );

                  const lineTotal = formatMoney(
                    field(
                      item,
                      'lineTotal',
                      'subtotal',
                      'totalAmount'
                    )
                  );

                  return (
                    <View
                      key={index}
                      style={styles.itemRow}
                    >
                      <View style={styles.itemInfo}>
                        <Text style={styles.itemTitle}>
                          {title}
                        </Text>

                        {quantity && (
                          <Text style={styles.muted}>
                            Số lượng: {quantity}
                          </Text>
                        )}

                        {price && (
                          <Text style={styles.muted}>
                            Đơn giá: {price}
                          </Text>
                        )}
                      </View>

                      {lineTotal && (
                        <Text style={styles.itemTotal}>
                          {lineTotal}
                        </Text>
                      )}
                    </View>
                  );
                })}
              </View>
            )}

            <View style={styles.panel}>
              <View style={styles.sectionHeading}>
                <Ionicons
                  name="key-outline"
                  size={22}
                  color={colors.primary}
                />
                <Text style={styles.sectionTitle}>
                  Mã nhận hàng
                </Text>
              </View>

              <Text style={styles.muted}>
                Khi đến cửa hàng, xuất trình mã
                nhận hàng cho nhân viên để xác nhận
                giao món.
              </Text>

              {pickupCode ? (
                <View style={styles.pickupCodeBox}>
                  <Text style={styles.pickupCodeLabel}>
                    MÃ NHẬN HÀNG CỦA BẠN
                  </Text>

                  <Text
                    style={styles.pickupCodeText}
                    selectable
                  >
                    {pickupCode}
                  </Text>

                  {pickupExpiry && (
                    <Text style={styles.muted}>
                      Hiệu lực đến:{' '}
                      {formatDate(pickupExpiry)}
                    </Text>
                  )}
                </View>
              ) : null}

              {canGetPickup && !pickupCode && (
                <AppButton
                  title={
                    pickupLoading
                      ? 'Đang lấy mã...'
                      : 'Lấy mã nhận hàng'
                  }
                  disabled={pickupLoading}
                  fullWidth
                  onPress={() => {
                    void handlePickupCode();
                  }}
                />
              )}

              {completed && (
                <Text style={styles.successText}>
                  Đơn hàng đã hoàn thành.
                </Text>
              )}

              {cancelled && (
                <Text style={styles.errorText}>
                  Đơn hàng đã hủy hoặc hết hạn.
                </Text>
              )}

              {!canGetPickup &&
                !completed &&
                !cancelled && (
                  <Text style={styles.muted}>
                    Mã nhận hàng chỉ được yêu cầu
                    sau khi đơn được ghi nhận thanh toán.
                  </Text>
                )}

              {!!pickupMessage && (
                <Text style={styles.message}>
                  {pickupMessage}
                </Text>
              )}
            </View>

            {canPay && (
              <View style={styles.panel}>
                <Text style={styles.sectionTitle}>
                  Thanh toán mô phỏng
                </Text>

                <Text style={styles.muted}>
                  Chức năng chỉ dành cho môi trường
                  Development. Không thực hiện
                  thanh toán tiền thật.
                </Text>

                <AppButton
                  title={
                    paying
                      ? 'Đang xử lý...'
                      : 'Mô phỏng thanh toán thành công'
                  }
                  disabled={paying}
                  fullWidth
                  onPress={() => {
                    void handlePayment('SUCCESS');
                  }}
                />

                <AppButton
                  title="Mô phỏng thanh toán thất bại"
                  variant="outline"
                  disabled={paying}
                  fullWidth
                  onPress={() => {
                    void handlePayment('FAILED');
                  }}
                />
              </View>
            )}

            {!!paymentMessage && (
              <View style={styles.panel}>
                <Text style={styles.message}>
                  {paymentMessage}
                </Text>
              </View>
            )}

            <AppButton
              title="Làm mới trạng thái đơn"
              variant="outline"
              fullWidth
              onPress={() => {
                void loadOrder();
              }}
            />
          </>
        )}
      </ScreenContainer>
    </CustomerLayout>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingTop: spacing.xxl,
    paddingBottom: spacing.section,
    gap: spacing.xl,
  },
  centered: {
    minHeight: 430,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.sm,
  },
  backText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  heading: {
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  iconBox: {
    width: 58,
    height: 58,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 29,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.6,
  },
  orderCode: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  statusTag: {
    backgroundColor: '#EAF6E4',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.eco,
  },
  panel: {
    backgroundColor: colors.surface,
    padding: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.lg,
    shadowColor: colors.text,
    shadowOpacity: 0.04,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 1,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  detailLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  muted: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 22,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  itemInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  itemTotal: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 15,
  },
  pickupCodeBox: {
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pickupCodeLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '700',
    letterSpacing: 1,
  },
  pickupCodeText: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 2,
    textAlign: 'center',
  },
  successText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.eco,
  },
  errorPanel: {
    backgroundColor: colors.surfaceMuted,
    padding: spacing.lg,
    borderRadius: radius.md,
    gap: spacing.md,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 21,
  },
  message: {
    fontSize: 13,
    lineHeight: 22,
    color: colors.textSecondary,
  },
});
