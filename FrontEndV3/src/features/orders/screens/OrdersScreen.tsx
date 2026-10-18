
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
    useCallback,
    useEffect,
    useState,
} from 'react';
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    View,
    useWindowDimensions
} from 'react-native';

import CustomerLayout from '../../../shared/components/layout/CustomerLayout';
import ScreenContainer from '../../../shared/components/layout/ScreenContainer';
import AppButton from '../../../shared/components/ui/AppButton';
import {
    colors,
    layout,
    radius,
    spacing,
} from '../../../shared/theme';

import { ENV } from '../../../config/env';
import { useAuth } from '../../../features/auth/context/AuthProvider';

type UnknownObject = Record<string, unknown>;

type OrderCardData = {
  id: string;
  code: string;
  status: string | null;
  paymentStatus: string | null;
  shopName: string | null;
  totalAmount: number | null;
  createdAt: string | null;
  pickupStartAt: string | null;
  pickupEndAt: string | null;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isObject(
  value: unknown
): value is UnknownObject {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

function readString(
  object: UnknownObject,
  ...keys: string[]
): string | null {
  for (const key of keys) {
    const value = object[key];

    if (
      typeof value === 'string' &&
      value.trim().length > 0
    ) {
      return value;
    }
  }

  return null;
}

function readNumber(
  object: UnknownObject,
  ...keys: string[]
): number | null {
  for (const key of keys) {
    const value = object[key];

    if (
      typeof value === 'number' &&
      Number.isFinite(value)
    ) {
      return value;
    }
  }

  return null;
}

function findArray(
  value: unknown,
  depth = 0
): unknown[] | null {
  if (Array.isArray(value)) {
    return value;
  }

  if (!isObject(value) || depth >= 4) {
    return null;
  }

  // Hỗ trợ các envelope thường dùng,
  // nhưng không tự coi object bất kỳ là một đơn hàng.
  for (const key of [
    'items',
    'orders',
    'pickupOrders',
    'results',
    'data',
  ]) {
    if (!(key in value)) {
      continue;
    }

    const found = findArray(value[key], depth + 1);

    if (found) {
      return found;
    }
  }

  return null;
}

function normalizeOrder(
  value: unknown
): OrderCardData | null {
  if (!isObject(value)) {
    return null;
  }

  const id = readString(value, 'id', 'orderId');

  if (!id || !UUID_PATTERN.test(id)) {
    return null;
  }

  const nestedShop = isObject(value.shop)
    ? value.shop
    : null;

  return {
    id,
    code:
      readString(
        value,
        'orderCode',
        'orderNumber',
        'code'
      ) ?? id,

    status: readString(
      value,
      'status',
      'orderStatus'
    ),

    paymentStatus: readString(
      value,
      'paymentStatus'
    ),

    shopName:
      readString(value, 'shopName') ??
      (nestedShop
        ? readString(nestedShop, 'name')
        : null),

    totalAmount: readNumber(
      value,
      'totalAmount',
      'totalPrice',
      'finalAmount',
      'total'
    ),

    createdAt: readString(
      value,
      'createdAt',
      'placedAt',
      'orderDate'
    ),

    pickupStartAt: readString(
      value,
      'pickupStartAt'
    ),

    pickupEndAt: readString(
      value,
      'pickupEndAt'
    ),
  };
}

function money(value: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
}

function dateText(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function statusLabel(value: string | null): string {
  switch (value?.toUpperCase()) {
    case 'PENDING_PAYMENT':
      return 'Chờ thanh toán';
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
    case 'UNPAID':
      return 'Chưa thanh toán';
    case 'FAILED':
      return 'Thanh toán thất bại';
    default:
      return value ?? 'Chưa có trạng thái';
  }
}

function OrderCard({
  order,
  onPress,
}: {
  order: OrderCardData;
  onPress: () => void;
}) {
  const isPaid =
    order.status === 'PAID' ||
    order.paymentStatus === 'PAID';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.orderCard,
        pressed && styles.pressedCard,
      ]}
    >
      <View style={styles.cardTop}>
        <View style={styles.cardCodeArea}>
          <Ionicons
            name="receipt-outline"
            size={21}
            color={colors.primary}
          />

          <View style={styles.cardCodeContent}>
            <Text style={styles.codeCaption}>
              Mã đơn hàng
            </Text>
            <Text
              style={styles.orderCode}
              selectable
            >
              {order.code}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.statusPill,
            isPaid && styles.paidPill,
          ]}
        >
          <Text
            style={[
              styles.statusText,
              isPaid && styles.paidText,
            ]}
          >
            {statusLabel(order.status)}
          </Text>
        </View>
      </View>

      <View style={styles.cardDivider} />

      {order.shopName && (
        <View style={styles.detailLine}>
          <Ionicons
            name="storefront-outline"
            size={17}
            color={colors.textSecondary}
          />
          <Text style={styles.detailText}>
            {order.shopName}
          </Text>
        </View>
      )}

      {order.createdAt && (
        <View style={styles.detailLine}>
          <Ionicons
            name="calendar-outline"
            size={17}
            color={colors.textSecondary}
          />
          <Text style={styles.detailText}>
            Đặt lúc: {dateText(order.createdAt)}
          </Text>
        </View>
      )}

      {order.pickupStartAt && (
        <View style={styles.detailLine}>
          <Ionicons
            name="time-outline"
            size={17}
            color={colors.textSecondary}
          />

          <Text style={styles.detailText}>
            Nhận hàng: {dateText(order.pickupStartAt)}
            {order.pickupEndAt
              ? ` – ${dateText(order.pickupEndAt)}`
              : ''}
          </Text>
        </View>
      )}

      {order.paymentStatus && (
        <View style={styles.detailLine}>
          <Ionicons
            name="card-outline"
            size={17}
            color={colors.textSecondary}
          />

          <Text style={styles.detailText}>
            Thanh toán:{' '}
            {statusLabel(order.paymentStatus)}
          </Text>
        </View>
      )}

      <View style={styles.cardBottom}>
        <View style={styles.amountArea}>
          <Text style={styles.amountCaption}>
            Tổng đơn hàng
          </Text>

          <Text style={styles.amount}>
            {order.totalAmount !== null
              ? money(order.totalAmount)
              : 'Xem chi tiết'}
          </Text>
        </View>

        <View style={styles.detailAction}>
          <Text style={styles.detailActionText}>
            Xem đơn
          </Text>
          <Ionicons
            name="arrow-forward"
            size={17}
            color={colors.primary}
          />
        </View>
      </View>
    </Pressable>
  );
}

export default function OrdersScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();

  const {
    status,
    isAuthenticated,
    getAccessToken,
  } = useAuth();

  const [orders, setOrders] =
    useState<OrderCardData[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [unknownFormat, setUnknownFormat] =
    useState(false);

  const desktop = width >= layout.breakpoint.desktop;

  const loadOrders = useCallback(async () => {
    if (status !== 'authenticated') {
      return;
    }

    setLoading(true);
    setError('');
    setUnknownFormat(false);

    try {
      const token = await getAccessToken();

      if (!token) {
        throw new Error(
          'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
        );
      }

      const url =
        ENV.apiUrl.replace(/\/+$/, '') +
        '/api/me/pickup-orders';

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const json: unknown = await response.json();

      if (!response.ok) {
        if (isObject(json)) {
          const apiError = json.error;

          if (isObject(apiError)) {
            const message = readString(
              apiError,
              'message'
            );

            if (message) {
              throw new Error(message);
            }
          }

          const message = readString(
            json,
            'message'
          );

          if (message) {
            throw new Error(message);
          }
        }

        throw new Error(
          `Không thể tải đơn hàng (HTTP ${response.status}).`
        );
      }

      if (
        isObject(json) &&
        json.success === false
      ) {
        throw new Error(
          readString(json, 'message') ??
            'Backend không thể tải danh sách đơn hàng.'
        );
      }

      const list = findArray(json);

      if (!list) {
        setOrders([]);
        setUnknownFormat(true);
        return;
      }

      const normalized = list
        .map(normalizeOrder)
        .filter(
          (item): item is OrderCardData =>
            item !== null
        );

      setOrders(normalized);

      if (
        list.length > 0 &&
        normalized.length === 0
      ) {
        setUnknownFormat(true);
      }
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Đã xảy ra lỗi khi tải đơn hàng.'
      );
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, status]);

  useEffect(() => {
    if (status === 'authenticated') {
      void loadOrders();
    } else {
      setOrders([]);
    }
  }, [loadOrders, status]);

  if (status === 'loading') {
    return (
      <CustomerLayout>
        <ScreenContainer style={styles.centered}>
          <ActivityIndicator
            size="large"
            color={colors.primary}
          />
          <Text style={styles.description}>
            Đang kiểm tra tài khoản...
          </Text>
        </ScreenContainer>
      </CustomerLayout>
    );
  }

  if (!isAuthenticated) {
    return (
      <CustomerLayout>
        <ScreenContainer style={styles.centered}>
          <View style={styles.emptyIcon}>
            <Ionicons
              name="lock-closed-outline"
              size={38}
              color={colors.primary}
            />
          </View>

          <Text style={styles.pageTitle}>
            Đăng nhập để xem đơn hàng
          </Text>

          <Text style={styles.description}>
            Các đơn hàng được bảo vệ theo tài khoản.
            Vui lòng đăng nhập để xem đơn của bạn.
          </Text>

          <AppButton
            title="Đăng nhập"
            onPress={() => router.push('/login')}
          />
        </ScreenContainer>
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout>
      <ScreenContainer style={styles.page}>
        <View style={styles.heading}>
          <View style={styles.headingText}>
            <Text style={styles.eyebrow}>
              SAVIBITE · MY ORDERS
            </Text>

            <Text style={styles.pageTitle}>
              Đơn hàng của tôi
            </Text>

            <Text style={styles.description}>
              Theo dõi trạng thái đặt hàng,
              thanh toán và nhận món tại cửa hàng.
            </Text>
          </View>

          <AppButton
            title={loading ? 'Đang tải...' : 'Làm mới'}
            variant="outline"
            disabled={loading}
            onPress={() => {
              void loadOrders();
            }}
          />
        </View>

        {loading && orders.length === 0 ? (
          <View style={styles.centeredSmall}>
            <ActivityIndicator
              size="large"
              color={colors.primary}
            />
            <Text style={styles.description}>
              Đang lấy danh sách đơn từ Backend...
            </Text>
          </View>
        ) : error ? (
          <View style={styles.noticePanel}>
            <Ionicons
              name="alert-circle-outline"
              size={24}
              color={colors.danger}
            />

            <Text style={styles.errorText}>
              {error}
            </Text>

            <AppButton
              title="Thử lại"
              onPress={() => {
                void loadOrders();
              }}
            />
          </View>
        ) : unknownFormat ? (
          <View style={styles.noticePanel}>
            <Ionicons
              name="information-circle-outline"
              size={28}
              color={colors.primary}
            />

            <Text style={styles.sectionTitle}>
              Cần bổ sung cấu trúc dữ liệu đơn hàng
            </Text>

            <Text style={styles.description}>
              Backend đã phản hồi, nhưng cấu trúc danh sách
              chưa khớp với những trường có thể nhận diện.
              Không hiển thị dữ liệu tự suy đoán.
            </Text>
          </View>
        ) : orders.length === 0 ? (
          <View style={styles.centeredSmall}>
            <View style={styles.emptyIcon}>
              <Ionicons
                name="receipt-outline"
                size={40}
                color={colors.textMuted}
              />
            </View>

            <Text style={styles.sectionTitle}>
              Chưa có đơn nhận hàng
            </Text>

            <Text style={styles.description}>
              Hiện API chưa trả về đơn nào trong danh sách
              nhận hàng của tài khoản này.
            </Text>

            <AppButton
              title="Khám phá ưu đãi"
              onPress={() => router.push('/offers')}
            />
          </View>
        ) : (
          <>
            <View style={styles.listHeading}>
              <Text style={styles.sectionTitle}>
                Danh sách nhận hàng
              </Text>

              <Text style={styles.description}>
                {orders.length} đơn đang hiển thị
              </Text>
            </View>

            <View
              style={[
                styles.ordersGrid,
                desktop && styles.ordersGridDesktop,
              ]}
            >
              {orders.map((order) => (
                <View
                  key={order.id}
                  style={[
                    styles.orderColumn,
                    desktop && styles.orderColumnDesktop,
                  ]}
                >
                  <OrderCard
                    order={order}
                    onPress={() => {
                      router.push({
                        pathname: '/order/[id]',
                        params: { id: order.id },
                      });
                    }}
                  />
                </View>
              ))}
            </View>
          </>
        )}

        <Pressable
          onPress={() => router.push('/offers')}
          style={styles.browseLink}
        >
          <Ionicons
            name="arrow-back"
            size={17}
            color={colors.primary}
          />

          <Text style={styles.browseText}>
            Tiếp tục khám phá ưu đãi
          </Text>
        </Pressable>
      </ScreenContainer>
    </CustomerLayout>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingTop: spacing.xxxl,
    paddingBottom: spacing.section,
    gap: spacing.xl,
  },
  heading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xl,
  },
  headingText: {
    flex: 1,
    gap: spacing.sm,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: colors.eco,
  },
  pageTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.text,
  },
  description: {
    fontSize: 14,
    lineHeight: 23,
    color: colors.textSecondary,
  },
  listHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '800',
  },
  ordersGrid: {
    gap: spacing.lg,
  },
  ordersGridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  orderColumn: {
    width: '100%',
  },
  orderColumnDesktop: {
    width: '48%',
  },
  orderCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  pressedCard: {
    opacity: 0.82,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  cardCodeArea: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
    flex: 1,
  },
  cardCodeContent: {
    flex: 1,
    gap: spacing.xs,
  },
  codeCaption: {
    color: colors.textMuted,
    fontSize: 12,
  },
  orderCode: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 21,
  },
  statusPill: {
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  paidPill: {
    backgroundColor: '#EAF6E4',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textSecondary,
  },
  paidText: {
    color: colors.eco,
  },
  cardDivider: {
    height: 1,
    backgroundColor: colors.border,
  },
  detailLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  detailText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 21,
    color: colors.textSecondary,
  },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  amountArea: {
    gap: spacing.xs,
  },
  amountCaption: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  amount: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.primary,
  },
  detailAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  detailActionText: {
    fontWeight: '700',
    fontSize: 13,
    color: colors.primary,
  },
  centered: {
    minHeight: 470,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  centeredSmall: {
    minHeight: 340,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  emptyIcon: {
    height: 85,
    width: 85,
    borderRadius: 44,
    backgroundColor: colors.surfaceMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noticePanel: {
    padding: spacing.xxl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    alignItems: 'flex-start',
    gap: spacing.lg,
  },
  errorText: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.danger,
  },
  browseLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.sm,
  },
  browseText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
});
