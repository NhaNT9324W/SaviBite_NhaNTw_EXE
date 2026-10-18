
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
import AppButton from '../shared/components/ui/AppButton';
import { colors, radius, spacing } from '../shared/theme';

type Dict = Record<string, unknown>;

type ReviewOrder = {
  id: string;
  code: string;
  shopId: string | null;
  shopName: string;
  status: string;
  total: number | null;
  canReview: boolean | null;
  reviewed: boolean;
};

type ReviewInfo = {
  rating: number;
  comment: string;
};

const PAGE_SIZE = 10;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function obj(value: unknown): Dict | null {
  return value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
    ? (value as Dict)
    : null;
}

function str(value: unknown, ...keys: string[]): string | null {
  const source = obj(value);
  if (!source) return null;
  for (const key of keys) {
    if (typeof source[key] === 'string' && source[key].trim()) {
      return (source[key] as string).trim();
    }
  }
  return null;
}

function num(value: unknown, ...keys: string[]): number | null {
  const source = obj(value);
  if (!source) return null;
  for (const key of keys) {
    const field = source[key];
    if (typeof field === 'number' && Number.isFinite(field)) {
      return field;
    }
  }
  return null;
}

function bool(value: unknown, ...keys: string[]): boolean | null {
  const source = obj(value);
  if (!source) return null;
  for (const key of keys) {
    if (typeof source[key] === 'boolean') {
      return source[key] as boolean;
    }
  }
  return null;
}

function unwrap(value: unknown): unknown {
  const source = obj(value);
  return source && 'data' in source ? source.data : value;
}

function collection(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const source = obj(value);
  if (!source) return [];

  for (const key of ['items', 'orders', 'results', 'records']) {
    if (Array.isArray(source[key])) return source[key] as unknown[];
  }

  return 'data' in source ? collection(source.data) : [];
}

function pagination(value: unknown, page: number, count: number) {
  const source = obj(value);
  const meta = obj(source?.pagination) ?? obj(source?.meta);

  const total =
    num(source, 'totalPages', 'pageCount') ??
    num(meta, 'totalPages', 'pageCount');

  const totalItems =
    num(source, 'total', 'totalCount', 'totalItems') ??
    num(meta, 'total', 'totalCount', 'totalItems');

  const explicitNext =
    bool(source, 'hasNextPage', 'hasNext') ??
    bool(meta, 'hasNextPage', 'hasNext');

  return {
    totalPages:
      total ??
      (totalItems !== null
        ? Math.max(1, Math.ceil(totalItems / PAGE_SIZE))
        : null),
    hasNext:
      explicitNext ??
      (total !== null
        ? page < total
        : totalItems !== null
          ? page * PAGE_SIZE < totalItems
          : count === PAGE_SIZE),
  };
}

function normalizeOrder(value: unknown): ReviewOrder | null {
  const source = obj(value);
  if (!source) return null;

  const order = obj(source.order) ?? source;
  const shop = obj(order.shop) ?? obj(source.shop);

  const id =
    str(order, 'orderId', 'id') ??
    str(source, 'orderId', 'id');

  if (!id || !UUID.test(id)) return null;

  const reviewFlag =
    bool(source, 'hasReview', 'isReviewed', 'reviewed') ??
    bool(order, 'hasReview', 'isReviewed', 'reviewed');

  const canReview =
    bool(source, 'canReview', 'isEligible', 'eligible') ??
    bool(order, 'canReview', 'isEligible', 'eligible');

  return {
    id,
    code:
      str(order, 'orderCode', 'code', 'orderNumber') ??
      str(source, 'orderCode', 'code') ??
      id,
    shopId:
      str(source, 'shopId') ??
      str(order, 'shopId') ??
      str(shop, 'id'),
    shopName:
      str(source, 'shopName') ??
      str(order, 'shopName') ??
      str(shop, 'name') ??
      'Cửa hàng',
    status:
      str(order, 'status', 'orderStatus') ??
      str(source, 'status', 'orderStatus') ??
      '',
    total:
      num(order, 'totalAmount', 'totalPrice', 'total') ??
      num(source, 'totalAmount', 'totalPrice', 'total'),
    canReview,
    reviewed: reviewFlag === true || obj(source.review) !== null,
  };
}

function parseReview(value: unknown): ReviewInfo | null {
  const source = obj(value);
  if (!source) return null;

  const nested = obj(source.review) ?? source;
  const rating = num(nested, 'rating', 'stars', 'score');

  if (rating === null || rating < 1 || rating > 5) return null;

  return {
    rating,
    comment: str(nested, 'comment', 'content', 'reviewText') ?? '',
  };
}

async function readResponse(response: Response): Promise<unknown> {
  const raw = await response.text();
  let json: unknown = null;

  if (raw.trim()) {
    try {
      json = JSON.parse(raw);
    } catch {
      throw new Error(`Backend trả về dữ liệu không hợp lệ (HTTP ${response.status}).`);
    }
  }

  const envelope = obj(json);

  if (!response.ok || envelope?.success === false) {
    const apiError = obj(envelope?.error);
    throw new Error(
      str(apiError, 'message', 'detail') ??
      str(envelope, 'message', 'detail') ??
      `Yêu cầu thất bại (HTTP ${response.status}).`
    );
  }

  return unwrap(json);
}

function money(value: number | null) {
  if (value === null) return 'Chưa có thông tin';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
}

function labelStatus(value: string) {
  switch (value.toUpperCase()) {
    case 'COMPLETED': return 'Đã hoàn thành';
    case 'PAID': return 'Đã thanh toán';
    case 'CANCELLED': return 'Đã hủy';
    case 'EXPIRED': return 'Đã hết hạn';
    default: return value || 'Đơn hàng';
  }
}

function Stars({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange?: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.stars}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Pressable
          key={star}
          disabled={!onChange || disabled}
          accessibilityRole={onChange ? 'button' : undefined}
          accessibilityLabel={`${star} sao`}
          onPress={() => onChange?.(star)}
          hitSlop={5}
        >
          <Ionicons
            name={star <= value ? 'star' : 'star-outline'}
            size={onChange ? 34 : 20}
            color={star <= value ? '#F2AB27' : colors.textMuted}
          />
        </Pressable>
      ))}
    </View>
  );
}

export default function ReviewsScreen() {
  const router = useRouter();
  const { status, getAccessToken } = useAuth();

  const [orders, setOrders] = useState<ReviewOrder[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState<number | null>(null);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [selected, setSelected] = useState<ReviewOrder | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [existingReview, setExistingReview] = useState<ReviewInfo | null>(null);
  const [checkingReview, setCheckingReview] = useState(false);
  const [modalError, setModalError] = useState('');

  const api = useCallback(async (
    path: string,
    method: 'GET' | 'POST' = 'GET',
    body?: Dict
  ) => {
    const token = await getAccessToken();
    if (!token) throw new Error('Phiên đăng nhập đã hết hạn.');

    const response = await fetch(
      `${ENV.apiUrl.replace(/\/+$/, '')}${path}`,
      {
        method,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }
    );

    return readResponse(response);
  }, [getAccessToken]);

  const load = useCallback(async (targetPage: number) => {
    if (status !== 'authenticated') {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = await api(
        `/api/me/review-orders?page=${targetPage}&limit=${PAGE_SIZE}`
      );

      const items = collection(data);
      const normalized = items
        .map(normalizeOrder)
        .filter((item): item is ReviewOrder => item !== null);

      const meta = pagination(data, targetPage, items.length);

      setOrders(normalized);
      setPage(targetPage);
      setHasNext(meta.hasNext);
      setTotalPages(meta.totalPages);

      if (items.length > 0 && normalized.length === 0) {
        setError('Chưa nhận diện được cấu trúc danh sách đơn đánh giá từ Backend.');
      }
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Không thể tải danh sách.');
    } finally {
      setLoading(false);
    }
  }, [api, status]);

  useEffect(() => {
    if (status === 'authenticated') {
      void load(1);
    } else {
      setLoading(false);
    }
  }, [load, status]);

  const openReview = async (order: ReviewOrder) => {
    setSelected(order);
    setRating(5);
    setComment('');
    setExistingReview(null);
    setModalError('');
    setCheckingReview(true);

    try {
      const data = await api(`/api/orders/${order.id}/review`);
      const review = parseReview(data);

      if (review) {
        setExistingReview(review);
        setRating(review.rating);
        setComment(review.comment);
      }
    } catch (caught: unknown) {
      // Không có review trước đó có thể là 404.
      // Với lỗi khác, vẫn hiển thị để tránh nhầm là chưa đánh giá.
      const message = caught instanceof Error ? caught.message : '';
      if (!/404|chưa đánh giá|không tìm thấy đánh giá/i.test(message)) {
        setModalError(message || 'Không thể kiểm tra đánh giá trước đó.');
      }
    } finally {
      setCheckingReview(false);
    }
  };

  const submitReview = async () => {
    if (!selected || busy || checkingReview || existingReview || modalError) {
      return;
    }

    if (rating < 1 || rating > 5 || comment.length > 1000) {
      setModalError('Số sao hoặc nội dung đánh giá không hợp lệ.');
      return;
    }

    setBusy(true);
    setModalError('');

    try {
      await api(`/api/orders/${selected.id}/review`, 'POST', {
        rating,
        comment: comment.trim() || null,
      });

      setNotice('Backend đã ghi nhận đánh giá thành công.');
      setSelected(null);
      setExistingReview(null);
      await load(page);
    } catch (caught: unknown) {
      setModalError(
        caught instanceof Error ? caught.message : 'Không thể gửi đánh giá.'
      );
    } finally {
      setBusy(false);
    }
  };

  if (status === 'loading') {
    return (
      <CustomerLayout>
        <ScreenContainer style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </ScreenContainer>
      </CustomerLayout>
    );
  }

  if (status !== 'authenticated') {
    return (
      <CustomerLayout>
        <ScreenContainer style={styles.center}>
          <Text style={styles.title}>Đăng nhập để đánh giá</Text>
          <AppButton title="Đăng nhập" onPress={() => router.push('/login')} />
        </ScreenContainer>
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout>
      <ScreenContainer style={styles.page}>
        <Pressable style={styles.backLink} onPress={() => router.push('/orders')}>
          <Ionicons name="arrow-back" size={18} color={colors.primary} />
          <Text style={styles.backText}>Quay lại đơn hàng</Text>
        </Pressable>

        <View style={styles.heading}>
          <View style={styles.headingIcon}>
            <Ionicons name="star-outline" size={26} color={colors.primary} />
          </View>
          <Text style={styles.eyebrow}>SAVIBITE · REVIEWS</Text>
          <Text style={styles.title}>Đánh giá đơn hàng</Text>
          <Text style={styles.muted}>
            Chia sẻ trải nghiệm nhận món để giúp cửa hàng cải thiện chất lượng.
          </Text>
        </View>

        {!!notice && (
          <View style={styles.successBox}>
            <Ionicons name="checkmark-circle-outline" color={colors.eco} size={20} />
            <Text style={styles.successText}>{notice}</Text>
          </View>
        )}

        {!!error && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" color={colors.danger} size={20} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.panel}>
          <View style={styles.toolbar}>
            <View style={styles.flex}>
              <Text style={styles.sectionTitle}>Đơn hàng và đánh giá</Text>
              <Text style={styles.muted}>
                Danh sách do Backend cung cấp. Điều kiện gửi đánh giá được kiểm tra tại Backend.
              </Text>
            </View>
            <AppButton
              title="Làm mới"
              variant="outline"
              disabled={loading}
              onPress={() => { void load(page); }}
            />
          </View>

          {loading ? (
            <View style={styles.empty}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.muted}>Đang tải đơn hàng...</Text>
            </View>
          ) : orders.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="receipt-outline" size={40} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>Chưa có đơn hàng để hiển thị</Text>
              <Text style={styles.muted}>
                Khi Backend trả về đơn có thể đánh giá, danh sách sẽ xuất hiện tại đây.
              </Text>
            </View>
          ) : (
            <View style={styles.list}>
              {orders.map((order) => (
                <View key={order.id} style={styles.orderCard}>
                  <View style={styles.orderTop}>
                    <View style={styles.flex}>
                      <Text style={styles.smallLabel}>MÃ ĐƠN</Text>
                      <Text style={styles.orderCode}>{order.code}</Text>
                    </View>
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{labelStatus(order.status)}</Text>
                    </View>
                  </View>

                  <View style={styles.divider} />

                  <View style={styles.row}>
                    <Ionicons name="storefront-outline" size={19} color={colors.primary} />
                    <Text style={styles.shopName}>{order.shopName}</Text>
                  </View>

                  {order.total !== null && (
                    <Text style={styles.total}>{money(order.total)}</Text>
                  )}

                  <View style={styles.cardActions}>
                    <AppButton
                      title={order.reviewed ? 'Xem đánh giá' : 'Đánh giá / Xem đánh giá'}
                      variant={order.reviewed ? 'outline' : 'primary'}
                      onPress={() => { void openReview(order); }}
                    />

                    {!!order.shopId && UUID.test(order.shopId) && (
                      <AppButton
                        title="Đánh giá cửa hàng"
                        variant="outline"
                        onPress={() =>
                          router.push({
                            pathname: '/shop-reviews/[id]',
                            params: { id: order.shopId! },
                          })
                        }
                      />
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}

          <View style={styles.pagination}>
            <Text style={styles.muted}>
              Trang {page}{totalPages !== null ? ` / ${totalPages}` : ''}
            </Text>
            <View style={styles.pageActions}>
              <AppButton
                title="Trước"
                variant="outline"
                disabled={loading || page <= 1}
                onPress={() => { void load(page - 1); }}
              />
              <AppButton
                title="Tiếp"
                variant="outline"
                disabled={loading || !hasNext}
                onPress={() => { void load(page + 1); }}
              />
            </View>
          </View>
        </View>
      </ScreenContainer>

      <Modal
        visible={selected !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!busy) setSelected(null);
        }}
      >
        <View style={styles.backdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              if (!busy) setSelected(null);
            }}
          />

          <View style={styles.modalPanel}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.modalBody}
            >
              <View style={styles.modalHeading}>
                <View style={styles.flex}>
                  <Text style={styles.sectionTitle}>
                    {existingReview ? 'Đánh giá của bạn' : 'Đánh giá đơn hàng'}
                  </Text>
                  <Text style={styles.muted}>{selected?.code}</Text>
                </View>
                <Pressable
                  disabled={busy}
                  onPress={() => setSelected(null)}
                  hitSlop={8}
                >
                  <Ionicons name="close" size={23} color={colors.textSecondary} />
                </Pressable>
              </View>

              {checkingReview ? (
                <View style={styles.empty}>
                  <ActivityIndicator color={colors.primary} />
                  <Text style={styles.muted}>Đang kiểm tra đánh giá...</Text>
                </View>
              ) : (
                <>
                  <View style={styles.field}>
                    <Text style={styles.label}>Mức độ hài lòng</Text>
                    <Stars
                      value={rating}
                      onChange={setRating}
                      disabled={!!existingReview || !!modalError || busy}
                    />
                    <Text style={styles.muted}>
                      {rating}/5 sao
                    </Text>
                  </View>

                  <View style={styles.field}>
                    <Text style={styles.label}>Nhận xét (không bắt buộc)</Text>
                    <TextInput
                      value={comment}
                      onChangeText={setComment}
                      multiline
                      maxLength={1000}
                      editable={!existingReview && !busy && !modalError}
                      placeholder="Chia sẻ trải nghiệm về món ăn và nhận hàng..."
                      placeholderTextColor={colors.textMuted}
                      textAlignVertical="top"
                      style={styles.commentInput}
                    />
                    <Text style={styles.count}>{comment.length}/1000 ký tự</Text>
                  </View>

                  {!!modalError && (
                    <View style={styles.errorBox}>
                      <Text style={styles.errorText}>{modalError}</Text>
                    </View>
                  )}

                  {existingReview && (
                    <View style={styles.successBox}>
                      <Text style={styles.successText}>
                        Đơn hàng này đã có đánh giá. Nội dung được hiển thị ở chế độ chỉ đọc.
                      </Text>
                    </View>
                  )}

                  <View style={styles.modalActions}>
                    <AppButton
                      title="Đóng"
                      variant="outline"
                      disabled={busy}
                      onPress={() => setSelected(null)}
                    />
                    {!existingReview && (
                      <AppButton
                        title={busy ? 'Đang gửi...' : 'Gửi đánh giá'}
                        disabled={busy || !!modalError}
                        onPress={() => { void submitReview(); }}
                      />
                    )}
                  </View>
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
    paddingTop: spacing.xxl,
    paddingBottom: spacing.section,
    gap: spacing.xl,
  },
  center: {
    minHeight: 420,
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
  heading: { gap: spacing.sm },
  headingIcon: {
    height: 52,
    width: 52,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: colors.eco,
  },
  title: {
    fontSize: 29,
    fontWeight: '800',
    color: colors.text,
  },
  muted: {
    fontSize: 13,
    lineHeight: 21,
    color: colors.textSecondary,
  },
  panel: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.xl,
    backgroundColor: colors.surface,
    gap: spacing.lg,
  },
  toolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  flex: { flex: 1, gap: spacing.xs },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: colors.text,
  },
  empty: {
    minHeight: 150,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  list: { gap: spacing.md },
  orderCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.md,
  },
  orderTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  smallLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
  },
  orderCode: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  shopName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  total: {
    color: colors.primary,
    fontSize: 19,
    fontWeight: '800',
  },
  cardActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  pagination: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  pageActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: '#EAF6E4',
    padding: spacing.md,
  },
  successText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    color: colors.eco,
    fontWeight: '700',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: '#FFF0EF',
    padding: spacing.md,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    color: colors.danger,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.48)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalPanel: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '88%',
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  modalBody: {
    padding: spacing.xl,
    gap: spacing.lg,
  },
  modalHeading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  field: { gap: spacing.sm },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  stars: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.md,
  },
  commentInput: {
    minHeight: 118,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    padding: spacing.md,
    fontSize: 14,
    lineHeight: 22,
    color: colors.text,
  },
  count: {
    fontSize: 12,
    textAlign: 'right',
    color: colors.textMuted,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
});
