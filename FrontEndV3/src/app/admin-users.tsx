
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
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

const C = {
  primary: '#07549B',
  primaryLight: '#EAF3FC',
  text: '#182D49',
  muted: '#71839C',
  border: '#DFE7F0',
  surface: '#FFFFFF',
  background: '#F7FAFD',
  success: '#248348',
  successBg: '#EAF7EE',
  danger: '#C63737',
  dangerBg: '#FDEDED',
  warning: '#925C00',
  warningBg: '#FFF3D8',
};

const PAGE_SIZE = 10;

type JsonObject = Record<string, unknown>;
type StatusFilter = 'ALL' | 'ACTIVE' | 'LOCKED';
type ActionType = 'lock' | 'unlock';

type AdminUser = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  systemRole: string;
  status: string;
  createdAt: string | null;
  updatedAt: string | null;
};

function asObject(value: unknown): JsonObject | null {
  if (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
  ) {
    return value as JsonObject;
  }
  return null;
}

function getString(
  value: unknown,
  ...keys: string[]
): string | null {
  const source = asObject(value);

  for (const key of keys) {
    const field = source?.[key];

    if (
      typeof field === 'string' &&
      field.trim().length > 0
    ) {
      return field.trim();
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
    const field = source?.[key];

    if (
      typeof field === 'number' &&
      Number.isFinite(field)
    ) {
      return field;
    }

    if (
      typeof field === 'string' &&
      field.trim().length > 0
    ) {
      const parsed = Number(field);

      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

function unwrapApi(value: unknown): unknown {
  const source = asObject(value);

  if (source && 'data' in source) {
    return source.data;
  }

  return value;
}

function findItems(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  const source = asObject(value);

  if (!source) {
    return [];
  }

  for (const key of [
    'items',
    'users',
    'results',
    'records',
  ]) {
    if (Array.isArray(source[key])) {
      return source[key] as unknown[];
    }
  }

  if ('data' in source) {
    return findItems(source.data);
  }

  return [];
}

function normalizeUser(value: unknown): AdminUser | null {
  const root = asObject(value);

  if (!root) {
    return null;
  }

  const source = asObject(root.user) ?? root;

  const id = getString(source, 'id', 'userId');

  if (!id) {
    return null;
  }

  return {
    id,
    fullName:
      getString(source, 'fullName', 'name', 'userName') ??
      'Chưa cập nhật',
    email:
      getString(source, 'email') ??
      'Chưa cập nhật',
    phone:
      getString(source, 'phoneNumber', 'phone') ??
      'Chưa cập nhật',
    systemRole:
      (
        getString(
          source,
          'systemRole',
          'role',
          'roleName'
        ) ?? 'USER'
      ).toUpperCase(),
    status:
      (
        getString(
          source,
          'status',
          'accountStatus',
          'userStatus'
        ) ?? 'UNKNOWN'
      ).toUpperCase(),
    createdAt: getString(
      source,
      'createdAt',
      'registeredAt'
    ),
    updatedAt: getString(
      source,
      'updatedAt',
      'modifiedAt'
    ),
  };
}

function statusText(value: string): string {
  switch (value.toUpperCase()) {
    case 'ACTIVE':
      return 'Đang hoạt động';
    case 'LOCKED':
      return 'Đã khóa';
    case 'INACTIVE':
      return 'Ngừng hoạt động';
    case 'PENDING':
      return 'Chờ xử lý';
    default:
      return value;
  }
}

function roleText(value: string): string {
  switch (value.toUpperCase()) {
    case 'ADMIN':
      return 'Quản trị viên';
    case 'USER':
      return 'Người dùng';
    default:
      return value;
  }
}

function dateText(value: string | null): string {
  if (!value) {
    return 'Chưa có thông tin';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('vi-VN', {
    hour12: false,
  });
}

function getErrorMessage(
  value: unknown,
  fallback: string
): string {
  if (value instanceof Error) {
    return value.message;
  }

  return fallback;
}

async function readApiResponse(
  response: Response
): Promise<unknown> {
  const raw = await response.text();

  let json: unknown = null;

  if (raw.trim()) {
    try {
      json = JSON.parse(raw);
    } catch {
      throw new Error(
        `Backend trả về dữ liệu không hợp lệ. HTTP ${response.status}`
      );
    }
  }

  const root = asObject(json);
  const apiError = asObject(root?.error);

  if (
    !response.ok ||
    root?.success === false
  ) {
    throw new Error(
      getString(apiError, 'message', 'detail') ??
      getString(root, 'message', 'detail') ??
      `Không thể thực hiện yêu cầu. HTTP ${response.status}`
    );
  }

  return unwrapApi(json);
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export default function AdminUsersScreen() {
  const router = useRouter();

  const {
    user,
    status,
    getAccessToken,
  } = useAuth();

  const authenticated =
    status === 'authenticated' &&
    user !== null;

  const isAdmin =
    authenticated &&
    user.systemRole?.toUpperCase() === 'ADMIN';

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [filter, setFilter] = useState<StatusFilter>('ALL');
  const [keyword, setKeyword] = useState('');
  const [appliedKeyword, setAppliedKeyword] = useState('');

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasNext, setHasNext] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [selected, setSelected] =
    useState<AdminUser | null>(null);

  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const [actionType, setActionType] =
    useState<ActionType | null>(null);

  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const apiRequest = useCallback(
    async (
      path: string,
      options?: {
        method?: 'GET' | 'POST';
        body?: unknown;
      }
    ) => {
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
        headers['Content-Type'] = 'application/json';
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

      return readApiResponse(response);
    },
    [getAccessToken]
  );

  const loadUsers = useCallback(
    async (
      targetPage: number,
      targetFilter: StatusFilter,
      search: string
    ) => {
      if (!isAdmin) {
        return;
      }

      setLoading(true);
      setError('');

      try {
        const query = new URLSearchParams({
          status: targetFilter,
          keyword: search,
          page: String(targetPage),
          limit: String(PAGE_SIZE),
        });

        const data = await apiRequest(
          `/api/admin/users?${query.toString()}`
        );

        const rawItems = findItems(data);

        const normalized = rawItems
          .map(normalizeUser)
          .filter(
            (item): item is AdminUser => item !== null
          );

        const root = asObject(data);
        const pagination =
          asObject(root?.pagination) ??
          asObject(root?.meta);

        const pages =
          getNumber(root, 'totalPages', 'pageCount') ??
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
            : typeof pagination?.hasNextPage === 'boolean'
              ? pagination.hasNextPage
              : null;

        const resolvedPages =
          pages ??
          (
            total !== null
              ? Math.ceil(total / PAGE_SIZE)
              : targetPage +
                (rawItems.length === PAGE_SIZE ? 1 : 0)
          );

        setUsers(normalized);
        setPage(targetPage);

        setTotalPages(
          Math.max(1, resolvedPages)
        );

        setHasNext(
          nextFlag ??
          (
            pages !== null || total !== null
              ? targetPage < Math.max(1, resolvedPages)
              : rawItems.length === PAGE_SIZE
          )
        );

        if (
          rawItems.length > 0 &&
          normalized.length === 0
        ) {
          setError(
            'Dữ liệu người dùng từ Backend chưa đúng cấu trúc dự kiến.'
          );
        }
      } catch (caught: unknown) {
        setUsers([]);

        setError(
          getErrorMessage(
            caught,
            'Không thể tải danh sách người dùng.'
          )
        );
      } finally {
        setLoading(false);
      }
    },
    [apiRequest, isAdmin]
  );

  useEffect(() => {
    if (isAdmin) {
      void loadUsers(1, 'ALL', '');
    }
  }, [isAdmin, loadUsers]);

  const changeFilter = (value: StatusFilter) => {
    setFilter(value);
    setNotice('');
    setPage(1);

    void loadUsers(1, value, appliedKeyword);
  };

  const searchUsers = () => {
    const search = keyword.trim();

    setAppliedKeyword(search);
    setNotice('');
    setPage(1);

    void loadUsers(1, filter, search);
  };

  const refreshUsers = () => {
    void loadUsers(page, filter, appliedKeyword);
  };

  const openDetail = async (item: AdminUser) => {
    setSelected(item);
    setDetailError('');
    setDetailLoading(true);
    setActionType(null);
    setReason('');
    setActionError('');

    try {
      const data = await apiRequest(
        `/api/admin/users/${encodeURIComponent(item.id)}`
      );

      const detail = normalizeUser(data);

      if (!detail) {
        setDetailError(
          'Backend chưa trả về thông tin người dùng hợp lệ.'
        );
        return;
      }

      if (
        detail.id.toLowerCase() !==
        item.id.toLowerCase()
      ) {
        setDetailError(
          'API trả về thông tin của tài khoản khác.'
        );
        return;
      }

      setSelected(detail);
    } catch (caught: unknown) {
      setDetailError(
        getErrorMessage(
          caught,
          'Không thể xem chi tiết tài khoản.'
        )
      );
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    if (submitting) return;

    setSelected(null);
    setActionType(null);
    setDetailError('');
    setActionError('');
    setReason('');
  };

  const beginAction = (type: ActionType) => {
    if (!selected || submitting) return;

    if (
      user?.id?.toLowerCase() ===
      selected.id.toLowerCase()
    ) {
      setActionError(
        'Không thực hiện khóa hoặc mở khóa trên chính tài khoản đang đăng nhập.'
      );
      return;
    }

    setActionError('');
    setReason('');
    setActionType(type);
  };

  const confirmAction = async () => {
    if (
      !selected ||
      !actionType ||
      submitting
    ) {
      return;
    }

    const cleanReason = reason.trim();

    if (cleanReason.length < 10) {
      setActionError(
        'Lý do phải có tối thiểu 10 ký tự.'
      );
      return;
    }

    if (cleanReason.length > 2000) {
      setActionError(
        'Lý do không được vượt quá 2.000 ký tự.'
      );
      return;
    }

    const target = selected;
    const type = actionType;

    setSubmitting(true);
    setActionError('');

    try {
      await apiRequest(
        `/api/admin/users/${encodeURIComponent(target.id)}/${type}`,
        {
          method: 'POST',
          body: {
            reason: cleanReason,
          },
        }
      );

      setNotice(
        type === 'lock'
          ? `Backend đã khóa tài khoản ${target.fullName}.`
          : `Backend đã mở khóa tài khoản ${target.fullName}.`
      );

      setActionType(null);
      setSelected(null);
      setReason('');

      await loadUsers(page, filter, appliedKeyword);
    } catch (caught: unknown) {
      setActionError(
        getErrorMessage(
          caught,
          'Không thể cập nhật trạng thái tài khoản.'
        )
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'loading') {
    return (
      <CustomerLayout>
        <ScreenContainer style={styles.center}>
          <ActivityIndicator
            size="large"
            color={C.primary}
          />
          <Text style={styles.muted}>
            Đang xác thực tài khoản...
          </Text>
        </ScreenContainer>
      </CustomerLayout>
    );
  }

  if (!authenticated || !isAdmin) {
    return (
      <CustomerLayout>
        <ScreenContainer style={styles.center}>
          <Ionicons
            name="shield-outline"
            size={44}
            color={C.muted}
          />
          <Text style={styles.title}>
            Không có quyền truy cập
          </Text>
          <Text style={styles.muted}>
            Chức năng quản lý người dùng chỉ dành
            cho quản trị viên.
          </Text>

          <Pressable
            style={styles.primaryButton}
            onPress={() =>
              router.replace(
                authenticated ? '/' : '/login'
              )
            }
          >
            <Text style={styles.primaryButtonText}>
              {authenticated
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
            color={C.primary}
          />
          <Text style={styles.linkText}>
            Quay lại trang chủ
          </Text>
        </Pressable>

        <View style={styles.heading}>
          <View style={styles.headingIcon}>
            <Ionicons
              name="people-outline"
              size={27}
              color={C.primary}
            />
          </View>

          <Text style={styles.eyebrow}>
            SAVIBITE · ADMIN USERS
          </Text>

          <Text style={styles.title}>
            Quản lý người dùng
          </Text>

          <Text style={styles.muted}>
            Tra cứu tài khoản, xem thông tin,
            khóa hoặc mở khóa theo quyền quản trị.
          </Text>
        </View>

        {!!notice && (
          <View style={styles.successBox}>
            <Ionicons
              name="checkmark-circle-outline"
              size={21}
              color={C.success}
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
            Danh sách tài khoản
          </Text>

          <View style={styles.tabs}>
            {(
              [
                ['ALL', 'Tất cả'],
                ['ACTIVE', 'Đang hoạt động'],
                ['LOCKED', 'Đã khóa'],
              ] as const
            ).map(([value, label]) => (
              <Pressable
                key={value}
                style={[
                  styles.tab,
                  filter === value &&
                    styles.activeTab,
                ]}
                disabled={loading}
                onPress={() => changeFilter(value)}
              >
                <Text
                  style={[
                    styles.tabText,
                    filter === value &&
                      styles.activeTabText,
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
                color={C.muted}
              />
              <TextInput
                style={styles.searchInput}
                value={keyword}
                onChangeText={setKeyword}
                placeholder="Tìm tên, email, số điện thoại..."
                placeholderTextColor={C.muted}
                returnKeyType="search"
                onSubmitEditing={searchUsers}
              />
            </View>

            <Pressable
              style={styles.primaryButton}
              disabled={loading}
              onPress={searchUsers}
            >
              <Text style={styles.primaryButtonText}>
                Tìm kiếm
              </Text>
            </Pressable>

            <Pressable
              style={styles.outlineButton}
              disabled={loading}
              onPress={refreshUsers}
            >
              <Ionicons
                name="refresh-outline"
                size={17}
                color={C.primary}
              />
              <Text style={styles.outlineButtonText}>
                Làm mới
              </Text>
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator
                size="large"
                color={C.primary}
              />
              <Text style={styles.muted}>
                Đang tải danh sách người dùng...
              </Text>
            </View>
          ) : users.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons
                name="people-outline"
                size={36}
                color={C.muted}
              />
              <Text style={styles.emptyTitle}>
                Không tìm thấy tài khoản
              </Text>
              <Text style={styles.muted}>
                Hãy thử thay đổi bộ lọc hoặc từ khóa.
              </Text>
            </View>
          ) : (
            <View style={styles.userList}>
              {users.map((item) => {
                const locked =
                  item.status === 'LOCKED';

                return (
                  <View
                    key={item.id}
                    style={styles.userCard}
                  >
                    <View style={styles.cardHeader}>
                      <View style={styles.userIdentity}>
                        <View style={styles.avatar}>
                          <Text style={styles.avatarText}>
                            {item.fullName
                              .charAt(0)
                              .toUpperCase()}
                          </Text>
                        </View>

                        <View style={styles.flex}>
                          <Text style={styles.userName}>
                            {item.fullName}
                          </Text>
                          <Text style={styles.email}>
                            {item.email}
                          </Text>
                        </View>
                      </View>

                      <View
                        style={[
                          styles.statusBadge,
                          locked
                            ? styles.lockedBadge
                            : item.status === 'ACTIVE'
                              ? styles.activeBadge
                              : styles.neutralBadge,
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusBadgeText,
                            locked
                              ? styles.lockedText
                              : item.status === 'ACTIVE'
                                ? styles.activeText
                                : styles.neutralText,
                          ]}
                        >
                          {statusText(item.status)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.cardDivider} />

                    <View style={styles.cardDetails}>
                      <View style={styles.detailColumn}>
                        <Text style={styles.smallLabel}>
                          VAI TRÒ
                        </Text>
                        <Text style={styles.cardValue}>
                          {roleText(item.systemRole)}
                        </Text>
                      </View>

                      <View style={styles.detailColumn}>
                        <Text style={styles.smallLabel}>
                          SỐ ĐIỆN THOẠI
                        </Text>
                        <Text style={styles.cardValue}>
                          {item.phone}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.cardActions}>
                      <Pressable
                        style={styles.outlineButton}
                        onPress={() =>
                          void openDetail(item)
                        }
                      >
                        <Ionicons
                          name="eye-outline"
                          size={17}
                          color={C.primary}
                        />
                        <Text
                          style={styles.outlineButtonText}
                        >
                          Xem và quản lý
                        </Text>
                      </Pressable>
                    </View>
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
                    styles.disabledButton,
                ]}
                disabled={loading || page <= 1}
                onPress={() =>
                  void loadUsers(
                    page - 1,
                    filter,
                    appliedKeyword
                  )
                }
              >
                <Text style={styles.outlineButtonText}>
                  Trước
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.outlineButton,
                  (loading || !hasNext) &&
                    styles.disabledButton,
                ]}
                disabled={loading || !hasNext}
                onPress={() =>
                  void loadUsers(
                    page + 1,
                    filter,
                    appliedKeyword
                  )
                }
              >
                <Text style={styles.outlineButtonText}>
                  Tiếp
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScreenContainer>

      {/* Chi tiết tài khoản */}
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

          <View style={styles.modalPanel}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.modalContent}
            >
              <View style={styles.modalHeading}>
                <View style={styles.flex}>
                  <Text style={styles.sectionTitle}>
                    Chi tiết tài khoản
                  </Text>
                  <Text style={styles.muted}>
                    Xem thông tin và quản lý trạng thái
                  </Text>
                </View>

                <Pressable
                  disabled={submitting}
                  onPress={closeDetail}
                >
                  <Ionicons
                    name="close"
                    size={23}
                    color={C.text}
                  />
                </Pressable>
              </View>

              {detailLoading ? (
                <View style={styles.emptyState}>
                  <ActivityIndicator
                    color={C.primary}
                  />
                  <Text style={styles.muted}>
                    Đang tải chi tiết...
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

                  <View style={styles.infoPanel}>
                    <InfoRow
                      label="Mã tài khoản"
                      value={selected?.id ?? ''}
                    />
                    <InfoRow
                      label="Họ và tên"
                      value={selected?.fullName ?? ''}
                    />
                    <InfoRow
                      label="Email"
                      value={selected?.email ?? ''}
                    />
                    <InfoRow
                      label="Số điện thoại"
                      value={selected?.phone ?? ''}
                    />
                    <InfoRow
                      label="Vai trò hệ thống"
                      value={roleText(
                        selected?.systemRole ?? ''
                      )}
                    />
                    <InfoRow
                      label="Trạng thái"
                      value={statusText(
                        selected?.status ?? ''
                      )}
                    />
                    <InfoRow
                      label="Ngày tạo"
                      value={dateText(
                        selected?.createdAt ?? null
                      )}
                    />
                    <InfoRow
                      label="Ngày cập nhật"
                      value={dateText(
                        selected?.updatedAt ?? null
                      )}
                    />
                  </View>

                  {!actionType && (
                    <View style={styles.actionRow}>
                      {selected?.status === 'ACTIVE' && (
                        <Pressable
                          style={styles.dangerButton}
                          disabled={
                            detailLoading ||
                            !!detailError ||
                            user?.id?.toLowerCase() ===
                              selected.id.toLowerCase()
                          }
                          onPress={() =>
                            beginAction('lock')
                          }
                        >
                          <Ionicons
                            name="lock-closed-outline"
                            size={18}
                            color={C.surface}
                          />
                          <Text style={styles.primaryButtonText}>
                            Khóa tài khoản
                          </Text>
                        </Pressable>
                      )}

                      {selected?.status === 'LOCKED' && (
                        <Pressable
                          style={styles.primaryButton}
                          disabled={
                            detailLoading ||
                            !!detailError
                          }
                          onPress={() =>
                            beginAction('unlock')
                          }
                        >
                          <Ionicons
                            name="lock-open-outline"
                            size={18}
                            color={C.surface}
                          />
                          <Text style={styles.primaryButtonText}>
                            Mở khóa tài khoản
                          </Text>
                        </Pressable>
                      )}

                      <Pressable
                        style={styles.outlineButton}
                        onPress={closeDetail}
                      >
                        <Text style={styles.outlineButtonText}>
                          Đóng
                        </Text>
                      </Pressable>
                    </View>
                  )}

                  {actionType && (
                    <View style={styles.actionPanel}>
                      <Text style={styles.sectionTitle}>
                        {actionType === 'lock'
                          ? 'Xác nhận khóa tài khoản'
                          : 'Xác nhận mở khóa tài khoản'}
                      </Text>

                      <View style={styles.warningBox}>
                        <Ionicons
                          name="alert-circle-outline"
                          size={20}
                          color={C.warning}
                        />
                        <Text style={styles.warningText}>
                          {actionType === 'lock'
                            ? 'Tài khoản sẽ bị khóa sau khi Backend xử lý thành công.'
                            : 'Tài khoản sẽ được mở khóa sau khi Backend xử lý thành công.'}
                        </Text>
                      </View>

                      <Text style={styles.formLabel}>
                        Lý do xử lý *
                      </Text>

                      <TextInput
                        style={styles.textarea}
                        multiline
                        textAlignVertical="top"
                        value={reason}
                        onChangeText={(value) => {
                          setReason(value);
                          setActionError('');
                        }}
                        editable={!submitting}
                        maxLength={2000}
                        placeholder={
                          actionType === 'lock'
                            ? 'Nhập lý do khóa tài khoản...'
                            : 'Nhập lý do mở khóa tài khoản...'
                        }
                        placeholderTextColor={C.muted}
                      />

                      <Text style={styles.muted}>
                        {reason.trim().length}/2000 ký tự ·
                        Tối thiểu 10 ký tự
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
                            setActionType(null);
                            setActionError('');
                            setReason('');
                          }}
                        >
                          <Text
                            style={styles.outlineButtonText}
                          >
                            Quay lại
                          </Text>
                        </Pressable>

                        <Pressable
                          style={[
                            actionType === 'lock'
                              ? styles.dangerButton
                              : styles.primaryButton,
                            (
                              submitting ||
                              reason.trim().length < 10
                            ) &&
                              styles.disabledButton,
                          ]}
                          disabled={
                            submitting ||
                            reason.trim().length < 10
                          }
                          onPress={() =>
                            void confirmAction()
                          }
                        >
                          {submitting && (
                            <ActivityIndicator
                              size="small"
                              color={C.surface}
                            />
                          )}

                          <Text
                            style={styles.primaryButtonText}
                          >
                            {submitting
                              ? 'Đang xử lý...'
                              : actionType === 'lock'
                                ? 'Xác nhận khóa'
                                : 'Xác nhận mở khóa'}
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
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  flex: {
    flex: 1,
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
  },
  linkText: {
    color: C.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  heading: {
    gap: 10,
  },
  headingIcon: {
    width: 52,
    height: 52,
    borderRadius: 15,
    backgroundColor: C.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    color: C.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: C.text,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: C.text,
  },
  muted: {
    fontSize: 13,
    lineHeight: 21,
    color: C.muted,
  },
  panel: {
    padding: 24,
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    gap: 20,
  },
  tabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tab: {
    backgroundColor: C.background,
    borderRadius: 30,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  activeTab: {
    backgroundColor: C.primary,
  },
  tabText: {
    color: C.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  activeTabText: {
    color: C.surface,
  },
  searchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
  },
  searchBox: {
    flexGrow: 1,
    flexBasis: 220,
    minHeight: 48,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: C.text,
    outlineStyle: 'none',
  } as any,
  primaryButton: {
    minHeight: 46,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: C.primary,
    borderRadius: 9,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  dangerButton: {
    minHeight: 46,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: C.danger,
    borderRadius: 9,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  primaryButtonText: {
    color: C.surface,
    fontSize: 14,
    fontWeight: '800',
  },
  outlineButton: {
    minHeight: 46,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 9,
    backgroundColor: C.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  outlineButtonText: {
    color: C.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.5,
  },
  userList: {
    gap: 12,
  },
  userCard: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 13,
    padding: 20,
    gap: 15,
  },
  cardHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  userIdentity: {
    flex: 1,
    minWidth: 210,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 43,
    height: 43,
    borderRadius: 22,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: C.surface,
    fontSize: 16,
    fontWeight: '800',
  },
  userName: {
    fontSize: 16,
    color: C.text,
    fontWeight: '800',
  },
  email: {
    color: C.muted,
    fontSize: 12,
    marginTop: 4,
  },
  statusBadge: {
    borderRadius: 30,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  activeBadge: {
    backgroundColor: C.successBg,
  },
  lockedBadge: {
    backgroundColor: C.dangerBg,
  },
  neutralBadge: {
    backgroundColor: C.background,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  activeText: {
    color: C.success,
  },
  lockedText: {
    color: C.danger,
  },
  neutralText: {
    color: C.muted,
  },
  cardDivider: {
    height: 1,
    backgroundColor: C.border,
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
    color: C.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  cardValue: {
    color: C.text,
    fontSize: 13,
    fontWeight: '700',
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  emptyState: {
    paddingVertical: 60,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: {
    fontSize: 16,
    color: C.text,
    fontWeight: '800',
  },
  pagination: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    borderRadius: 10,
    backgroundColor: C.successBg,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  successText: {
    fontSize: 13,
    color: C.success,
    fontWeight: '700',
    flex: 1,
  },
  errorBox: {
    padding: 14,
    borderRadius: 10,
    backgroundColor: C.dangerBg,
  },
  errorText: {
    fontSize: 13,
    color: C.danger,
    lineHeight: 20,
  },
  warningBox: {
    backgroundColor: C.warningBg,
    padding: 14,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  warningText: {
    color: C.warning,
    fontSize: 13,
    lineHeight: 20,
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10,25,45,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalPanel: {
    width: '100%',
    maxWidth: 620,
    maxHeight: '90%',
    backgroundColor: C.surface,
    borderRadius: 15,
    overflow: 'hidden',
  },
  modalContent: {
    padding: 24,
    gap: 20,
  },
  modalHeading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  infoPanel: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 18,
    gap: 18,
  },
  infoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  infoLabel: {
    color: C.muted,
    fontSize: 13,
    flexBasis: 130,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '700',
    color: C.text,
    flex: 1,
    textAlign: 'right',
  },
  actionPanel: {
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 20,
  },
  formLabel: {
    color: C.text,
    fontSize: 14,
    fontWeight: '800',
  },
  textarea: {
    minHeight: 110,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 9,
    padding: 14,
    color: C.text,
    fontSize: 14,
    lineHeight: 22,
  },
});
