
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import { ENV } from '../../config/env';
import { useAuth } from '../../features/auth/context/AuthProvider';
import CustomerLayout from '../../shared/components/layout/CustomerLayout';
import ScreenContainer from '../../shared/components/layout/ScreenContainer';
import AppButton from '../../shared/components/ui/AppButton';
import { colors, radius, spacing } from '../../shared/theme';

type Dict = Record<string, unknown>;

type ShopReview = {
  id: string;
  rating: number;
  comment: string;
  customerName: string;
  createdAt: string | null;
  orderCode: string | null;
};

const PAGE_SIZE = 10;

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function obj(value: unknown): Dict | null {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    return null;
  }

  return value as Dict;
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
      field.trim()
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

function bool(
  value: unknown,
  ...keys: string[]
): boolean | null {
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

  return source && 'data' in source
    ? source.data
    : value;
}

function extractList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;

  const source = obj(value);

  if (!source) return [];

  for (const key of [
    'items',
    'reviews',
    'results',
    'records',
  ]) {
    if (Array.isArray(source[key])) {
      return source[key] as unknown[];
    }
  }

  return 'data' in source
    ? extractList(source.data)
    : [];
}

function normalizeReview(
  value: unknown,
  index: number
): ShopReview | null {
  const source = obj(value);

  if (!source) return null;

  const customer =
    obj(source.customer) ??
    obj(source.user);

  const rating = num(
    source,
    'rating',
    'stars',
    'score'
  );

  if (
    rating === null ||
    rating < 1 ||
    rating > 5
  ) {
    return null;
  }

  return {
    id:
      str(source, 'id', 'reviewId') ??
      `review-${index}`,
    rating,
    comment:
      str(
        source,
        'comment',
        'content',
        'reviewText'
      ) ?? '',
    customerName:
      str(
        source,
        'customerName',
        'reviewerName',
        'userName',
        'fullName'
      ) ??
      str(customer, 'fullName', 'name') ??
      'Khách hàng SaviBite',
    createdAt:
      str(
        source,
        'createdAt',
        'reviewedAt',
        'createdDate'
      ),
    orderCode:
      str(
        source,
        'orderCode',
        'orderNumber'
      ),
  };
}

function getPagination(
  data: unknown,
  page: number,
  count: number
) {
  const source = obj(data);
  const nested =
    obj(source?.pagination) ??
    obj(source?.meta);

  const totalPages =
    num(source, 'totalPages', 'pageCount') ??
    num(nested, 'totalPages', 'pageCount');

  const totalCount =
    num(source, 'total', 'totalCount', 'totalItems') ??
    num(nested, 'total', 'totalCount', 'totalItems');

  const explicitNext =
    bool(source, 'hasNextPage', 'hasNext') ??
    bool(nested, 'hasNextPage', 'hasNext');

  return {
    totalPages:
      totalPages ??
      (totalCount !== null
        ? Math.max(
            1,
            Math.ceil(totalCount / PAGE_SIZE)
          )
        : null),
    hasNext:
      explicitNext ??
      (totalPages !== null
        ? page < totalPages
        : totalCount !== null
          ? page * PAGE_SIZE < totalCount
          : count === PAGE_SIZE),
  };
}

function formatDate(value: string | null) {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function initials(value: string) {
  return (
    value
      .trim()
      .split(/\s+/)
      .slice(-2)
      .map((part) =>
        part.charAt(0).toUpperCase()
      )
      .join('') || 'SB'
  );
}

async function parseResponse(
  response: Response
): Promise<unknown> {
  const raw = await response.text();
  let json: unknown = null;

  if (raw.trim()) {
    try {
      json = JSON.parse(raw);
    } catch {
      throw new Error(
        `Dữ liệu Backend không hợp lệ (HTTP ${response.status}).`
      );
    }
  }

  const envelope = obj(json);

  if (
    !response.ok ||
    envelope?.success === false
  ) {
    const apiError = obj(envelope?.error);

    throw new Error(
      str(apiError, 'message', 'detail') ??
      str(envelope, 'message', 'detail') ??
      `HTTP ${response.status}`
    );
  }

  return unwrap(json);
}

function RatingStars({
  rating,
}: {
  rating: number;
}) {
  return (
    <View style={styles.stars}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Ionicons
          key={star}
          name={
            star <= rating
              ? 'star'
              : 'star-outline'
          }
          size={18}
          color={
            star <= rating
              ? '#F2AB27'
              : colors.textMuted
          }
        />
      ))}
    </View>
  );
}

function ReviewCard({
  review,
}: {
  review: ShopReview;
}) {
  return (
    <View style={styles.reviewCard}>
      <View style={styles.cardTop}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {initials(review.customerName)}
          </Text>
        </View>

        <View style={styles.flex}>
          <Text style={styles.customerName}>
            {review.customerName}
          </Text>

          {!!review.createdAt && (
            <Text style={styles.muted}>
              {formatDate(review.createdAt)}
            </Text>
          )}
        </View>

        <View style={styles.ratingBadge}>
          <Ionicons
            name="star"
            size={15}
            color="#D99216"
          />
          <Text style={styles.ratingValue}>
            {review.rating}/5
          </Text>
        </View>
      </View>

      <RatingStars rating={review.rating} />

      <Text style={styles.comment}>
        {review.comment || 'Khách hàng đã đánh giá bằng số sao.'}
      </Text>

      {!!review.orderCode && (
        <Text style={styles.orderCode}>
          Đơn hàng: {review.orderCode}
        </Text>
      )}
    </View>
  );
}

export default function ShopReviewsScreen() {
  const router = useRouter();

  const params = useLocalSearchParams<{
    id?: string | string[];
  }>();

  const shopId =
    typeof params.id === 'string'
      ? params.id
      : '';

  const validShopId = UUID.test(shopId);

  const { getAccessToken } = useAuth();

  const [reviews, setReviews] =
    useState<ShopReview[]>([]);

  const [page, setPage] =
    useState(1);

  const [totalPages, setTotalPages] =
    useState<number | null>(null);

  const [hasNext, setHasNext] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState('');

  const [shopName, setShopName] =
    useState('');

  const [ratingAverage, setRatingAverage] =
    useState<number | null>(null);

  const [totalReviews, setTotalReviews] =
    useState<number | null>(null);

  const load = useCallback(
    async (targetPage: number) => {
      if (!validShopId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      try {
        // API đọc công khai, không yêu cầu người dùng phải đăng nhập.
        // Nếu có JWT, gửi kèm để phù hợp môi trường Backend.
        const token = await getAccessToken();

        const path =
          `${ENV.apiUrl.replace(/\/+$/, '')}` +
          `/api/shops/${encodeURIComponent(shopId)}/reviews` +
          `?page=${targetPage}&limit=${PAGE_SIZE}`;

        const response = await fetch(path, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            ...(token
              ? { Authorization: `Bearer ${token}` }
              : {}),
          },
        });

        const data = await parseResponse(response);
        const rawList = extractList(data);

        const normalized = rawList
          .map(normalizeReview)
          .filter(
            (item): item is ShopReview =>
              item !== null
          );

        const meta = getPagination(
          data,
          targetPage,
          rawList.length
        );

        const source = obj(data);
        const summary =
          obj(source?.summary) ??
          obj(source?.statistics);

        setReviews(normalized);
        setPage(targetPage);
        setTotalPages(meta.totalPages);
        setHasNext(meta.hasNext);

        setShopName(
          str(source, 'shopName') ??
          str(obj(source?.shop), 'name') ??
          ''
        );

        setRatingAverage(
          num(
            source,
            'averageRating',
            'ratingAverage',
            'avgRating'
          ) ??
          num(
            summary,
            'averageRating',
            'ratingAverage',
            'avgRating'
          )
        );

        setTotalReviews(
          num(
            source,
            'totalReviews',
            'reviewCount'
          ) ??
          num(
            summary,
            'totalReviews',
            'reviewCount'
          ) ??
          num(source, 'total', 'totalCount', 'totalItems')
        );

        if (
          rawList.length > 0 &&
          normalized.length === 0
        ) {
          setError(
            'Chưa nhận diện được cấu trúc đánh giá do Backend trả về.'
          );
        }
      } catch (caught: unknown) {
        setError(
          caught instanceof Error
            ? caught.message
            : 'Không thể tải đánh giá cửa hàng.'
        );
      } finally {
        setLoading(false);
      }
    },
    [getAccessToken, shopId, validShopId]
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  if (!validShopId) {
    return (
      <CustomerLayout>
        <ScreenContainer style={styles.center}>
          <Ionicons
            name="alert-circle-outline"
            size={40}
            color={colors.danger}
          />

          <Text style={styles.title}>
            Cửa hàng không hợp lệ
          </Text>

          <Text style={styles.muted}>
            Đường dẫn cần chứa shopId dạng UUID.
          </Text>

          <AppButton
            title="Về trang khám phá"
            onPress={() => router.push('/offers')}
          />
        </ScreenContainer>
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout>
      <ScreenContainer style={styles.page}>
        <Pressable
          style={styles.backLink}
          onPress={() => router.back()}
        >
          <Ionicons
            name="arrow-back"
            size={18}
            color={colors.primary}
          />

          <Text style={styles.backText}>
            Quay lại
          </Text>
        </Pressable>

        <View style={styles.heading}>
          <View style={styles.headingIcon}>
            <Ionicons
              name="chatbubbles-outline"
              size={26}
              color={colors.primary}
            />
          </View>

          <Text style={styles.eyebrow}>
            SAVIBITE · SHOP REVIEWS
          </Text>

          <Text style={styles.title}>
            Đánh giá cửa hàng
          </Text>

          <Text style={styles.muted}>
            {shopName ||
              'Xem trải nghiệm thực tế của khách hàng về cửa hàng.'}
          </Text>
        </View>

        <View style={styles.summary}>
          <View style={styles.summaryMain}>
            <Text style={styles.smallLabel}>
              ĐIỂM ĐÁNH GIÁ
            </Text>

            <View style={styles.summaryNumberRow}>
              <Ionicons
                name="star"
                size={28}
                color="#F2AB27"
              />

              <Text style={styles.summaryNumber}>
                {ratingAverage !== null
                  ? ratingAverage.toFixed(1)
                  : '--'}
              </Text>

              <Text style={styles.muted}>
                / 5
              </Text>
            </View>

            <Text style={styles.muted}>
              {ratingAverage === null
                ? 'Backend chưa cung cấp điểm trung bình.'
                : 'Điểm trung bình do Backend cung cấp.'}
            </Text>
          </View>

          <View style={styles.summarySide}>
            <Ionicons
              name="people-outline"
              size={23}
              color={colors.primary}
            />

            <Text style={styles.summaryCount}>
              {totalReviews ?? '--'}
            </Text>

            <Text style={styles.muted}>
              Lượt đánh giá
            </Text>
          </View>
        </View>

        <View style={styles.panel}>
          <View style={styles.toolbar}>
            <View style={styles.flex}>
              <Text style={styles.sectionTitle}>
                Nhận xét từ khách hàng
              </Text>

              <Text style={styles.muted}>
                Đánh giá hiển thị theo dữ liệu Backend.
              </Text>
            </View>

            <AppButton
              title="Làm mới"
              variant="outline"
              disabled={loading}
              onPress={() => {
                void load(page);
              }}
            />
          </View>

          {!!error && (
            <View style={styles.errorBox}>
              <Ionicons
                name="alert-circle-outline"
                size={20}
                color={colors.danger}
              />
              <Text style={styles.errorText}>
                {error}
              </Text>
            </View>
          )}

          {loading ? (
            <View style={styles.empty}>
              <ActivityIndicator
                color={colors.primary}
                size="large"
              />

              <Text style={styles.muted}>
                Đang tải đánh giá...
              </Text>
            </View>
          ) : reviews.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={42}
                color={colors.textMuted}
              />

              <Text style={styles.emptyTitle}>
                Chưa có đánh giá để hiển thị
              </Text>

              <Text style={styles.muted}>
                Các đánh giá từ khách hàng sẽ được
                hiển thị tại đây.
              </Text>
            </View>
          ) : (
            <View style={styles.reviewList}>
              {reviews.map((review, index) => (
                <ReviewCard
                  key={`${review.id}-${index}`}
                  review={review}
                />
              ))}
            </View>
          )}

          <View style={styles.pagination}>
            <Text style={styles.muted}>
              Trang {page}
              {totalPages !== null
                ? ` / ${totalPages}`
                : ''}
            </Text>

            <View style={styles.pageActions}>
              <AppButton
                title="Trước"
                variant="outline"
                disabled={
                  loading || page <= 1
                }
                onPress={() => {
                  void load(page - 1);
                }}
              />

              <AppButton
                title="Tiếp"
                variant="outline"
                disabled={
                  loading || !hasNext
                }
                onPress={() => {
                  void load(page + 1);
                }}
              />
            </View>
          </View>
        </View>
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
  center: {
    minHeight: 420,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  backLink: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  backText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  heading: {
    gap: spacing.sm,
  },
  headingIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.eco,
    letterSpacing: 1.2,
  },
  title: {
    fontSize: 29,
    fontWeight: '800',
    color: colors.text,
  },
  muted: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 21,
  },
  summary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  summaryMain: {
    flexGrow: 2,
    flexBasis: 220,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  summarySide: {
    flexGrow: 1,
    flexBasis: 150,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  smallLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  summaryNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  summaryNumber: {
    fontSize: 33,
    fontWeight: '800',
    color: colors.text,
  },
  summaryCount: {
    fontSize: 29,
    fontWeight: '800',
    color: colors.primary,
  },
  panel: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  toolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  flex: {
    flex: 1,
    gap: spacing.xs,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: colors.text,
  },
  errorBox: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: '#FFF0EF',
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    color: colors.danger,
  },
  empty: {
    minHeight: 190,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  reviewList: {
    gap: spacing.md,
  },
  reviewCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  avatar: {
    height: 46,
    width: 46,
    borderRadius: 23,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '800',
  },
  customerName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radius.pill,
    backgroundColor: '#FFF5DB',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  ratingValue: {
    color: '#94620A',
    fontWeight: '800',
    fontSize: 12,
  },
  stars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  comment: {
    fontSize: 14,
    lineHeight: 23,
    color: colors.text,
  },
  orderCode: {
    fontSize: 12,
    color: colors.textMuted,
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
});
