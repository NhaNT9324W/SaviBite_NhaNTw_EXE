import styles from './ShopPickupScreen.styles';
import { requireAccess } from '../../../features/auth/components/requireAccess';
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
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

import { ENV } from '../../../config/env';
import { useAuth } from '../../../features/auth/context/AuthProvider';
import CustomerLayout from '../../../shared/components/layout/CustomerLayout';
import ScreenContainer from '../../../shared/components/layout/ScreenContainer';
import AppButton from '../../../shared/components/ui/AppButton';
import { colors, radius, spacing } from '../../../shared/theme';

type JsonObject = Record<string, unknown>;

type OrderInfo = {
  id: string;
  orderCode: string;
  status: string;
  paymentStatus: string;
  receiverName: string | null;
  receiverPhone: string | null;
  totalAmount: number | null;
  shopName: string | null;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PICKUP_CODE_REGEX = /^[A-Za-z2-9]{12}$/;

function asObject(value: unknown): JsonObject | null {
  return value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

function text(
  value: unknown,
  ...keys: string[]
): string | null {
  const object = asObject(value);
  if (!object) return null;

  for (const key of keys) {
    const field = object[key];
    if (typeof field === 'string' && field.trim()) {
      return field.trim();
    }
  }

  return null;
}

function amount(
  value: unknown,
  ...keys: string[]
): number | null {
  const object = asObject(value);
  if (!object) return null;

  for (const key of keys) {
    const field = object[key];
    if (typeof field === 'number' && Number.isFinite(field)) {
      return field;
    }
  }

  return null;
}

function unwrap(value: unknown): unknown {
  const object = asObject(value);
  return object && 'data' in object ? object.data : value;
}

function normalizeOrder(
  value: unknown,
  fallbackId: string
): OrderInfo | null {
  const object = asObject(value);
  if (!object) return null;

  const nestedOrder = asObject(object.order);
  const source = nestedOrder ?? object;
  const shop = asObject(source.shop);

  return {
    id: text(source, 'id', 'orderId') ?? fallbackId,
    orderCode:
      text(source, 'orderCode', 'orderNumber', 'code') ??
      fallbackId,
    status: text(source, 'status', 'orderStatus') ?? '',
    paymentStatus: text(source, 'paymentStatus') ?? '',
    receiverName: text(
      source,
      'receiverName',
      'customerName'
    ),
    receiverPhone: text(source, 'receiverPhone'),
    totalAmount: amount(
      source,
      'totalAmount',
      'totalPrice',
      'total',
      'finalAmount'
    ),
    shopName:
      text(source, 'shopName') ??
      text(shop, 'name'),
  };
}

function money(value: number | null) {
  if (value === null) return 'Chưa có thông tin';

  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
}

function statusLabel(value: string) {
  switch (value.toUpperCase()) {
    case 'PAID': return 'Đã thanh toán';
    case 'COMPLETED': return 'Đã hoàn thành';
    case 'PENDING_PAYMENT': return 'Chờ thanh toán';
    case 'CANCELLED': return 'Đã hủy';
    case 'EXPIRED': return 'Đã hết hạn';
    case 'UNPAID': return 'Chưa thanh toán';
    case 'READY_FOR_PICKUP': return 'Chờ nhận hàng';
    default: return value || 'Chưa xác định';
  }
}

function InfoLine({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  if (!value) return null;

  return (
    <View style={styles.infoLine}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

async function parseResponse(
  response: Response
): Promise<unknown> {
  let json: unknown;

  try {
    json = await response.json();
  } catch {
    throw new Error(
      'Backend trả về phản hồi không hợp lệ.'
    );
  }

  const envelope = asObject(json);

  if (!response.ok || envelope?.success === false) {
    const apiError = asObject(envelope?.error);

    throw new Error(
      text(apiError, 'message') ??
      text(envelope, 'message') ??
      `Backend trả về HTTP ${response.status}.`
    );
  }

  return unwrap(json);
}

function ShopPickupScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id?: string;
    shopId?: string;
  }>();

  const orderId =
    typeof params.id === 'string' ? params.id : '';

  const shopId =
    typeof params.shopId === 'string' ? params.shopId : '';

  const { status, getAccessToken } = useAuth();

  const [order, setOrder] = useState<OrderInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [pickupCode, setPickupCode] = useState('');
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resultMessage, setResultMessage] = useState('');
  const [resultUncertain, setResultUncertain] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const requestIdRef = useRef<string | null>(null);
  const submittingRef = useRef(false);

  const validIds =
    UUID_REGEX.test(orderId) &&
    UUID_REGEX.test(shopId);

  const loadOrder = useCallback(async () => {
    if (status !== 'authenticated' || !validIds) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const token = await getAccessToken();

      if (!token) {
        throw new Error(
          'Phiên đăng nhập đã hết hạn.'
        );
      }

      const url =
        ENV.apiUrl.replace(/\/+$/, '') +
        `/api/shops/${encodeURIComponent(shopId)}` +
        `/orders/${encodeURIComponent(orderId)}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await parseResponse(response);
      const parsed = normalizeOrder(json, orderId);

      if (!parsed) {
        throw new Error(
          'Không nhận diện được dữ liệu chi tiết đơn hàng.'
        );
      }

      setOrder(parsed);

      if (parsed.status.toUpperCase() === 'COMPLETED') {
        setConfirmed(true);
      }
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Không thể tải đơn hàng.'
      );
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, orderId, shopId, status, validIds]);

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  useEffect(() => {
    setPickupCode('');
    setConfirmVisible(false);
    setResultMessage('');
    setResultUncertain(false);
    setConfirmed(false);
    requestIdRef.current = null;
  }, [orderId, shopId]);

  const code = pickupCode.trim();

  const isCompleted =
    order?.status.toUpperCase() === 'COMPLETED';

  const isPaid =
    order?.status.toUpperCase() === 'PAID' &&
    order?.paymentStatus.toUpperCase() === 'PAID';

  const canConfirm =
    !!order &&
    isPaid &&
    !isCompleted &&
    !confirmed &&
    !submitting &&
    !resultUncertain &&
    validIds &&
    PICKUP_CODE_REGEX.test(code);

  const handleConfirm = async () => {
    if (
      !canConfirm ||
      submittingRef.current
    ) {
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setConfirmVisible(false);
    setResultMessage('');

    try {
      const token = await getAccessToken();

      if (!token) {
        throw new Error(
          'Phiên đăng nhập đã hết hạn.'
        );
      }

      const requestId =
        requestIdRef.current ??
        Crypto.randomUUID();

      requestIdRef.current = requestId;

      const url =
        ENV.apiUrl.replace(/\/+$/, '') +
        `/api/shops/${encodeURIComponent(shopId)}` +
        `/orders/${encodeURIComponent(orderId)}/pickup`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          requestId,
          code,
        }),
      });

      await parseResponse(response);

      // Chỉ xem là đã xác nhận khi Backend trả về thành công.
      setConfirmed(true);
      setResultUncertain(false);
      setResultMessage(
        'Backend đã xác nhận giao hàng thành công.'
      );

      setPickupCode('');
      requestIdRef.current = null;

      // Lấy lại trạng thái chính thức sau giao hàng.
      await loadOrder();
    } catch (caught: unknown) {
      if (caught instanceof TypeError) {
        // Mạng lỗi: có thể Backend đã xử lý thành công.
        setResultUncertain(true);
        setResultMessage(
          'Không thể xác nhận kết quả do lỗi kết nối. ' +
          'Hãy làm mới trạng thái đơn trước khi thực hiện lại.'
        );
      } else {
        setResultMessage(
          caught instanceof Error
            ? caught.message
            : 'Xác nhận giao hàng thất bại.'
        );
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <CustomerLayout>
        <ScreenContainer style={styles.center}>
          <ActivityIndicator
            size="large"
            color={colors.primary}
          />
          <Text style={styles.muted}>
            Đang tải thông tin đơn hàng...
          </Text>
        </ScreenContainer>
      </CustomerLayout>
    );
  }

  if (status !== 'authenticated') {
    return (
      <CustomerLayout>
        <ScreenContainer style={styles.center}>
          <Text style={styles.title}>
            Đăng nhập để xác nhận nhận hàng
          </Text>

          <AppButton
            title="Đăng nhập"
            onPress={() => router.push('/login')}
          />
        </ScreenContainer>
      </CustomerLayout>
    );
  }

  if (!validIds) {
    return (
      <CustomerLayout>
        <ScreenContainer style={styles.center}>
          <Text style={styles.title}>
            Đường dẫn đơn hàng không hợp lệ
          </Text>

          <AppButton
            title="Quay lại danh sách"
            onPress={() => router.push('/shop-orders')}
          />
        </ScreenContainer>
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout>
      <ScreenContainer style={styles.page}>
        <Pressable
          onPress={() => router.push('/shop-orders')}
          style={styles.backLink}
        >
          <Ionicons
            name="arrow-back"
            size={18}
            color={colors.primary}
          />

          <Text style={styles.backText}>
            Quay lại đơn hàng cửa hàng
          </Text>
        </Pressable>

        <View style={styles.heading}>
          <Text style={styles.eyebrow}>
            SAVIBITE · SHOP PICKUP
          </Text>
          <Text style={styles.title}>
            Xác nhận giao món
          </Text>
          <Text style={styles.muted}>
            Kiểm tra đơn hàng và nhập mã khách cung cấp.
          </Text>
        </View>

        {!!error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>
              {error}
            </Text>

            <AppButton
              title="Tải lại đơn"
              variant="outline"
              onPress={() => {
                void loadOrder();
              }}
            />
          </View>
        )}

        {order && (
          <>
            <View style={styles.panel}>
              <View style={styles.panelTop}>
                <View style={styles.flex}>
                  <Text style={styles.smallLabel}>
                    MÃ ĐƠN HÀNG
                  </Text>
                  <Text style={styles.orderCode}>
                    {order.orderCode}
                  </Text>
                </View>

                <View
                  style={[
                    styles.statusBadge,
                    isCompleted && styles.completedBadge,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      isCompleted && styles.completedText,
                    ]}
                  >
                    {statusLabel(order.status)}
                  </Text>
                </View>
              </View>

              <View style={styles.divider} />

              <InfoLine
                label="Cửa hàng"
                value={order.shopName}
              />
              <InfoLine
                label="Người nhận"
                value={order.receiverName}
              />
              <InfoLine
                label="Số điện thoại"
                value={order.receiverPhone}
              />
              <InfoLine
                label="Thanh toán"
                value={statusLabel(order.paymentStatus)}
              />
              <InfoLine
                label="Tổng tiền"
                value={money(order.totalAmount)}
              />
            </View>

            <View style={styles.panel}>
              <View style={styles.sectionTitleRow}>
                <Ionicons
                  name="key-outline"
                  size={22}
                  color={colors.primary}
                />

                <Text style={styles.sectionTitle}>
                  Mã nhận hàng
                </Text>
              </View>

              {isCompleted || confirmed ? (
                <View style={styles.successBox}>
                  <Ionicons
                    name="checkmark-circle"
                    size={24}
                    color={colors.eco}
                  />

                  <Text style={styles.successText}>
                    Đơn đã được xác nhận giao hàng.
                  </Text>
                </View>
              ) : !isPaid ? (
                <View style={styles.warningBox}>
                  <Ionicons
                    name="information-circle-outline"
                    size={21}
                    color={colors.warning}
                  />

                  <Text style={styles.warningText}>
                    Đơn chưa có trạng thái đơn PAID và thanh
                    toán PAID. Frontend không cho xác nhận
                    giao món ở trạng thái hiện tại.
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={styles.muted}>
                    Yêu cầu khách cung cấp mã nhận hàng
                    được cấp trong ứng dụng SaviBite.
                  </Text>

                  <View style={styles.field}>
                    <Text style={styles.label}>
                      Nhập mã nhận hàng (12 ký tự)
                    </Text>

                    <TextInput
                      value={pickupCode}
                      onChangeText={(value) => {
                        setPickupCode(value.replace(/\s/g, ''));
                        setResultMessage('');
                        requestIdRef.current = null;
                      }}
                      placeholder="Nhập mã khách cung cấp"
                      placeholderTextColor={colors.textMuted}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      maxLength={12}
                      editable={!submitting && !resultUncertain}
                      style={styles.input}
                      accessibilityLabel="Mã nhận hàng"
                    />

                    <Text style={styles.helper}>
                      {code.length}/12 ký tự · Chấp nhận
                      A–Z, a–z và 2–9.
                    </Text>
                  </View>

                  {code.length > 0 &&
                    !PICKUP_CODE_REGEX.test(code) && (
                      <Text style={styles.errorText}>
                        Mã phải có đúng 12 ký tự và không
                        chứa 0, 1 hoặc ký tự đặc biệt.
                      </Text>
                    )}

                  <AppButton
                    title={
                      submitting
                        ? 'Đang xác nhận...'
                        : 'Xác nhận giao hàng'
                    }
                    disabled={!canConfirm}
                    fullWidth
                    onPress={() => setConfirmVisible(true)}
                  />
                </>
              )}

              {!!resultMessage && (
                <View style={styles.messageBox}>
                  <Text
                    style={
                      confirmed
                        ? styles.successText
                        : styles.warningText
                    }
                  >
                    {resultMessage}
                  </Text>
                </View>
              )}
            </View>

            <AppButton
              title="Làm mới trạng thái đơn"
              variant="outline"
              onPress={() => {
                void loadOrder();
              }}
            />
          </>
        )}
      </ScreenContainer>

      <Modal
        visible={confirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalPanel}>
            <Text style={styles.sectionTitle}>
              Xác nhận đã giao món?
            </Text>

            <Text style={styles.muted}>
              Bạn đang xác nhận khách đã nhận món
              của đơn {order?.orderCode ?? orderId}.
              Backend sẽ kiểm tra mã và điều kiện nhận hàng.
            </Text>

            <View style={styles.modalActions}>
              <AppButton
                title="Hủy"
                variant="outline"
                onPress={() => setConfirmVisible(false)}
              />

              <AppButton
                title="Xác nhận"
                onPress={() => {
                  void handleConfirm();
                }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </CustomerLayout>
  );
}



export default requireAccess(ShopPickupScreen, 'login');
