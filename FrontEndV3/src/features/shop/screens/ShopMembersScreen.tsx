import styles from './ShopMembersScreen.styles';
import { requireAccess } from '../../../features/auth/components/requireAccess';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
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

import { ENV } from '../../../config/env';
import { useAuth } from '../../../features/auth/context/AuthProvider';
import CustomerLayout from '../../../shared/components/layout/CustomerLayout';
import ScreenContainer from '../../../shared/components/layout/ScreenContainer';
import AppButton from '../../../shared/components/ui/AppButton';
import { colors, radius, spacing } from '../../../shared/theme';

type JsonObject = Record<string, unknown>;
type MemberStatus = 'ACTIVE' | 'LOCKED';

type ShopMember = {
  id: string;
  userId: string | null;
  fullName: string;
  email: string;
  phone: string | null;
  role: string;
  status: string;
  joinedAt: string | null;
};

type MemberAction =
  | { kind: 'add' }
  | { kind: 'status'; member: ShopMember; status: MemberStatus }
  | { kind: 'delete'; member: ShopMember };

const PAGE_SIZE = 20;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function asObject(value: unknown): JsonObject | null {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    return null;
  }

  return value as JsonObject;
}

function getString(
  value: unknown,
  ...keys: string[]
): string | null {
  const obj = asObject(value);

  if (!obj) return null;

  for (const key of keys) {
    const field = obj[key];

    if (typeof field === 'string' && field.trim()) {
      return field.trim();
    }
  }

  return null;
}

function getNumber(
  value: unknown,
  ...keys: string[]
): number | null {
  const obj = asObject(value);

  if (!obj) return null;

  for (const key of keys) {
    const field = obj[key];

    if (
      typeof field === 'number' &&
      Number.isFinite(field)
    ) {
      return field;
    }
  }

  return null;
}

function unwrap(value: unknown): unknown {
  const obj = asObject(value);

  if (obj && 'data' in obj) {
    return obj.data;
  }

  return value;
}

function getMemberArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;

  const obj = asObject(value);

  if (!obj) return [];

  for (const key of [
    'items',
    'members',
    'results',
    'records',
  ]) {
    if (Array.isArray(obj[key])) {
      return obj[key] as unknown[];
    }
  }

  if (obj.data) {
    return getMemberArray(obj.data);
  }

  return [];
}

function normalizeMember(value: unknown): ShopMember | null {
  const obj = asObject(value);

  if (!obj) return null;

  const user = asObject(obj.user);

  const id =
    getString(obj, 'id', 'memberId', 'shopMemberId') ??
    getString(user, 'id');

  if (!id) return null;

  return {
    id,
    userId:
      getString(obj, 'userId') ??
      getString(user, 'id'),
    fullName:
      getString(
        obj,
        'fullName',
        'memberName',
        'userName',
        'name'
      ) ??
      getString(user, 'fullName', 'name') ??
      'Thành viên cửa hàng',
    email:
      getString(obj, 'email', 'userEmail') ??
      getString(user, 'email') ??
      '',
    phone:
      getString(obj, 'phone', 'phoneNumber') ??
      getString(user, 'phone', 'phoneNumber'),
    role:
      getString(obj, 'role', 'memberRole') ??
      getString(user, 'role') ??
      'STAFF',
    status:
      getString(obj, 'status', 'memberStatus') ??
      'ACTIVE',
    joinedAt:
      getString(
        obj,
        'joinedAt',
        'createdAt',
        'addedAt'
      ),
  };
}

function parsePagination(value: unknown) {
  const obj = asObject(value);
  const pagination = asObject(obj?.pagination);

  const total =
    getNumber(obj, 'total', 'totalCount', 'totalItems') ??
    getNumber(
      pagination,
      'total',
      'totalCount',
      'totalItems'
    );

  const totalPages =
    getNumber(obj, 'totalPages', 'pageCount') ??
    getNumber(pagination, 'totalPages', 'pageCount');

  const hasNext =
    typeof obj?.hasNextPage === 'boolean'
      ? obj.hasNextPage
      : typeof pagination?.hasNextPage === 'boolean'
        ? pagination.hasNextPage
        : null;

  return { total, totalPages, hasNext };
}

async function parseResponse(response: Response): Promise<unknown> {
  const raw = await response.text();

  let json: unknown = null;

  if (raw.trim()) {
    try {
      json = JSON.parse(raw);
    } catch {
      if (!response.ok) {
        throw new Error(
          `Backend trả về HTTP ${response.status}.`
        );
      }

      throw new Error(
        'Backend trả về dữ liệu không đúng định dạng JSON.'
      );
    }
  }

  const obj = asObject(json);

  if (!response.ok || obj?.success === false) {
    const apiError = asObject(obj?.error);

    throw new Error(
      getString(apiError, 'message', 'detail', 'title') ??
      getString(obj, 'message', 'detail', 'title') ??
      `Yêu cầu thất bại (HTTP ${response.status}).`
    );
  }

  return unwrap(json);
}

function roleLabel(role: string) {
  switch (role.toUpperCase()) {
    case 'OWNER':
      return 'Chủ cửa hàng';
    case 'STAFF':
      return 'Nhân viên';
    case 'MANAGER':
      return 'Quản lý';
    default:
      return role || 'Chưa xác định';
  }
}

function statusLabel(status: string) {
  switch (status.toUpperCase()) {
    case 'ACTIVE':
      return 'Đang hoạt động';
    case 'LOCKED':
      return 'Đã khóa';
    default:
      return status || 'Chưa xác định';
  }
}

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(-2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || 'SB'
  );
}

function MemberCard({
  member,
  disabled,
  onStatus,
  onDelete,
}: {
  member: ShopMember;
  disabled: boolean;
  onStatus: (member: ShopMember, status: MemberStatus) => void;
  onDelete: (member: ShopMember) => void;
}) {
  const isOwner = member.role.toUpperCase() === 'OWNER';
  const isActive = member.status.toUpperCase() === 'ACTIVE';
  const canManage = !isOwner;

  return (
    <View style={styles.memberCard}>
      <View style={styles.memberTop}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {initials(member.fullName)}
          </Text>
        </View>

        <View style={styles.memberMain}>
          <Text style={styles.memberName}>
            {member.fullName}
          </Text>

          {!!member.email && (
            <Text style={styles.memberEmail}>
              {member.email}
            </Text>
          )}

          {!!member.phone && (
            <Text style={styles.memberDetail}>
              {member.phone}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.memberBadges}>
        <View
          style={[
            styles.roleBadge,
            isOwner && styles.ownerBadge,
          ]}
        >
          <Text
            style={[
              styles.roleText,
              isOwner && styles.ownerText,
            ]}
          >
            {roleLabel(member.role)}
          </Text>
        </View>

        <View
          style={[
            styles.statusBadge,
            isActive
              ? styles.activeBadge
              : styles.lockedBadge,
          ]}
        >
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor: isActive
                  ? colors.eco
                  : colors.danger,
              },
            ]}
          />

          <Text
            style={[
              styles.statusText,
              {
                color: isActive
                  ? colors.eco
                  : colors.danger,
              },
            ]}
          >
            {statusLabel(member.status)}
          </Text>
        </View>
      </View>

      {canManage && (
        <View style={styles.memberActions}>
          <Pressable
            disabled={disabled}
            onPress={() =>
              onStatus(
                member,
                isActive ? 'LOCKED' : 'ACTIVE'
              )
            }
            style={[
              styles.actionButton,
              disabled && styles.disabled,
            ]}
          >
            <Ionicons
              name={
                isActive
                  ? 'lock-closed-outline'
                  : 'lock-open-outline'
              }
              size={16}
              color={colors.primary}
            />

            <Text style={styles.actionText}>
              {isActive ? 'Khóa thành viên' : 'Mở khóa'}
            </Text>
          </Pressable>

          <Pressable
            disabled={disabled}
            onPress={() => onDelete(member)}
            style={[
              styles.actionButton,
              styles.deleteButton,
              disabled && styles.disabled,
            ]}
          >
            <Ionicons
              name="trash-outline"
              size={16}
              color={colors.danger}
            />

            <Text style={styles.deleteText}>
              Xóa
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function ShopMembersScreen() {
  const router = useRouter();

  const params = useLocalSearchParams<{
    shopId?: string | string[];
  }>();

  const shopId =
    typeof params.shopId === 'string'
      ? params.shopId
      : '';

  const validShopId = UUID_REGEX.test(shopId);

  const { status, getAccessToken } = useAuth();

  const [members, setMembers] = useState<ShopMember[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState<number | null>(null);
  const [totalPages, setTotalPages] = useState<number | null>(null);
  const [hasNext, setHasNext] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [search, setSearch] = useState('');
  const [email, setEmail] = useState('');
  const [action, setAction] = useState<MemberAction | null>(null);

  const apiBase =
    ENV.apiUrl.replace(/\/+$/, '') +
    `/api/shops/${encodeURIComponent(shopId)}/members`;

  const apiRequest = useCallback(
    async (
      url: string,
      method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
      body?: JsonObject
    ) => {
      const token = await getAccessToken();

      if (!token) {
        throw new Error(
          'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.'
        );
      }

      const response = await fetch(url, {
        method,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
          ...(body
            ? { 'Content-Type': 'application/json' }
            : {}),
        },
        ...(body
          ? { body: JSON.stringify(body) }
          : {}),
      });

      return parseResponse(response);
    },
    [getAccessToken]
  );

  const loadMembers = useCallback(
    async (targetPage: number, quiet = false) => {
      if (
        status !== 'authenticated' ||
        !validShopId
      ) {
        setLoading(false);
        return;
      }

      if (quiet) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError('');

      try {
        const query =
          `?page=${targetPage}&limit=${PAGE_SIZE}`;

        const data = await apiRequest(
          apiBase + query,
          'GET'
        );

        const collection = getMemberArray(data);

        const normalized = collection
          .map(normalizeMember)
          .filter(
            (item): item is ShopMember => item !== null
          );

        const pagination = parsePagination(data);

        const resolvedPages =
          pagination.totalPages ??
          (pagination.total !== null
            ? Math.max(
                1,
                Math.ceil(pagination.total / PAGE_SIZE)
              )
            : null);

        setMembers(normalized);
        setPage(targetPage);
        setTotal(pagination.total);
        setTotalPages(resolvedPages);

        setHasNext(
          pagination.hasNext ??
            (resolvedPages !== null
              ? targetPage < resolvedPages
              : normalized.length === PAGE_SIZE)
        );
      } catch (caught: unknown) {
        setError(
          caught instanceof Error
            ? caught.message
            : 'Không thể tải danh sách thành viên.'
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [apiBase, apiRequest, status, validShopId]
  );

  useEffect(() => {
    setPage(1);
    setMembers([]);
    setNotice('');
    setSearch('');
    setAction(null);

    void loadMembers(1);
  }, [loadMembers]);

  const filteredMembers = members.filter((member) => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) return true;

    return [
      member.fullName,
      member.email,
      member.phone ?? '',
      member.role,
      member.status,
    ].some((value) =>
      value.toLowerCase().includes(keyword)
    );
  });

  const activeCount = members.filter(
    (item) => item.status.toUpperCase() === 'ACTIVE'
  ).length;

  const lockedCount = members.filter(
    (item) => item.status.toUpperCase() === 'LOCKED'
  ).length;

  const closeModal = () => {
    if (submitting) return;

    setAction(null);
    setEmail('');
  };

  const performAction = async () => {
    if (!action || submitting) return;

    if (action.kind === 'add') {
      if (!EMAIL_REGEX.test(email.trim())) {
        setError('Email nhân viên không hợp lệ.');
        return;
      }
    }

    setSubmitting(true);
    setError('');
    setNotice('');

    try {
      if (action.kind === 'add') {
        await apiRequest(apiBase, 'POST', {
          email: email.trim().toLowerCase(),
        });

        setNotice(
          'Đã gửi yêu cầu thêm thành viên thành công.'
        );
      } else if (action.kind === 'status') {
        await apiRequest(
          `${apiBase}/${encodeURIComponent(action.member.id)}`,
          'PATCH',
          { status: action.status }
        );

        setNotice(
          action.status === 'ACTIVE'
            ? 'Đã mở khóa thành viên.'
            : 'Đã khóa thành viên.'
        );
      } else {
        await apiRequest(
          `${apiBase}/${encodeURIComponent(action.member.id)}`,
          'DELETE'
        );

        setNotice(
          'Đã xóa thành viên khỏi cửa hàng.'
        );
      }

      setAction(null);
      setEmail('');

      await loadMembers(page, true);
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Không thực hiện được thao tác.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const modalTitle =
    action?.kind === 'add'
      ? 'Thêm nhân viên'
      : action?.kind === 'delete'
        ? 'Xác nhận xóa thành viên'
        : action?.status === 'LOCKED'
          ? 'Khóa thành viên?'
          : 'Mở khóa thành viên?';

  const modalDescription =
    action?.kind === 'delete'
      ? `Bạn có chắc muốn xóa ${action.member.fullName} khỏi cửa hàng?`
      : action?.kind === 'status'
        ? action.status === 'LOCKED'
          ? `Thành viên ${action.member.fullName} sẽ bị khóa quyền hoạt động trong cửa hàng.`
          : `Bạn muốn mở khóa cho ${action.member.fullName}?`
        : 'Nhập email của tài khoản SaviBite cần thêm vào cửa hàng.';

  if (status === 'loading') {
    return (
      <CustomerLayout>
        <ScreenContainer style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </ScreenContainer>
      </CustomerLayout>
    );
  }

  if (status !== 'authenticated') {
    return (
      <CustomerLayout>
        <ScreenContainer style={styles.center}>
          <Ionicons
            name="lock-closed-outline"
            size={38}
            color={colors.primary}
          />

          <Text style={styles.title}>
            Vui lòng đăng nhập
          </Text>

          <AppButton
            title="Đăng nhập"
            onPress={() => router.push('/login')}
          />
        </ScreenContainer>
      </CustomerLayout>
    );
  }

  if (!validShopId) {
    return (
      <CustomerLayout>
        <ScreenContainer style={styles.center}>
          <Text style={styles.title}>
            Chưa xác định cửa hàng
          </Text>

          <Text style={styles.muted}>
            Hãy mở màn hình này từ trung tâm quản lý cửa hàng
            để truyền đúng shopId.
          </Text>

          <AppButton
            title="Về quản lý cửa hàng"
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
            Quay lại quản lý cửa hàng
          </Text>
        </Pressable>

        <View style={styles.heading}>
          <View style={styles.headingIcon}>
            <Ionicons
              name="people-outline"
              size={26}
              color={colors.primary}
            />
          </View>

          <Text style={styles.eyebrow}>
            SAVIBITE · SHOP MANAGEMENT
          </Text>

          <Text style={styles.title}>
            Thành viên cửa hàng
          </Text>

          <Text style={styles.muted}>
            Quản lý nhân viên, trạng thái tài khoản và
            quyền tham gia cửa hàng.
          </Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {total ?? members.length}
            </Text>

            <Text style={styles.statLabel}>
              Tổng thành viên
            </Text>
          </View>

          <View style={styles.statCard}>
            <Text style={[styles.statNumber, styles.greenText]}>
              {activeCount}
            </Text>

            <Text style={styles.statLabel}>
              Đang hoạt động (trang này)
            </Text>
          </View>

          <View style={styles.statCard}>
            <Text style={[styles.statNumber, styles.redText]}>
              {lockedCount}
            </Text>

            <Text style={styles.statLabel}>
              Đã khóa (trang này)
            </Text>
          </View>
        </View>

        <View style={styles.panel}>
          <View style={styles.toolbar}>
            <View style={styles.toolbarTitle}>
              <Text style={styles.sectionTitle}>
                Danh sách thành viên
              </Text>

              <Text style={styles.muted}>
                Xem và quản lý các tài khoản thuộc cửa hàng
              </Text>
            </View>

            <AppButton
              title="Thêm nhân viên"
              onPress={() => {
                setEmail('');
                setError('');
                setAction({ kind: 'add' });
              }}
            />
          </View>

          <View style={styles.searchBox}>
            <Ionicons
              name="search-outline"
              size={19}
              color={colors.textMuted}
            />

            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Tìm theo tên, email, vai trò..."
              placeholderTextColor={colors.textMuted}
              style={styles.searchInput}
              autoCorrect={false}
            />

            {!!search && (
              <Pressable onPress={() => setSearch('')}>
                <Ionicons
                  name="close-circle"
                  size={19}
                  color={colors.textMuted}
                />
              </Pressable>
            )}
          </View>

          {!!error && (
            <View style={styles.errorBox}>
              <Ionicons
                name="alert-circle-outline"
                color={colors.danger}
                size={19}
              />

              <Text style={styles.errorText}>
                {error}
              </Text>
            </View>
          )}

          {!!notice && (
            <View style={styles.noticeBox}>
              <Ionicons
                name="checkmark-circle-outline"
                color={colors.eco}
                size={19}
              />

              <Text style={styles.noticeText}>
                {notice}
              </Text>
            </View>
          )}

          {loading ? (
            <View style={styles.emptyBox}>
              <ActivityIndicator
                color={colors.primary}
                size="large"
              />

              <Text style={styles.muted}>
                Đang tải danh sách thành viên...
              </Text>
            </View>
          ) : filteredMembers.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons
                name="people-outline"
                size={38}
                color={colors.textMuted}
              />

              <Text style={styles.emptyTitle}>
                {search
                  ? 'Không tìm thấy thành viên'
                  : 'Chưa có dữ liệu thành viên'}
              </Text>

              <Text style={styles.muted}>
                {search
                  ? 'Hãy thử từ khóa khác. Tìm kiếm chỉ áp dụng trong trang hiện tại.'
                  : 'Bạn có thể thêm nhân viên bằng địa chỉ email SaviBite.'}
              </Text>
            </View>
          ) : (
            <View style={styles.memberGrid}>
              {filteredMembers.map((member) => (
                <MemberCard
                  key={member.id}
                  member={member}
                  disabled={submitting}
                  onStatus={(target, targetStatus) => {
                    setError('');
                    setAction({
                      kind: 'status',
                      member: target,
                      status: targetStatus,
                    });
                  }}
                  onDelete={(target) => {
                    setError('');
                    setAction({
                      kind: 'delete',
                      member: target,
                    });
                  }}
                />
              ))}
            </View>
          )}

          <View style={styles.pagination}>
            <Text style={styles.pageText}>
              Trang {page}
              {totalPages !== null
                ? ` / ${totalPages}`
                : ''}
            </Text>

            <View style={styles.pageActions}>
              <AppButton
                title="Trước"
                variant="outline"
                disabled={loading || refreshing || page <= 1}
                onPress={() => {
                  void loadMembers(page - 1);
                }}
              />

              <AppButton
                title="Tiếp"
                variant="outline"
                disabled={loading || refreshing || !hasNext}
                onPress={() => {
                  void loadMembers(page + 1);
                }}
              />
            </View>
          </View>
        </View>

        <View style={styles.footerActions}>
          <AppButton
            title={
              refreshing
                ? 'Đang làm mới...'
                : 'Làm mới danh sách'
            }
            variant="outline"
            disabled={loading || refreshing || submitting}
            onPress={() => {
              void loadMembers(page, true);
            }}
          />
        </View>
      </ScreenContainer>

      <Modal
        visible={action !== null}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={closeModal}
          />

          <View style={styles.modalPanel}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.modalContent}
            >
              <View style={styles.modalHeading}>
                <Text style={styles.modalTitle}>
                  {modalTitle}
                </Text>

                <Pressable
                  disabled={submitting}
                  onPress={closeModal}
                  hitSlop={10}
                >
                  <Ionicons
                    name="close"
                    size={22}
                    color={colors.textSecondary}
                  />
                </Pressable>
              </View>

              <Text style={styles.muted}>
                {modalDescription}
              </Text>

              {action?.kind === 'add' && (
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>
                    Email tài khoản SaviBite
                  </Text>

                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="nhanvien@example.com"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    editable={!submitting}
                    maxLength={254}
                    style={styles.input}
                  />

                  <Text style={styles.fieldHint}>
                    Email phải thuộc tài khoản đã có trong hệ thống.
                    Backend sẽ quyết định thành viên có được thêm
                    vào cửa hàng hay không.
                  </Text>
                </View>
              )}

              {action?.kind === 'delete' && (
                <View style={styles.deleteWarning}>
                  <Ionicons
                    name="warning-outline"
                    size={20}
                    color={colors.danger}
                  />

                  <Text style={styles.deleteWarningText}>
                    Thao tác này sẽ gọi API DELETE.
                    Chỉ tiếp tục khi bạn chắc chắn muốn
                    xóa thành viên khỏi cửa hàng.
                  </Text>
                </View>
              )}

              <View style={styles.modalActions}>
                <AppButton
                  title="Hủy"
                  variant="outline"
                  disabled={submitting}
                  onPress={closeModal}
                />

                <AppButton
                  title={
                    submitting
                      ? 'Đang xử lý...'
                      : action?.kind === 'add'
                        ? 'Thêm thành viên'
                        : action?.kind === 'delete'
                          ? 'Xác nhận xóa'
                          : action?.status === 'LOCKED'
                            ? 'Xác nhận khóa'
                            : 'Xác nhận mở khóa'
                  }
                  disabled={
                    submitting ||
                    (action?.kind === 'add' &&
                      !EMAIL_REGEX.test(email.trim()))
                  }
                  onPress={() => {
                    void performAction();
                  }}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </CustomerLayout>
  );
}



export default requireAccess(ShopMembersScreen, 'login');
