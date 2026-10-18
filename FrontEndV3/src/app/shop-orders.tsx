import { requireAccess } from '../features/auth/components/requireAccess';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from 'react';
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

import { ENV } from '../config/env';
import { useAuth } from '../features/auth/context/AuthProvider';
import CustomerLayout from '../shared/components/layout/CustomerLayout';
import ScreenContainer from '../shared/components/layout/ScreenContainer';
import AppButton from '../shared/components/ui/AppButton';
import { colors, radius, spacing } from '../shared/theme';

type JsonObject = Record<string, unknown>;

type Shop = {
  id: string;
  name: string;
  role: string;
  status: string;
};

type Order = {
  id: string;
  code: string;
  status: string;
  receiverName: string;
  totalAmount: number | null;
};

type Filter = 'ALL' | 'PAID' | 'COMPLETED' | 'OTHER';

function obj(value: unknown): JsonObject | null {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    return null;
  }

  return value as JsonObject;
}

function str(
  value: unknown,
  ...keys: string[]
): string | null {
  const source = obj(value);

  if (!source) return null;

  for (const key of keys) {
    const field = source[key];

    if (
      typeof field === 'string' &&
      field.trim().length > 0
    ) {
      return field.trim();
    }
  }

  return null;
}

function num(
  value: unknown,
  ...keys: string[]
): number | null {
  const source = obj(value);

  if (!source) return null;

  for (const key of keys) {
    const field = source[key];

    if (
      typeof field === 'number' &&
      Number.isFinite(field)
    ) {
      return field;
    }
  }

  return null;
}

function listOf(value: unknown): unknown[] | null {
  if (Array.isArray(value)) {
    return value;
  }

  const source = obj(value);

  if (!source) return null;

  for (const key of [
    'items',
    'shops',
    'orders',
    'results',
    'records',
  ]) {
    if (Array.isArray(source[key])) {
      return source[key] as unknown[];
    }
  }

  if ('data' in source) {
    return listOf(source.data);
  }

  return null;
}

function shopOf(value: unknown): Shop | null {
  const source = obj(value);

  if (!source) return null;

  const nestedShop = obj(source.shop);

  const id =
    str(source, 'shopId') ??
    str(nestedShop, 'id', 'shopId') ??
    str(source, 'id');

  if (!id) return null;

  return {
    id,
    name:
      str(
        source,
        'shopName',
        'name'
      ) ??
      str(nestedShop, 'name', 'shopName') ??
      'Cửa hàng',
    role:
      str(
        source,
        'role',
        'memberRole',
        'shopRole'
      ) ??
      'STAFF',
    status:
      str(
        source,
        'status',
        'shopStatus'
      ) ??
      str(nestedShop, 'status') ??
      'ACTIVE',
  };
}

function orderOf(value: unknown): Order | null {
  const source = obj(value);

  if (!source) return null;

  const nestedOrder = obj(source.order);
  const data = nestedOrder ?? source;

  const id =
    str(data, 'id', 'orderId');

  if (!id) return null;

  return {
    id,
    code:
      str(
        data,
        'orderCode',
        'orderNumber',
        'code'
      ) ?? id,
    status:
      str(
        data,
        'status',
        'orderStatus'
      ) ?? '',
    receiverName:
      str(
        data,
        'receiverName',
        'customerName'
      ) ?? '',
    totalAmount:
      num(
        data,
        'totalAmount',
        'totalPrice',
        'total',
        'finalAmount'
      ),
  };
}

async function getApi(
  path: string,
  token: string
): Promise<unknown> {
  const base = ENV.apiUrl.replace(/\/+$/, '');

  const response = await fetch(`${base}${path}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  const raw = await response.text();

  let json: unknown;

  try {
    json = raw.trim()
      ? JSON.parse(raw)
      : null;
  } catch {
    throw new Error(
      'Backend trả về dữ liệu không hợp lệ.'
    );
  }

  const envelope = obj(json);

  if (
    !response.ok ||
    envelope?.success === false
  ) {
    throw new Error(
      str(envelope?.error, 'message') ||
      str(envelope, 'message') ||
      `HTTP ${response.status}`
    );
  }

  return envelope && 'data' in envelope
    ? envelope.data
    : json;
}

function money(amount: number | null): string {
  if (amount === null) {
    return 'Chưa có giá';
  }

  return new Intl.NumberFormat('vi-VN', {
    currency: 'VND',
    style: 'currency',
    maximumFractionDigits: 0,
  }).format(amount);
}

function statusLabel(status: string): string {
  switch (status.toUpperCase()) {
    case 'PAID':
      return 'Đã thanh toán';

    case 'COMPLETED':
      return 'Đã hoàn thành';

    case 'PENDING_PAYMENT':
      return 'Chờ thanh toán';

    case 'CANCELLED':
      return 'Đã hủy';

    case 'EXPIRED':
      return 'Hết hạn';

    default:
      return status || 'Chưa xác định';
  }
}

function roleLabel(role: string): string {
  switch (role.toUpperCase()) {
    case 'OWNER':
      return 'Chủ cửa hàng';

    case 'STAFF':
      return 'Nhân viên';

    default:
      return role || 'Chưa xác định';
  }
}

function shopStatusLabel(status: string): string {
  switch (status.toUpperCase()) {
    case 'APPROVED':
      return 'Đã duyệt';

    case 'ACTIVE':
      return 'Đang hoạt động';

    case 'PENDING':
      return 'Chờ duyệt';

    case 'LOCKED':
      return 'Đã khóa';

    case 'REJECTED':
      return 'Từ chối';

    default:
      return status || 'Chưa xác định';
  }
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number;
}) {
  return (
    <View style={styles.stat}>
      <Ionicons
        name={icon}
        size={23}
        color={colors.primary}
      />

      <Text style={styles.muted}>
        {label}
      </Text>

      <Text style={styles.statValue}>
        {value}
      </Text>
    </View>
  );
}

function Tool({
  icon,
  name,
  description,
  onPress,
  active,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  name: string;
  description: string;
  onPress?: () => void;
  active?: boolean;
}) {
  const content = (
    <>
      <View style={styles.toolIcon}>
        <Ionicons
          name={icon}
          size={25}
          color={
            onPress || active
              ? colors.primary
              : colors.textMuted
          }
        />
      </View>

      <Text style={styles.toolName}>
        {name}
      </Text>

      <Text style={styles.muted}>
        {description}
      </Text>

      {onPress && (
        <View style={styles.actionLink}>
          <Text style={styles.actionText}>
            Mở quản lý
          </Text>

          <Ionicons
            name="arrow-forward"
            size={17}
            color={colors.primary}
          />
        </View>
      )}

      {!onPress && active && (
        <View style={styles.currentTool}>
          <Ionicons
            name="checkmark-circle"
            size={16}
            color={colors.eco}
          />

          <Text style={styles.currentToolText}>
            Đang xem
          </Text>
        </View>
      )}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Mở quản lý ${name}`}
        onPress={onPress}
        style={[
          styles.tool,
          styles.toolActive,
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View
      style={[
        styles.tool,
        active && styles.toolActive,
      ]}
    >
      {content}
    </View>
  );
}

function ShopOrdersScreen() {
  const router = useRouter();

  const {
    user,
    status,
    getAccessToken,
  } = useAuth();

  const [shops, setShops] =
    useState<Shop[]>([]);

  const [shopId, setShopId] =
    useState('');

  const [orders, setOrders] =
    useState<Order[]>([]);

  const [loadingShops, setLoadingShops] =
    useState(false);

  const [loadingOrders, setLoadingOrders] =
    useState(false);

  const [error, setError] =
    useState('');

  const [formatError, setFormatError] =
    useState(false);

  const [filter, setFilter] =
    useState<Filter>('ALL');

  const [search, setSearch] =
    useState('');

  const loadShops = useCallback(async () => {
    if (status !== 'authenticated') {
      return;
    }

    setLoadingShops(true);
    setError('');

    try {
      const token =
        await getAccessToken();

      if (!token) {
        throw new Error(
          'Phiên đăng nhập đã hết hạn.'
        );
      }

      const response = await getApi(
        '/api/me/managed-shops',
        token
      );

      const list = listOf(response);

      if (!list) {
        throw new Error(
          'Không nhận diện danh sách cửa hàng.'
        );
      }

      const parsed = list
        .map(shopOf)
        .filter(
          (item): item is Shop =>
            item !== null
        );

      setShops(parsed);

      setShopId((previous) =>
        parsed.some(
          (shop) => shop.id === previous
        )
          ? previous
          : parsed[0]?.id ?? ''
      );
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Không thể tải cửa hàng.'
      );
    } finally {
      setLoadingShops(false);
    }
  }, [
    getAccessToken,
    status,
  ]);

  const loadOrders = useCallback(async () => {
    if (
      status !== 'authenticated' ||
      !shopId
    ) {
      return;
    }

    setLoadingOrders(true);
    setError('');
    setFormatError(false);

    try {
      const token =
        await getAccessToken();

      if (!token) {
        throw new Error(
          'Phiên đăng nhập đã hết hạn.'
        );
      }

      const response = await getApi(
        `/api/shops/${encodeURIComponent(shopId)}/orders`,
        token
      );

      const list = listOf(response);

      if (!list) {
        setOrders([]);
        setFormatError(true);
        return;
      }

      const parsed = list
        .map(orderOf)
        .filter(
          (item): item is Order =>
            item !== null
        );

      setOrders(parsed);

      setFormatError(
        list.length > 0 &&
        parsed.length === 0
      );
    } catch (caught: unknown) {
      setOrders([]);

      setError(
        caught instanceof Error
          ? caught.message
          : 'Không thể tải đơn hàng.'
      );
    } finally {
      setLoadingOrders(false);
    }
  }, [
    getAccessToken,
    shopId,
    status,
  ]);

  useEffect(() => {
    if (status === 'authenticated') {
      void loadShops();
    } else {
      setShops([]);
      setShopId('');
      setOrders([]);
    }
  }, [
    loadShops,
    status,
  ]);

  useEffect(() => {
    setOrders([]);
    setFilter('ALL');
    setSearch('');

    if (shopId) {
      void loadOrders();
    }
  }, [
    shopId,
    loadOrders,
  ]);

  const selectedShop = shops.find(
    (shop) => shop.id === shopId
  );

  const isOwner =
    selectedShop?.role.toUpperCase() === 'OWNER';

  const summary = useMemo(() => {
    const paid = orders.filter(
      (item) =>
        item.status.toUpperCase() === 'PAID'
    ).length;

    const completed = orders.filter(
      (item) =>
        item.status.toUpperCase() === 'COMPLETED'
    ).length;

    return {
      paid,
      completed,
      other:
        orders.length -
        paid -
        completed,
    };
  }, [orders]);

  const visibleOrders = useMemo(() => {
    const keyword =
      search.trim().toLowerCase();

    return orders.filter((order) => {
      const state =
        order.status.toUpperCase();

      const matchesFilter =
        filter === 'ALL' ||
        (
          filter === 'PAID' &&
          state === 'PAID'
        ) ||
        (
          filter === 'COMPLETED' &&
          state === 'COMPLETED'
        ) ||
        (
          filter === 'OTHER' &&
          state !== 'PAID' &&
          state !== 'COMPLETED'
        );

      const matchesSearch =
        !keyword ||
        order.code
          .toLowerCase()
          .includes(keyword) ||
        order.receiverName
          .toLowerCase()
          .includes(keyword);

      return matchesFilter && matchesSearch;
    });
  }, [
    filter,
    orders,
    search,
  ]);

  if (status === 'loading') {
    return (
      <CustomerLayout>
        <ScreenContainer style={styles.center}>
          <ActivityIndicator
            size="large"
            color={colors.primary}
          />
        </ScreenContainer>
      </CustomerLayout>
    );
  }

  if (status !== 'authenticated') {
    return (
      <CustomerLayout>
        <ScreenContainer style={styles.center}>
          <Text style={styles.title}>
            Đăng nhập để quản lý cửa hàng
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
        <View style={styles.header}>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>
              SAVIBITE · SHOP DASHBOARD
            </Text>

            <Text style={styles.title}>
              Quản lý cửa hàng
            </Text>

            <Text style={styles.muted}>
              Xin chào {user?.fullName}.
              {' '}Quản lý đơn, sản phẩm, ưu đãi
              và thành viên từ một nơi.
            </Text>
          </View>

          <AppButton
            title="Làm mới dữ liệu"
            variant="outline"
            disabled={
              loadingShops ||
              loadingOrders
            }
            onPress={() => {
              void loadShops();

              if (shopId) {
                void loadOrders();
              }
            }}
          />
        </View>

        {(loadingShops || loadingOrders) && (
          <ActivityIndicator
            size="large"
            color={colors.primary}
          />
        )}

        {!!error && (
          <View style={styles.panel}>
            <Text style={styles.error}>
              {error}
            </Text>
          </View>
        )}

        {shops.length > 0 && (
          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>
              Cửa hàng được quản lý
            </Text>

            {shops.map((shop) => (
              <Pressable
                key={shop.id}
                onPress={() =>
                  setShopId(shop.id)
                }
                style={[
                  styles.shopRow,
                  shop.id === shopId &&
                    styles.selectedShop,
                ]}
              >
                <Ionicons
                  name="storefront-outline"
                  size={24}
                  color={colors.primary}
                />

                <View style={styles.flex}>
                  <Text style={styles.shopName}>
                    {shop.name}
                  </Text>

                  <Text style={styles.muted}>
                    {roleLabel(shop.role)}
                    {' · '}
                    {shopStatusLabel(shop.status)}
                  </Text>
                </View>

                {shop.id === shopId && (
                  <Ionicons
                    name="checkmark-circle"
                    size={22}
                    color={colors.eco}
                  />
                )}
              </Pressable>
            ))}
          </View>
        )}

        {!loadingShops &&
          shops.length === 0 &&
          !error && (
            <View style={styles.panel}>
              <Text style={styles.muted}>
                Không có cửa hàng được quản lý.
              </Text>
            </View>
          )}

        {selectedShop && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Tổng quan hoạt động
              </Text>

              <Text style={styles.muted}>
                Số liệu dựa trên {orders.length}
                {' '}đơn API đã trả về,
                không phải thống kê toàn Database.
              </Text>

              <View style={styles.stats}>
                <Stat
                  icon="receipt-outline"
                  label="Đơn đã tải"
                  value={orders.length}
                />

                <Stat
                  icon="time-outline"
                  label="Đã thanh toán"
                  value={summary.paid}
                />

                <Stat
                  icon="checkmark-circle-outline"
                  label="Hoàn thành"
                  value={summary.completed}
                />

                <Stat
                  icon="ellipsis-horizontal-circle-outline"
                  label="Trạng thái khác"
                  value={summary.other}
                />
              </View>
            </View>

            <View style={styles.panel}>
              <View style={styles.sectionHeading}>
                <View style={styles.flex}>
                  <Text style={styles.sectionTitle}>
                    Trung tâm quản lý
                  </Text>

                  <Text style={styles.muted}>
                    Chọn chức năng cần thực hiện
                    với cửa hàng {selectedShop.name}.
                  </Text>
                </View>
              </View>

              <View style={styles.tools}>
                <Tool
                  icon="bag-handle-outline"
                  name="Đơn hàng & Pickup"
                  description="Xem đơn và xác nhận giao món ở danh sách bên dưới."
                  active
                />

                <Tool
                  icon="cube-outline"
                  name="Sản phẩm"
                  description="Danh sách, thêm, sửa, xóa và ảnh sản phẩm."
                  onPress={() =>
                    router.push({
                      pathname: '/products',
                      params: {
                        shopId: selectedShop.id,
                      },
                    })
                  }
                />

                <Tool
                  icon="flash-outline"
                  name="Flash Sale"
                  description="Tạo Flash Sale từ sản phẩm cửa hàng."
                  onPress={() =>
                    router.push({
                      pathname: '/flash-sales',
                      params: {
                        shopId: selectedShop.id,
                      },
                    })
                  }
                />

                <Tool
                  icon="gift-outline"
                  name="SaviBite Box"
                  description="Tạo và quản lý hộp thực phẩm bất ngờ với giá ưu đãi."
                  onPress={() =>
                    router.push({
                      pathname: '/savibite-boxes',
                      params: {
                        shopId: selectedShop.id,
                      },
                    })
                  }
                />

                <Tool
  icon="star-outline"
  name="Đánh giá cửa hàng"
  description="Xem điểm sao và nhận xét của khách hàng."
  onPress={() =>
    router.push({
      pathname: '/shop-reviews/[id]',
      params: {
        id: selectedShop.id,
      },
    })
  }
/>

                {isOwner && (
                  <Tool
                    icon="people-outline"
                    name="Thành viên cửa hàng"
                    description="Xem nhân viên, thêm bằng email, khóa, mở khóa và xóa thành viên."
                    onPress={() =>
                      router.push({
                        pathname: '/shop-members',
                        params: {
                          shopId: selectedShop.id,
                        },
                      })
                    }
                  />
                )}
              </View>

              {!isOwner && (
                <View style={styles.permissionNote}>
                  <Ionicons
                    name="information-circle-outline"
                    size={18}
                    color={colors.textSecondary}
                  />

                  <Text style={styles.mutedFlex}>
                    Quản lý thành viên chỉ dành cho
                    chủ cửa hàng (OWNER).
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.panel}>
              <Text style={styles.sectionTitle}>
                Danh sách đơn hàng
              </Text>

              <View style={styles.searchBox}>
                <Ionicons
                  name="search-outline"
                  size={20}
                  color={colors.textMuted}
                />

                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Tìm mã đơn hoặc tên khách..."
                  placeholderTextColor={colors.textMuted}
                  style={styles.searchInput}
                  autoCorrect={false}
                />

                {!!search && (
                  <Pressable
                    onPress={() => setSearch('')}
                    accessibilityLabel="Xóa từ khóa tìm kiếm"
                  >
                    <Ionicons
                      name="close-circle"
                      size={19}
                      color={colors.textMuted}
                    />
                  </Pressable>
                )}
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filters}
              >
                {([
                  ['ALL', 'Tất cả', orders.length],
                  ['PAID', 'Đã thanh toán', summary.paid],
                  [
                    'COMPLETED',
                    'Hoàn thành',
                    summary.completed,
                  ],
                  ['OTHER', 'Khác', summary.other],
                ] as [
                  Filter,
                  string,
                  number,
                ][]).map(
                  ([key, label, count]) => (
                    <Pressable
                      key={key}
                      onPress={() => setFilter(key)}
                      style={[
                        styles.filter,
                        filter === key &&
                          styles.activeFilter,
                      ]}
                    >
                      <Text
                        style={[
                          styles.filterText,
                          filter === key &&
                            styles.activeFilterText,
                        ]}
                      >
                        {label} ({count})
                      </Text>
                    </Pressable>
                  )
                )}
              </ScrollView>

              <Text style={styles.muted}>
                {visibleOrders.length}
                {' / '}
                {orders.length}
                {' '}đơn đang hiển thị
              </Text>

              {formatError && (
                <Text style={styles.error}>
                  Chưa nhận diện được cấu trúc
                  đơn hàng.
                </Text>
              )}

              <View style={styles.orderList}>
                {visibleOrders.map((order) => (
                  <Pressable
                    key={order.id}
                    style={styles.orderCard}
                    onPress={() =>
                      router.push({
                        pathname: '/shop-pickup/[id]',
                        params: {
                          id: order.id,
                          shopId: selectedShop.id,
                        },
                      })
                    }
                  >
                    <View style={styles.header}>
                      <View style={styles.flex}>
                        <Text style={styles.smallLabel}>
                          MÃ ĐƠN
                        </Text>

                        <Text style={styles.orderCode}>
                          {order.code}
                        </Text>
                      </View>

                      <Text style={styles.orderStatus}>
                        {statusLabel(order.status)}
                      </Text>
                    </View>

                    {!!order.receiverName && (
                      <Text style={styles.muted}>
                        Khách nhận:
                        {' '}
                        {order.receiverName}
                      </Text>
                    )}

                    <View style={styles.orderBottom}>
                      <Text style={styles.amount}>
                        {money(order.totalAmount)}
                      </Text>

                      <View style={styles.actionLink}>
                        <Text style={styles.actionText}>
                          {order.status.toUpperCase() === 'PAID'
                            ? 'Xử lý nhận hàng'
                            : 'Xem chi tiết'}
                        </Text>

                        <Ionicons
                          name="arrow-forward"
                          size={17}
                          color={colors.primary}
                        />
                      </View>
                    </View>
                  </Pressable>
                ))}

                {!loadingOrders &&
                  visibleOrders.length === 0 &&
                  !formatError && (
                    <View style={styles.emptyOrders}>
                      <Ionicons
                        name="receipt-outline"
                        size={30}
                        color={colors.textMuted}
                      />

                      <Text style={styles.muted}>
                        Không có đơn hàng phù hợp.
                      </Text>
                    </View>
                  )}
              </View>
            </View>
          </>
        )}
      </ScreenContainer>
    </CustomerLayout>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingTop: spacing.xxxl,
    paddingBottom: spacing.section,
    gap: spacing.xxl,
  },
  center: {
    minHeight: 450,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  flex: {
    flex: 1,
    gap: spacing.xs,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: colors.eco,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.text,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: colors.text,
  },
  sectionHeading: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  shopName: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  muted: {
    fontSize: 13,
    lineHeight: 21,
    color: colors.textSecondary,
  },
  mutedFlex: {
    flex: 1,
    fontSize: 13,
    lineHeight: 21,
    color: colors.textSecondary,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 21,
  },
  panel: {
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    gap: spacing.lg,
  },
  section: {
    gap: spacing.md,
  },
  shopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  selectedShop: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceMuted,
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  stat: {
    flexGrow: 1,
    flexBasis: '22%',
    minWidth: 150,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  statValue: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.primary,
  },
  tools: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  tool: {
    flexGrow: 1,
    flexBasis: '45%',
    minWidth: 180,
    padding: spacing.lg,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  toolActive: {
    borderColor: colors.primary,
  },
  toolIcon: {
    width: 45,
    height: 45,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toolName: {
    fontWeight: '800',
    fontSize: 15,
    color: colors.text,
  },
  actionLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  actionText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  currentTool: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  currentToolText: {
    color: colors.eco,
    fontWeight: '700',
    fontSize: 12,
  },
  permissionNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    minHeight: 47,
    flex: 1,
    color: colors.text,
    fontSize: 14,
  },
  filters: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  filter: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
  },
  activeFilter: {
    backgroundColor: colors.primary,
  },
  filterText: {
    fontWeight: '700',
    color: colors.textSecondary,
    fontSize: 12,
  },
  activeFilterText: {
    color: colors.white,
  },
  orderList: {
    gap: spacing.md,
  },
  orderCard: {
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  smallLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  orderCode: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  orderStatus: {
    color: colors.eco,
    fontSize: 12,
    fontWeight: '700',
  },
  orderBottom: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  amount: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.primary,
  },
  emptyOrders: {
    minHeight: 130,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
});

export default requireAccess(ShopOrdersScreen, 'login');
