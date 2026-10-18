import { requireAccess } from '../features/auth/components/requireAccess';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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

const UI = {
  primary: '#07549B',
  primarySoft: '#EAF3FC',
  background: '#F7FAFD',
  surface: '#FFFFFF',
  text: '#182D49',
  muted: '#708299',
  border: '#DFE7F0',
  success: '#23844B',
  successBg: '#E9F7EF',
  danger: '#C63737',
  dangerBg: '#FDEDED',
  warning: '#916000',
  warningBg: '#FFF4DA',
};

const LIMIT = 10;

type Dict = Record<string, unknown>;
type ShopFilter =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'ALL';

type Decision = 'approve' | 'reject';

type AdminShop = {
  id: string;
  name: string;
  status: string;
  address: string;
  phone: string;
  email: string;
  description: string;
  ownerName: string;
  ownerEmail: string;
  createdAt: string | null;
  updatedAt: string | null;
  reviewedAt: string | null;
  reviewNote: string;
};

function asObject(value: unknown): Dict | null {
  return value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
    ? (value as Dict)
    : null;
}

function getText(
  value: unknown,
  ...keys: string[]
): string | null {
  const source = asObject(value);

  for (const key of keys) {
    const entry = source?.[key];

    if (
      typeof entry === 'string' &&
      entry.trim().length > 0
    ) {
      return entry.trim();
    }
  }

  return null;
}

function getNumber(
  value: unknown,
  ...keys: string[]
): number | null {
  const source = asObject(value);

  for (const key of keys) {
    const entry = source?.[key];

    if (
      typeof entry === 'number' &&
      Number.isFinite(entry)
    ) {
      return entry;
    }

    if (
      typeof entry === 'string' &&
      entry.trim() !== ''
    ) {
      const converted = Number(entry);

      if (Number.isFinite(converted)) {
        return converted;
      }
    }
  }

  return null;
}

function unwrap(value: unknown): unknown {
  const root = asObject(value);

  return root && 'data' in root
    ? root.data
    : value;
}

function listFrom(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  const root = asObject(value);

  if (!root) {
    return [];
  }

  for (const key of [
    'items',
    'shops',
    'results',
    'records',
  ]) {
    if (Array.isArray(root[key])) {
      return root[key] as unknown[];
    }
  }

  if ('data' in root) {
    return listFrom(root.data);
  }

  return [];
}

function normalizeShop(
  value: unknown
): AdminShop | null {
  const root = asObject(value);

  if (!root) {
    return null;
  }

  const shop = asObject(root.shop) ?? root;
  const owner =
    asObject(shop.owner) ??
    asObject(root.owner);

  const id =
    getText(shop, 'id', 'shopId') ??
    getText(root, 'shopId');

  if (!id) {
    return null;
  }

  const review =
    asObject(shop.review) ??
    asObject(root.review);

  return {
    id,
    name:
      getText(
        shop,
        'name',
        'shopName',
        'businessName'
      ) ??
      getText(root, 'shopName') ??
      'Cửa hàng chưa cập nhật tên',
    status: (
      getText(
        shop,
        'status',
        'approvalStatus',
        'shopStatus'
      ) ??
      getText(
        root,
        'status',
        'approvalStatus'
      ) ??
      'UNKNOWN'
    ).toUpperCase(),
    address:
      getText(
        shop,
        'address',
        'fullAddress',
        'shopAddress'
      ) ??
      getText(root, 'address') ??
      'Chưa cập nhật',
    phone:
      getText(
        shop,
        'phone',
        'phoneNumber',
        'contactPhone'
      ) ??
      getText(root, 'phone') ??
      'Chưa cập nhật',
    email:
      getText(
        shop,
        'email',
        'contactEmail'
      ) ??
      getText(root, 'email') ??
      'Chưa cập nhật',
    description:
      getText(
        shop,
        'description',
        'shopDescription'
      ) ??
      'Chưa có mô tả',
    ownerName:
      getText(
        shop,
        'ownerName',
        'ownerFullName'
      ) ??
      getText(
        root,
        'ownerName',
        'ownerFullName'
      ) ??
      getText(owner, 'fullName', 'name') ??
      'Chưa có thông tin',
    ownerEmail:
      getText(shop, 'ownerEmail') ??
      getText(root, 'ownerEmail') ??
      getText(owner, 'email') ??
      'Chưa có thông tin',
    createdAt:
      getText(shop, 'createdAt') ??
      getText(root, 'createdAt'),
    updatedAt:
      getText(shop, 'updatedAt') ??
      getText(root, 'updatedAt'),
    reviewedAt:
      getText(
        shop,
        'reviewedAt',
        'approvedAt',
        'rejectedAt'
      ) ??
      getText(
        root,
        'reviewedAt',
        'approvedAt',
        'rejectedAt'
      ),
    reviewNote:
      getText(
        shop,
        'reviewNote',
        'resolutionNote',
        'rejectionReason'
      ) ??
      getText(
        root,
        'reviewNote',
        'resolutionNote'
      ) ??
      getText(review, 'note') ??
      '',
  };
}

function mergeShop(
  summary: AdminShop,
  detail: AdminShop
): AdminShop {
  return {
    ...summary,
    ...detail,
    name:
      detail.name !==
      'Cửa hàng chưa cập nhật tên'
        ? detail.name
        : summary.name,
    address:
      detail.address !== 'Chưa cập nhật'
        ? detail.address
        : summary.address,
    phone:
      detail.phone !== 'Chưa cập nhật'
        ? detail.phone
        : summary.phone,
    email:
      detail.email !== 'Chưa cập nhật'
        ? detail.email
        : summary.email,
    ownerName:
      detail.ownerName !== 'Chưa có thông tin'
        ? detail.ownerName
        : summary.ownerName,
    ownerEmail:
      detail.ownerEmail !== 'Chưa có thông tin'
        ? detail.ownerEmail
        : summary.ownerEmail,
    createdAt:
      detail.createdAt ?? summary.createdAt,
    updatedAt:
      detail.updatedAt ?? summary.updatedAt,
    reviewedAt:
      detail.reviewedAt ?? summary.reviewedAt,
    reviewNote:
      detail.reviewNote || summary.reviewNote,
  };
}

function statusLabel(status: string): string {
  switch (status.toUpperCase()) {
    case 'PENDING':
      return 'Chờ phê duyệt';
    case 'APPROVED':
      return 'Đã phê duyệt';
    case 'REJECTED':
      return 'Đã từ chối';
    case 'ACTIVE':
      return 'Đang hoạt động';
    case 'SUSPENDED':
      return 'Tạm ngừng';
    default:
      return status;
  }
}

function dateLabel(value: string | null): string {
  if (!value) {
    return 'Chưa có thông tin';
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('vi-VN', {
        hour12: false,
      });
}

function getError(
  error: unknown,
  fallback: string
): string {
  return error instanceof Error
    ? error.message
    : fallback;
}

async function readResponse(
  response: Response
): Promise<unknown> {
  const raw = await response.text();

  let result: unknown = null;

  if (raw.trim()) {
    try {
      result = JSON.parse(raw);
    } catch {
      throw new Error(
        `Backend trả về dữ liệu không hợp lệ (HTTP ${response.status}).`
      );
    }
  }

  const root = asObject(result);
  const error = asObject(root?.error);

  if (
    !response.ok ||
    root?.success === false
  ) {
    throw new Error(
      getText(error, 'message', 'detail') ??
      getText(root, 'message', 'detail') ??
      `Yêu cầu thất bại (HTTP ${response.status}).`
    );
  }

  return unwrap(result);
}

function Field({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>
        {label}
      </Text>
      <Text style={styles.fieldValue}>
        {value}
      </Text>
    </View>
  );
}

function AdminShopsScreen() {
  const router = useRouter();

  const {
    user,
    status,
    getAccessToken,
  } = useAuth();

  const isAdmin =
    status === 'authenticated' &&
    user?.systemRole?.toUpperCase() === 'ADMIN';

  const [shops, setShops] = useState<AdminShop[]>([]);
  const [filter, setFilter] =
    useState<ShopFilter>('PENDING');

  const [keyword, setKeyword] = useState('');
  const [appliedKeyword, setAppliedKeyword] =
    useState('');

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasNext, setHasNext] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [selected, setSelected] =
    useState<AdminShop | null>(null);

  const [detailLoading, setDetailLoading] =
    useState(false);

  const [detailError, setDetailError] =
    useState('');

  const [decision, setDecision] =
    useState<Decision | null>(null);

  const [note, setNote] = useState('');
  const [actionError, setActionError] =
    useState('');

  const [submitting, setSubmitting] =
    useState(false);

  const detailVersion = useRef(0);
  const listVersion = useRef(0);
  const submittingRef = useRef(false);

  const apiRequest = useCallback(
    async (
      path: string,
      options?: {
        method?: 'GET' | 'POST';
        body?: unknown;
      }
    ): Promise<unknown> => {
      const token = await getAccessToken();

      if (!token) {
        throw new Error(
          'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
        );
      }

      const headers: Record<string, string> = {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      };

      if (options?.body !== undefined) {
        headers['Content-Type'] =
          'application/json';
      }

      const response = await fetch(
        `${ENV.apiUrl.replace(/\/+$/, '')}${path}`,
        {
          method: options?.method ?? 'GET',
          headers,
          body:
            options?.body !== undefined
              ? JSON.stringify(options.body)
              : undefined,
        }
      );

      return readResponse(response);
    },
    [getAccessToken]
  );

  const loadShops = useCallback(
    async (
      targetPage: number,
      targetFilter: ShopFilter,
      search: string
    ) => {
      if (!isAdmin) {
        return;
      }

      const version = ++listVersion.current;

      setLoading(true);
      setError('');

      try {
        const params = new URLSearchParams({
          status: targetFilter,
          keyword: search,
          page: String(targetPage),
          limit: String(LIMIT),
        });

        const result = await apiRequest(
          `/api/admin/shops?${params.toString()}`
        );

        if (version !== listVersion.current) {
          return;
        }

        const raw = listFrom(result);
        const data = raw
          .map(normalizeShop)
          .filter(
            (item): item is AdminShop =>
              item !== null
          );

        const root = asObject(result);
        const pagination =
          asObject(root?.pagination) ??
          asObject(root?.meta);

        const pages =
          getNumber(
            root,
            'totalPages',
            'pageCount'
          ) ??
          getNumber(
            pagination,
            'totalPages',
            'pageCount'
          );

        const total =
          getNumber(
            root,
            'totalCount',
            'totalItems',
            'total'
          ) ??
          getNumber(
            pagination,
            'totalCount',
            'totalItems',
            'total'
          );

        const nextFlag =
          typeof root?.hasNextPage === 'boolean'
            ? root.hasNextPage
            : typeof pagination?.hasNextPage ===
                'boolean'
              ? pagination.hasNextPage
              : null;

        const calculatedPages =
          pages ??
          (
            total !== null
              ? Math.ceil(total / LIMIT)
              : targetPage +
                (raw.length === LIMIT ? 1 : 0)
          );

        setShops(data);
        setPage(targetPage);
        setTotalPages(
          Math.max(1, calculatedPages)
        );

        setHasNext(
          nextFlag ??
          (
            pages !== null || total !== null
              ? targetPage <
                Math.max(1, calculatedPages)
              : raw.length === LIMIT
          )
        );

        if (
          raw.length > 0 &&
          data.length === 0
        ) {
          setError(
            'Backend trả về danh sách nhưng chưa nhận diện được dữ liệu cửa hàng.'
          );
        }
      } catch (caught: unknown) {
        if (version !== listVersion.current) {
          return;
        }

        setShops([]);
        setError(
          getError(
            caught,
            'Không thể tải danh sách cửa hàng.'
          )
        );
      } finally {
        if (version === listVersion.current) {
          setLoading(false);
        }
      }
    },
    [apiRequest, isAdmin]
  );

  useEffect(() => {
    if (isAdmin) {
      void loadShops(1, 'PENDING', '');
    }
  }, [isAdmin, loadShops]);

  const changeFilter = (value: ShopFilter) => {
    setFilter(value);
    setPage(1);
    setNotice('');
    void loadShops(1, value, appliedKeyword);
  };

  const searchShops = () => {
    const value = keyword.trim();
    setAppliedKeyword(value);
    setPage(1);
    setNotice('');
    void loadShops(1, filter, value);
  };

  const openDetail = async (shop: AdminShop) => {
    const version = ++detailVersion.current;

    setSelected(shop);
    setDetailLoading(true);
    setDetailError('');
    setDecision(null);
    setNote('');
    setActionError('');

    try {
      const result = await apiRequest(
        `/api/admin/shops/${encodeURIComponent(shop.id)}`
      );

      if (version !== detailVersion.current) {
        return;
      }

      const detail = normalizeShop(result);

      if (!detail) {
        setDetailError(
          'Backend chưa trả về chi tiết cửa hàng hợp lệ.'
        );
        return;
      }

      if (
        detail.id.toLowerCase() !==
        shop.id.toLowerCase()
      ) {
        setDetailError(
          'Backend trả về chi tiết của cửa hàng khác.'
        );
        return;
      }

      setSelected(mergeShop(shop, detail));
    } catch (caught: unknown) {
      if (version !== detailVersion.current) {
        return;
      }

      setDetailError(
        getError(
          caught,
          'Không thể tải chi tiết cửa hàng.'
        )
      );
    } finally {
      if (version === detailVersion.current) {
        setDetailLoading(false);
      }
    }
  };

  const closeDetail = () => {
    if (submittingRef.current) {
      return;
    }

    detailVersion.current += 1;
    setSelected(null);
    setDecision(null);
    setNote('');
    setDetailError('');
    setActionError('');
  };

  const beginDecision = (value: Decision) => {
    if (
      !selected ||
      selected.status !== 'PENDING' ||
      detailLoading ||
      detailError ||
      submittingRef.current
    ) {
      return;
    }

    setDecision(value);
    setNote('');
    setActionError('');
  };

  const confirmDecision = async () => {
    if (
      !selected ||
      !decision ||
      selected.status !== 'PENDING' ||
      submittingRef.current
    ) {
      return;
    }

    const cleanNote = note.trim();

    if (cleanNote.length === 0) {
      setActionError(
        'Vui lòng nhập ghi chú xử lý.'
      );
      return;
    }

    const target = selected;
    const action = decision;

    submittingRef.current = true;
    setSubmitting(true);
    setActionError('');

    try {
      await apiRequest(
        `/api/admin/shops/${encodeURIComponent(target.id)}/${action}`,
        {
          method: 'POST',
          body: {
            note: cleanNote,
          },
        }
      );

      detailVersion.current += 1;
      setSelected(null);
      setDecision(null);
      setNote('');

      setNotice(
        action === 'approve'
          ? `Backend đã phê duyệt cửa hàng ${target.name}.`
          : `Backend đã từ chối cửa hàng ${target.name}.`
      );

      await loadShops(
        page,
        filter,
        appliedKeyword
      );
    } catch (caught: unknown) {
      setActionError(
        getError(
          caught,
          'Không thể xử lý yêu cầu cửa hàng.'
        )
      );
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  if (status === 'loading') {
    return (
      <CustomerLayout>
        <ScreenContainer style={styles.center}>
          <ActivityIndicator
            size="large"
            color={UI.primary}
          />
          <Text style={styles.muted}>
            Đang xác thực tài khoản...
          </Text>
        </ScreenContainer>
      </CustomerLayout>
    );
  }

  if (!isAdmin) {
    return (
      <CustomerLayout>
        <ScreenContainer style={styles.center}>
          <Ionicons
            name="shield-outline"
            size={44}
            color={UI.muted}
          />
          <Text style={styles.title}>
            Không có quyền truy cập
          </Text>
          <Text style={styles.muted}>
            Chức năng này chỉ dành cho quản trị viên.
          </Text>

          <Pressable
            style={styles.primaryButton}
            onPress={() =>
              router.replace(
                status === 'authenticated'
                  ? '/'
                  : '/login'
              )
            }
          >
            <Text style={styles.primaryButtonText}>
              {status === 'authenticated'
                ? 'Về trang chủ'
                : 'Đăng nhập'}
            </Text>
          </Pressable>
        </ScreenContainer>
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout>
      <ScreenContainer style={styles.page}>
        <Pressable
          style={styles.backLink}
          onPress={() => router.push('/')}
        >
          <Ionicons
            name="arrow-back"
            size={18}
            color={UI.primary}
          />
          <Text style={styles.linkText}>
            Quay lại trang chủ
          </Text>
        </Pressable>

        <View style={styles.heading}>
          <View style={styles.headingIcon}>
            <Ionicons
              name="storefront-outline"
              size={28}
              color={UI.primary}
            />
          </View>

          <Text style={styles.eyebrow}>
            SAVIBITE · ADMIN SHOPS
          </Text>

          <Text style={styles.title}>
            Quản lý cửa hàng
          </Text>

          <Text style={styles.muted}>
            Xét duyệt cửa hàng đăng ký tham gia
            SaviBite, kiểm tra thông tin và ghi nhận
            quyết định của quản trị viên.
          </Text>
        </View>

        {!!notice && (
          <View style={styles.successBox}>
            <Ionicons
              name="checkmark-circle-outline"
              size={20}
              color={UI.success}
            />
            <Text style={styles.successText}>
              {notice}
            </Text>
          </View>
        )}

        {!!error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>
              {error}
            </Text>
          </View>
        )}

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>
            Danh sách cửa hàng
          </Text>

          <View style={styles.tabs}>
            {(
              [
                ['PENDING', 'Chờ phê duyệt'],
                ['APPROVED', 'Đã duyệt'],
                ['REJECTED', 'Đã từ chối'],
                ['ALL', 'Tất cả'],
              ] as const
            ).map(([value, label]) => (
              <Pressable
                key={value}
                disabled={loading}
                style={[
                  styles.tab,
                  filter === value &&
                    styles.selectedTab,
                ]}
                onPress={() => changeFilter(value)}
              >
                <Text
                  style={[
                    styles.tabText,
                    filter === value &&
                      styles.selectedTabText,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.searchRow}>
            <View style={styles.searchBox}>
              <Ionicons
                name="search-outline"
                size={19}
                color={UI.muted}
              />
              <TextInput
                style={styles.searchInput}
                value={keyword}
                onChangeText={setKeyword}
                placeholder="Tìm tên cửa hàng, địa chỉ..."
                placeholderTextColor={UI.muted}
                returnKeyType="search"
                onSubmitEditing={searchShops}
              />
            </View>

            <Pressable
              style={styles.primaryButton}
              disabled={loading}
              onPress={searchShops}
            >
              <Text style={styles.primaryButtonText}>
                Tìm kiếm
              </Text>
            </Pressable>

            <Pressable
              style={styles.outlineButton}
              disabled={loading}
              onPress={() =>
                void loadShops(
                  page,
                  filter,
                  appliedKeyword
                )
              }
            >
              <Ionicons
                name="refresh-outline"
                size={17}
                color={UI.primary}
              />
              <Text style={styles.outlineText}>
                Làm mới
              </Text>
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.empty}>
              <ActivityIndicator
                size="large"
                color={UI.primary}
              />
              <Text style={styles.muted}>
                Đang tải danh sách cửa hàng...
              </Text>
            </View>
          ) : shops.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons
                name="storefront-outline"
                size={40}
                color={UI.muted}
              />
              <Text style={styles.emptyTitle}>
                Không có cửa hàng phù hợp
              </Text>
              <Text style={styles.muted}>
                Hãy thử bộ lọc hoặc từ khóa khác.
              </Text>
            </View>
          ) : (
            <View style={styles.list}>
              {shops.map((shop) => {
                const pending =
                  shop.status === 'PENDING';

                const approved =
                  shop.status === 'APPROVED' ||
                  shop.status === 'ACTIVE';

                return (
                  <View
                    key={shop.id}
                    style={styles.card}
                  >
                    <View style={styles.cardTop}>
                      <View style={styles.cardIdentity}>
                        <View style={styles.shopIcon}>
                          <Ionicons
                            name="storefront"
                            size={23}
                            color={UI.primary}
                          />
                        </View>

                        <View style={styles.flex}>
                          <Text style={styles.shopName}>
                            {shop.name}
                          </Text>

                          <Text
                            style={styles.muted}
                            numberOfLines={2}
                          >
                            {shop.address}
                          </Text>
                        </View>
                      </View>

                      <View
                        style={[
                          styles.statusBadge,
                          pending
                            ? styles.pendingBadge
                            : approved
                              ? styles.approvedBadge
                              : styles.rejectedBadge,
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusBadgeText,
                            pending
                              ? styles.pendingText
                              : approved
                                ? styles.approvedText
                                : styles.rejectedText,
                          ]}
                        >
                          {statusLabel(shop.status)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.cardDetails}>
                      <View style={styles.detailColumn}>
                        <Text style={styles.smallLabel}>
                          CHỦ CỬA HÀNG
                        </Text>
                        <Text style={styles.detailValue}>
                          {shop.ownerName}
                        </Text>
                      </View>

                      <View style={styles.detailColumn}>
                        <Text style={styles.smallLabel}>
                          SỐ ĐIỆN THOẠI
                        </Text>
                        <Text style={styles.detailValue}>
                          {shop.phone}
                        </Text>
                      </View>

                      <View style={styles.detailColumn}>
                        <Text style={styles.smallLabel}>
                          NGÀY ĐĂNG KÝ
                        </Text>
                        <Text style={styles.detailValue}>
                          {dateLabel(shop.createdAt)}
                        </Text>
                      </View>
                    </View>

                    <Pressable
                      style={styles.outlineButton}
                      onPress={() =>
                        void openDetail(shop)
                      }
                    >
                      <Ionicons
                        name="eye-outline"
                        size={18}
                        color={UI.primary}
                      />
                      <Text style={styles.outlineText}>
                        Xem và xử lý
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}

          <View style={styles.pagination}>
            <Text style={styles.muted}>
              Trang {page} / {totalPages}
            </Text>

            <View style={styles.actionRow}>
              <Pressable
                style={[
                  styles.outlineButton,
                  (loading || page <= 1) &&
                    styles.disabled,
                ]}
                disabled={loading || page <= 1}
                onPress={() =>
                  void loadShops(
                    page - 1,
                    filter,
                    appliedKeyword
                  )
                }
              >
                <Text style={styles.outlineText}>
                  Trước
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.outlineButton,
                  (loading || !hasNext) &&
                    styles.disabled,
                ]}
                disabled={loading || !hasNext}
                onPress={() =>
                  void loadShops(
                    page + 1,
                    filter,
                    appliedKeyword
                  )
                }
              >
                <Text style={styles.outlineText}>
                  Tiếp
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScreenContainer>

      <Modal
        visible={selected !== null}
        transparent
        animationType="fade"
        onRequestClose={closeDetail}
      >
        <View style={styles.backdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={closeDetail}
          />

          <View style={styles.modal}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.modalBody}
            >
              <View style={styles.modalHeading}>
                <View style={styles.flex}>
                  <Text style={styles.sectionTitle}>
                    Chi tiết cửa hàng
                  </Text>

                  <Text style={styles.muted}>
                    {selected?.name}
                  </Text>
                </View>

                <Pressable
                  disabled={submitting}
                  onPress={closeDetail}
                >
                  <Ionicons
                    name="close"
                    size={24}
                    color={UI.text}
                  />
                </Pressable>
              </View>

              {detailLoading ? (
                <View style={styles.empty}>
                  <ActivityIndicator
                    color={UI.primary}
                  />
                  <Text style={styles.muted}>
                    Đang tải chi tiết cửa hàng...
                  </Text>
                </View>
              ) : (
                <>
                  {!!detailError && (
                    <View style={styles.errorBox}>
                      <Text style={styles.errorText}>
                        {detailError}
                      </Text>
                    </View>
                  )}

                  <View style={styles.detailPanel}>
                    <Field
                      label="Mã cửa hàng"
                      value={selected?.id ?? ''}
                    />
                    <Field
                      label="Tên cửa hàng"
                      value={selected?.name ?? ''}
                    />
                    <Field
                      label="Trạng thái"
                      value={statusLabel(
                        selected?.status ?? ''
                      )}
                    />
                    <Field
                      label="Địa chỉ"
                      value={selected?.address ?? ''}
                    />
                    <Field
                      label="Số điện thoại"
                      value={selected?.phone ?? ''}
                    />
                    <Field
                      label="Email cửa hàng"
                      value={selected?.email ?? ''}
                    />
                    <Field
                      label="Chủ cửa hàng"
                      value={selected?.ownerName ?? ''}
                    />
                    <Field
                      label="Email chủ cửa hàng"
                      value={selected?.ownerEmail ?? ''}
                    />
                    <Field
                      label="Mô tả"
                      value={selected?.description ?? ''}
                    />
                    <Field
                      label="Ngày đăng ký"
                      value={dateLabel(
                        selected?.createdAt ?? null
                      )}
                    />
                    <Field
                      label="Ngày cập nhật"
                      value={dateLabel(
                        selected?.updatedAt ?? null
                      )}
                    />

                    {!!selected?.reviewedAt && (
                      <Field
                        label="Ngày xét duyệt"
                        value={dateLabel(
                          selected.reviewedAt
                        )}
                      />
                    )}

                    {!!selected?.reviewNote && (
                      <Field
                        label="Ghi chú xét duyệt"
                        value={selected.reviewNote}
                      />
                    )}
                  </View>

                  {!decision && (
                    <View style={styles.actionRow}>
                      {selected?.status === 'PENDING' &&
                        !detailError && (
                          <>
                            <Pressable
                              style={styles.primaryButton}
                              onPress={() =>
                                beginDecision('approve')
                              }
                            >
                              <Ionicons
                                name="checkmark-circle-outline"
                                size={18}
                                color={UI.surface}
                              />
                              <Text
                                style={styles.primaryButtonText}
                              >
                                Phê duyệt
                              </Text>
                            </Pressable>

                            <Pressable
                              style={styles.dangerButton}
                              onPress={() =>
                                beginDecision('reject')
                              }
                            >
                              <Ionicons
                                name="close-circle-outline"
                                size={18}
                                color={UI.surface}
                              />
                              <Text
                                style={styles.primaryButtonText}
                              >
                                Từ chối
                              </Text>
                            </Pressable>
                          </>
                        )}

                      <Pressable
                        style={styles.outlineButton}
                        onPress={closeDetail}
                      >
                        <Text style={styles.outlineText}>
                          Đóng
                        </Text>
                      </Pressable>
                    </View>
                  )}

                  {decision !== null && (
                    <View style={styles.decisionPanel}>
                      <Text style={styles.sectionTitle}>
                        {decision === 'approve'
                          ? 'Xác nhận phê duyệt'
                          : 'Xác nhận từ chối'}
                      </Text>

                      <View style={styles.warningBox}>
                        <Ionicons
                          name="alert-circle-outline"
                          size={20}
                          color={UI.warning}
                        />
                        <Text style={styles.warningText}>
                          {decision === 'approve'
                            ? 'Backend sẽ phê duyệt cửa hàng này. Quyết định có thể ảnh hưởng đến khả năng hoạt động của cửa hàng.'
                            : 'Backend sẽ từ chối hồ sơ đăng ký cửa hàng này. Vui lòng nêu rõ lý do.'}
                        </Text>
                      </View>

                      <Text style={styles.formLabel}>
                        Ghi chú xử lý *
                      </Text>

                      <TextInput
                        value={note}
                        onChangeText={(value) => {
                          setNote(value);
                          setActionError('');
                        }}
                        multiline
                        textAlignVertical="top"
                        editable={!submitting}
                        maxLength={2000}
                        style={styles.textarea}
                        placeholder={
                          decision === 'approve'
                            ? 'Nhập căn cứ phê duyệt cửa hàng...'
                            : 'Nhập lý do từ chối cửa hàng...'
                        }
                        placeholderTextColor={UI.muted}
                      />

                      <Text style={styles.muted}>
                        {note.length}/2000 ký tự
                      </Text>

                      {!!actionError && (
                        <View style={styles.errorBox}>
                          <Text style={styles.errorText}>
                            {actionError}
                          </Text>
                        </View>
                      )}

                      <View style={styles.actionRow}>
                        <Pressable
                          style={styles.outlineButton}
                          disabled={submitting}
                          onPress={() => {
                            setDecision(null);
                            setNote('');
                            setActionError('');
                          }}
                        >
                          <Text style={styles.outlineText}>
                            Quay lại
                          </Text>
                        </Pressable>

                        <Pressable
                          style={[
                            decision === 'approve'
                              ? styles.primaryButton
                              : styles.dangerButton,
                            (
                              submitting ||
                              !note.trim()
                            ) && styles.disabled,
                          ]}
                          disabled={
                            submitting ||
                            !note.trim()
                          }
                          onPress={() =>
                            void confirmDecision()
                          }
                        >
                          {submitting && (
                            <ActivityIndicator
                              size="small"
                              color={UI.surface}
                            />
                          )}

                          <Text
                            style={styles.primaryButtonText}
                          >
                            {submitting
                              ? 'Đang xử lý...'
                              : decision === 'approve'
                                ? 'Xác nhận phê duyệt'
                                : 'Xác nhận từ chối'}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </CustomerLayout>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 32,
    paddingBottom: 64,
    gap: 24,
  },
  center: {
    minHeight: 450,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  flex: {
    flex: 1,
  },
  backLink: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  linkText: {
    fontSize: 14,
    fontWeight: '700',
    color: UI.primary,
  },
  heading: {
    gap: 10,
  },
  headingIcon: {
    width: 52,
    height: 52,
    borderRadius: 15,
    backgroundColor: UI.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    color: UI.primary,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: UI.text,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: UI.text,
  },
  muted: {
    fontSize: 13,
    lineHeight: 21,
    color: UI.muted,
  },
  panel: {
    padding: 24,
    borderWidth: 1,
    borderColor: UI.border,
    backgroundColor: UI.surface,
    borderRadius: 16,
    gap: 20,
  },
  tabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 25,
    backgroundColor: UI.background,
  },
  selectedTab: {
    backgroundColor: UI.primary,
  },
  tabText: {
    color: UI.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  selectedTabText: {
    color: UI.surface,
  },
  searchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center',
  },
  searchBox: {
    flexGrow: 1,
    flexBasis: 220,
    minHeight: 48,
    borderWidth: 1,
    borderColor: UI.border,
    borderRadius: 9,
    paddingHorizontal: 14,
    flexDirection: 'row',
    gap: 9,
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    minWidth: 100,
    color: UI.text,
    fontSize: 14,
  },
  primaryButton: {
    minHeight: 46,
    paddingHorizontal: 18,
    paddingVertical: 11,
    backgroundColor: UI.primary,
    borderRadius: 9,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerButton: {
    minHeight: 46,
    paddingHorizontal: 18,
    paddingVertical: 11,
    backgroundColor: UI.danger,
    borderRadius: 9,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: UI.surface,
    fontSize: 14,
    fontWeight: '800',
  },
  outlineButton: {
    minHeight: 46,
    paddingHorizontal: 17,
    paddingVertical: 10,
    backgroundColor: UI.surface,
    borderWidth: 1,
    borderColor: UI.border,
    borderRadius: 9,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineText: {
    fontSize: 14,
    fontWeight: '700',
    color: UI.primary,
  },
  disabled: {
    opacity: 0.5,
  },
  list: {
    gap: 13,
  },
  card: {
    borderWidth: 1,
    borderColor: UI.border,
    borderRadius: 13,
    padding: 20,
    gap: 16,
  },
  cardTop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  cardIdentity: {
    flex: 1,
    minWidth: 200,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  shopIcon: {
    height: 45,
    width: 45,
    borderRadius: 12,
    backgroundColor: UI.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shopName: {
    fontSize: 16,
    fontWeight: '800',
    color: UI.text,
  },
  statusBadge: {
    borderRadius: 24,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  pendingBadge: {
    backgroundColor: UI.warningBg,
  },
  pendingText: {
    color: UI.warning,
  },
  approvedBadge: {
    backgroundColor: UI.successBg,
  },
  approvedText: {
    color: UI.success,
  },
  rejectedBadge: {
    backgroundColor: UI.dangerBg,
  },
  rejectedText: {
    color: UI.danger,
  },
  divider: {
    height: 1,
    backgroundColor: UI.border,
  },
  cardDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
  },
  detailColumn: {
    minWidth: 150,
    gap: 5,
  },
  smallLabel: {
    color: UI.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  detailValue: {
    color: UI.text,
    fontSize: 13,
    fontWeight: '700',
  },
  empty: {
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    gap: 12,
  },
  emptyTitle: {
    color: UI.text,
    fontSize: 16,
    fontWeight: '800',
  },
  pagination: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  successBox: {
    backgroundColor: UI.successBg,
    borderRadius: 10,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  successText: {
    color: UI.success,
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  errorBox: {
    backgroundColor: UI.dangerBg,
    borderRadius: 10,
    padding: 14,
  },
  errorText: {
    color: UI.danger,
    fontSize: 13,
    lineHeight: 20,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10,25,45,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modal: {
    width: '100%',
    maxWidth: 640,
    maxHeight: '90%',
    backgroundColor: UI.surface,
    borderRadius: 15,
    overflow: 'hidden',
  },
  modalBody: {
    gap: 20,
    padding: 24,
  },
  modalHeading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  detailPanel: {
    backgroundColor: '#F1F5F9',
    padding: 18,
    borderRadius: 12,
    gap: 17,
  },
  fieldRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  fieldLabel: {
    flexBasis: 135,
    color: UI.muted,
    fontSize: 13,
  },
  fieldValue: {
    flex: 1,
    color: UI.text,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
  },
  decisionPanel: {
    borderTopWidth: 1,
    borderTopColor: UI.border,
    paddingTop: 20,
    gap: 15,
  },
  warningBox: {
    backgroundColor: UI.warningBg,
    padding: 14,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  warningText: {
    color: UI.warning,
    fontSize: 13,
    lineHeight: 20,
    flex: 1,
  },
  formLabel: {
    color: UI.text,
    fontSize: 14,
    fontWeight: '800',
  },
  textarea: {
    minHeight: 115,
    borderWidth: 1,
    borderColor: UI.border,
    borderRadius: 9,
    padding: 14,
    color: UI.text,
    fontSize: 14,
    lineHeight: 22,
  },
});

export default requireAccess(AdminShopsScreen, 'admin');
