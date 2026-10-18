
import { Ionicons } from '@expo/vector-icons';
import {
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

import CustomerLayout from '../../shared/components/layout/CustomerLayout';
import ScreenContainer from '../../shared/components/layout/ScreenContainer';
import AppButton from '../../shared/components/ui/AppButton';

import {
  colors,
  layout,
  radius,
  spacing,
} from '../../shared/theme';

import OfferCard from '../../features/offers/components/OfferCard';
import { useOffers } from '../../features/offers/hooks/useOffers';

import type {
  OfferFilters,
  OfferType,
} from '../../features/offers/types/offer.types';

type Category = 'ALL' | OfferType;

type SortMode =
  | 'endingSoon'
  | 'priceAsc'
  | 'priceDesc';

const PAGE_SIZE = 9;

const CATEGORIES: {
  value: Category;
  label: string;
}[] = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'FLASH_SALE', label: 'Flash Sale' },
  { value: 'SAVIBITE_BOX', label: 'SaviBite Box' },
];

const SORT_OPTIONS: {
  value: SortMode;
  label: string;
}[] = [
  {
    value: 'endingSoon',
    label: 'Sắp kết thúc',
  },
  {
    value: 'priceAsc',
    label: 'Giá thấp đến cao',
  },
  {
    value: 'priceDesc',
    label: 'Giá cao đến thấp',
  },
];

function parseCategory(value: unknown): Category {
  if (
    value === 'FLASH_SALE' ||
    value === 'SAVIBITE_BOX'
  ) {
    return value;
  }

  return 'ALL';
}

export default function OffersScreen() {
  const router = useRouter();

  const params = useLocalSearchParams<{
    type?: string;
  }>();

  const { width } = useWindowDimensions();

  const [category, setCategory] = useState<Category>(
    parseCategory(params.type)
  );

  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [sortMode, setSortMode] =
    useState<SortMode>('endingSoon');

  const [page, setPage] = useState(1);

  useEffect(() => {
    setCategory(parseCategory(params.type));
    setPage(1);
  }, [params.type]);

  const desktop = width >= layout.breakpoint.desktop;
  const tablet = width >= layout.breakpoint.tablet;

  const columns = desktop ? 3 : tablet ? 2 : 1;

  const filters: OfferFilters = {
    page,
    limit: PAGE_SIZE,

    ...(category !== 'ALL'
      ? { type: category }
      : {}),

    ...(searchQuery
      ? { q: searchQuery }
      : {}),

    sortBy:
      sortMode === 'endingSoon'
        ? 'endingSoon'
        : 'price',

    sortOrder:
      sortMode === 'priceDesc'
        ? 'desc'
        : 'asc',
  };

  const { data, loading, error, reload } =
    useOffers(filters);

  const goToOffer = (id: string) => {
    router.push({
      pathname: '/offer/[id]',
      params: { id },
    });
  };

  const changeCategory = (next: Category) => {
    setCategory(next);
    setPage(1);
  };

  const changeSort = (next: SortMode) => {
    setSortMode(next);
    setPage(1);
  };

  const submitSearch = () => {
    setSearchQuery(searchInput.trim());
    setPage(1);
  };

  const resetFilters = () => {
    setCategory('ALL');
    setSearchInput('');
    setSearchQuery('');
    setSortMode('endingSoon');
    setPage(1);
  };

  return (
    <CustomerLayout>
      {/* PAGE HEADER */}
      <View style={styles.pageHeader}>
        <ScreenContainer style={styles.headerContent}>
          <Text style={styles.eyebrow}>
            SAVIBITE MARKETPLACE
          </Text>

          <Text style={styles.pageTitle}>
            Khám phá ưu đãi
          </Text>

          <Text style={styles.pageDescription}>
            Tìm những món ngon đang được ưu đãi từ các
            cửa hàng. Đặt trước trực tuyến và đến nhận
            đúng thời gian.
          </Text>
        </ScreenContainer>
      </View>

      <ScreenContainer style={styles.main}>
        {/* SEARCH */}
        <View style={styles.searchBar}>
          <View style={styles.searchField}>
            <Ionicons
              name="search-outline"
              size={20}
              color={colors.textMuted}
            />

            <TextInput
              value={searchInput}
              onChangeText={setSearchInput}
              onSubmitEditing={submitSearch}
              returnKeyType="search"
              placeholder="Tìm tên món ăn hoặc ưu đãi..."
              placeholderTextColor={colors.textMuted}
              style={styles.searchInput}
              accessibilityLabel="Tìm kiếm ưu đãi"
            />
          </View>

          <AppButton
            title="Tìm kiếm"
            onPress={submitSearch}
          />
        </View>

        {/* CATEGORY FILTER */}
        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>
            Loại ưu đãi
          </Text>

          <View style={styles.categoryTabs}>
            {CATEGORIES.map((item) => {
              const selected =
                category === item.value;

              return (
                <Pressable
                  key={item.value}
                  onPress={() =>
                    changeCategory(item.value)
                  }
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={[
                    styles.categoryTab,
                    selected &&
                      styles.categoryTabActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.categoryTabText,
                      selected &&
                        styles.categoryTabTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* RESULT TOOLBAR */}
        <View style={styles.toolbar}>
          <View style={styles.resultSummary}>
            <Text style={styles.resultTitle}>
              Danh sách ưu đãi
            </Text>

            {!loading && !error && data && (
              <Text style={styles.resultCount}>
                {data.totalItems} kết quả
              </Text>
            )}
          </View>

          <View style={styles.sortArea}>
            <Text style={styles.sortLabel}>
              Sắp xếp:
            </Text>

            <View style={styles.sortOptions}>
              {SORT_OPTIONS.map((item) => {
                const selected =
                  sortMode === item.value;

                return (
                  <Pressable
                    key={item.value}
                    onPress={() =>
                      changeSort(item.value)
                    }
                    style={[
                      styles.sortOption,
                      selected &&
                        styles.sortOptionActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.sortOptionText,
                        selected &&
                          styles.sortOptionTextActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        {/* OFFERS */}
        {loading ? (
          <View style={styles.feedback}>
            <ActivityIndicator
              size="large"
              color={colors.primary}
            />

            <Text style={styles.feedbackText}>
              Đang tải danh sách ưu đãi...
            </Text>
          </View>
        ) : error ? (
          <View style={styles.feedback}>
            <Ionicons
              name="alert-circle-outline"
              size={36}
              color={colors.danger}
            />

            <Text style={styles.feedbackTitle}>
              Không thể tải ưu đãi
            </Text>

            <Text style={styles.feedbackText}>
              {error}
            </Text>

            <AppButton
              title="Thử lại"
              variant="outline"
              onPress={reload}
            />
          </View>
        ) : !data?.items.length ? (
          <View style={styles.feedback}>
            <Ionicons
              name="restaurant-outline"
              size={36}
              color={colors.textMuted}
            />

            <Text style={styles.feedbackTitle}>
              Không tìm thấy ưu đãi phù hợp
            </Text>

            <Text style={styles.feedbackText}>
              Hiện chưa có ưu đãi đáp ứng bộ lọc.
              Bạn có thể chọn loại khác hoặc xóa bộ lọc.
            </Text>

            <AppButton
              title="Xóa bộ lọc"
              variant="outline"
              onPress={resetFilters}
            />
          </View>
        ) : (
          <>
            <View style={styles.grid}>
              {data.items.map((offer) => (
                <View
                  key={offer.id}
                  style={[
                    styles.gridItem,
                    columns === 3 &&
                      styles.gridItemDesktop,
                    columns === 2 &&
                      styles.gridItemTablet,
                  ]}
                >
                  <OfferCard
                    offer={offer}
                    onPress={() =>
                      goToOffer(offer.id)
                    }
                  />
                </View>
              ))}
            </View>

            {/* PAGINATION */}
            <View style={styles.pagination}>
              <AppButton
                title="Trang trước"
                variant="outline"
                disabled={page <= 1}
                onPress={() =>
                  setPage((current) =>
                    Math.max(1, current - 1)
                  )
                }
              />

              <Text style={styles.pageIndicator}>
                Trang {page} /{' '}
                {Math.max(1, data.totalPages)}
              </Text>

              <AppButton
                title="Trang sau"
                variant="outline"
                disabled={page >= data.totalPages}
                onPress={() =>
                  setPage((current) => current + 1)
                }
              />
            </View>
          </>
        )}
      </ScreenContainer>
    </CustomerLayout>
  );
}

const styles = StyleSheet.create({
  pageHeader: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerContent: {
    paddingTop: spacing.xxxl,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  eyebrow: {
    color: colors.eco,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.3,
  },
  pageTitle: {
    color: colors.text,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  pageDescription: {
    maxWidth: 650,
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 25,
  },
  main: {
    paddingTop: spacing.xxl,
    paddingBottom: spacing.section,
    gap: spacing.xxl,
  },
  searchBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.md,
  },
  searchField: {
    flex: 1,
    minWidth: 220,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.base,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    paddingVertical: spacing.md,
  },
  filterSection: {
    gap: spacing.md,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  categoryTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  categoryTab: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  categoryTabActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  categoryTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  categoryTabTextActive: {
    color: colors.white,
  },
  toolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  resultSummary: {
    gap: spacing.xs,
  },
  resultTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: colors.text,
  },
  resultCount: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  sortArea: {
    gap: spacing.sm,
  },
  sortLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  sortOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  sortOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.xs,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sortOptionActive: {
    borderColor: colors.primary,
    backgroundColor: '#EAF2FC',
  },
  sortOptionText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  sortOptionTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.xl,
  },
  gridItem: {
    width: '100%',
  },
  gridItemTablet: {
    width: '48.5%',
  },
  gridItemDesktop: {
    width: '31.8%',
  },
  feedback: {
    minHeight: 280,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.base,
    padding: spacing.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  feedbackTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  feedbackText: {
    maxWidth: 420,
    fontSize: 14,
    lineHeight: 23,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  pagination: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.lg,
    paddingTop: spacing.lg,
  },
  pageIndicator: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
});
