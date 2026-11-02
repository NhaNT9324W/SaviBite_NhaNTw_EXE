
import { Ionicons } from '@expo/vector-icons';
import {
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

import CustomerLayout from '../../../shared/components/layout/CustomerLayout';
import OfferFeedback from '../../../shared/components/ui/OfferFeedback';
import ScreenContainer from '../../../shared/components/layout/ScreenContainer';
import AppButton from '../../../shared/components/ui/AppButton';

import {
  colors,
  layout,
  radius,
  spacing,
} from '../../../shared/theme';

import OfferCard from '../components/OfferCard';
import { useOffers } from '../hooks/useOffers';
import { offerApi } from '../api/offer.api';

import type {
  OfferFilters,
  OfferType,
} from '../types/offer.types';

type Category = 'ALL' | OfferType;

type PriceRange = 'ALL' | 'UNDER_30K' | '30K_50K' | '50K_100K' | 'OVER_100K';

const PRICE_RANGES: { value: PriceRange; label: string; min?: number; max?: number }[] = [
  { value: 'ALL', label: 'Tất cả giá' },
  { value: 'UNDER_30K', label: '< 30.000đ', max: 30000 },
  { value: '30K_50K', label: '30k - 50k', min: 30000, max: 50000 },
  { value: '50K_100K', label: '50k - 100k', min: 50000, max: 100000 },
  { value: 'OVER_100K', label: '> 100.000đ', min: 100000 },
];

const POPULAR_SEARCH_TAGS = [
  'Bánh ngọt',
  'Cơm sườn',
  'Cà phê',
  'Trà sữa',
  'Bánh mì',
  'Ăn vặt',
];

type SortMode =
  | 'endingSoon'
  | 'priceAsc'
  | 'priceDesc';

const PAGE_SIZE = 9;

const CATEGORIES: {
  value: Category;
  label: string;
}[] = [
  { value: 'ALL', label: 'Tất cả loại' },
  { value: 'FLASH_SALE', label: '⚡ Flash Sale' },
  { value: 'SAVIBITE_BOX', label: '🎁 SaviBite Box' },
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

  const [selectedFoodCategory, setSelectedFoodCategory] = useState<string>('ALL');
  const [priceRange, setPriceRange] = useState<PriceRange>('ALL');
  const [showFilterPanel, setShowFilterPanel] = useState<boolean>(false);
  const [categoriesList, setCategoriesList] = useState<{ id: string; name: string }[]>([]);

  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [sortMode, setSortMode] =
    useState<SortMode>('endingSoon');

  const [page, setPage] = useState(1);

  useEffect(() => {
    setCategory(parseCategory(params.type));
    setPage(1);
  }, [params.type]);

  useEffect(() => {
    offerApi
      .getFilterOptions()
      .then((res) => {
        if (res?.categories && Array.isArray(res.categories)) {
          setCategoriesList(res.categories);
        }
      })
      .catch(() => {});
  }, []);

  const desktop = width >= layout.breakpoint.desktop;
  const tablet = width >= layout.breakpoint.tablet;

  const columns = desktop ? 3 : tablet ? 2 : 1;

  const currentPriceRange = PRICE_RANGES.find((p) => p.value === priceRange);

  const filters: OfferFilters = {
    page,
    limit: PAGE_SIZE,

    ...(category !== 'ALL'
      ? { type: category }
      : {}),

    ...(selectedFoodCategory !== 'ALL'
      ? { categoryId: selectedFoodCategory }
      : {}),

    ...(currentPriceRange?.min !== undefined
      ? { minPrice: currentPriceRange.min }
      : {}),

    ...(currentPriceRange?.max !== undefined
      ? { maxPrice: currentPriceRange.max }
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

  const activeFiltersCount =
    (category !== 'ALL' ? 1 : 0) +
    (selectedFoodCategory !== 'ALL' ? 1 : 0) +
    (priceRange !== 'ALL' ? 1 : 0) +
    (searchQuery ? 1 : 0);

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

  const changeFoodCategory = (next: string) => {
    setSelectedFoodCategory(next);
    setPage(1);
  };

  const changePriceRange = (next: PriceRange) => {
    setPriceRange(next);
    setPage(1);
  };

  const listSectionRef = useRef<any>(null);

  const scrollToOffers = () => {
    setTimeout(() => {
      if (typeof document !== 'undefined') {
        const el = document.getElementById('offers-list-section');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return;
        }
      }
    }, 60);
  };

  useEffect(() => {
    if (!searchInput.trim()) return;

    const timer = setTimeout(() => {
      if (searchInput.trim().length >= 2 && searchInput.trim() !== searchQuery) {
        setSearchQuery(searchInput.trim());
        setPage(1);
        scrollToOffers();
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const changeSort = (next: SortMode) => {
    setSortMode(next);
    setPage(1);
  };

  const submitSearch = () => {
    const trimmed = searchInput.trim();
    setSearchQuery(trimmed);
    setPage(1);
    if (trimmed) {
      scrollToOffers();
    }
  };

  const handleTagSearch = (tag: string) => {
    setSearchInput(tag);
    setSearchQuery(tag);
    setPage(1);
    scrollToOffers();
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setSearchQuery('');
    setPage(1);
  };

  const resetFilters = () => {
    setCategory('ALL');
    setSelectedFoodCategory('ALL');
    setPriceRange('ALL');
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
        {/* SEARCH BAR */}
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
              onKeyPress={(e: any) => {
                if (e.nativeEvent?.key === 'Enter') {
                  submitSearch();
                }
              }}
              returnKeyType="search"
              placeholder="Tìm tên món ăn, bánh, cơm, đồ uống..."
              placeholderTextColor={colors.textMuted}
              style={styles.searchInput}
              accessibilityLabel="Tìm kiếm ưu đãi"
            />

            {!!searchInput && (
              <Pressable
                onPress={handleClearSearch}
                style={styles.clearSearchButton}
                accessibilityLabel="Xóa nội dung tìm kiếm"
              >
                <Ionicons
                  name="close-circle"
                  size={19}
                  color={colors.textMuted}
                />
              </Pressable>
            )}
          </View>

          <AppButton
            title="Tìm kiếm"
            onPress={submitSearch}
          />
        </View>

        {/* POPULAR SEARCH TAGS */}
        <View style={styles.tagsContainer}>
          <Text style={styles.tagsLabel}>Gợi ý món:</Text>
          <View style={styles.tagsRow}>
            {POPULAR_SEARCH_TAGS.map((tag) => {
              const active = searchQuery === tag;
              return (
                <Pressable
                  key={tag}
                  style={[
                    styles.tagChip,
                    active && styles.tagChipActive,
                  ]}
                  onPress={() => handleTagSearch(tag)}
                >
                  <Text
                    style={[
                      styles.tagText,
                      active && styles.tagTextActive,
                    ]}
                  >
                    {tag}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* FILTER SECTION */}
        <View style={styles.filterSectionCard}>
          {/* CATEGORY FILTER */}
          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>
              Hình thức ưu đãi:
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

          {/* PRICE RANGE FILTER */}
          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>
              Khoảng giá:
            </Text>

            <View style={styles.priceTabs}>
              {PRICE_RANGES.map((item) => {
                const selected =
                  priceRange === item.value;

                return (
                  <Pressable
                    key={item.value}
                    onPress={() =>
                      changePriceRange(item.value)
                    }
                    style={[
                      styles.priceTab,
                      selected &&
                        styles.priceTabActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.priceTabText,
                        selected &&
                          styles.priceTabTextActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* FOOD CATEGORIES FILTER */}
          {categoriesList.length > 0 && (
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>
                Danh mục món:
              </Text>

              <View style={styles.categoryTabs}>
                <Pressable
                  onPress={() => changeFoodCategory('ALL')}
                  style={[
                    styles.foodTab,
                    selectedFoodCategory === 'ALL' &&
                      styles.foodTabActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.foodTabText,
                      selectedFoodCategory === 'ALL' &&
                        styles.foodTabTextActive,
                    ]}
                  >
                    Tất cả món
                  </Text>
                </Pressable>

                {categoriesList.map((cat) => {
                  const selected =
                    selectedFoodCategory === cat.id;

                  return (
                    <Pressable
                      key={cat.id}
                      onPress={() =>
                        changeFoodCategory(cat.id)
                      }
                      style={[
                        styles.foodTab,
                        selected &&
                          styles.foodTabActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.foodTabText,
                          selected &&
                            styles.foodTabTextActive,
                        ]}
                      >
                        {cat.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* ACTIVE FILTER BANNER */}
          {activeFiltersCount > 0 && (
            <View style={styles.activeFiltersBanner}>
              <View style={styles.activeFilterBadge}>
                <Ionicons
                  name="funnel"
                  size={14}
                  color={colors.primary}
                />
                <Text style={styles.activeFilterCountText}>
                  Đang lọc: {activeFiltersCount} điều kiện
                </Text>
              </View>

              <Pressable
                onPress={resetFilters}
                style={styles.resetButton}
              >
                <Ionicons
                  name="refresh-outline"
                  size={14}
                  color={colors.textSecondary}
                />
                <Text style={styles.resetButtonText}>
                  Xóa bộ lọc
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* RESULT TOOLBAR */}
        <View
          ref={listSectionRef}
          nativeID="offers-list-section"
          // @ts-ignore
          id="offers-list-section"
          style={[styles.toolbar, { scrollMarginTop: 24 } as any]}
        >
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
          <OfferFeedback kind="loading" description="Đang tải danh sách ưu đãi..." />
        ) : error ? (
          <OfferFeedback kind="error" title="Không thể tải ưu đãi" description={error} actionLabel="Thử lại" onAction={reload} />
        ) : !data?.items.length ? (
          <OfferFeedback kind="empty" title="Không tìm thấy ưu đãi phù hợp" description="Hiện chưa có ưu đãi đáp ứng bộ lọc. Bạn có thể chọn loại khác hoặc xóa bộ lọc." actionLabel="Xóa bộ lọc" onAction={resetFilters} />
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
  clearSearchButton: {
    padding: spacing.xs,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: -spacing.md,
  },
  tagsLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  tagChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tagChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tagTextActive: {
    color: colors.white,
    fontWeight: '700',
  },
  filterSectionCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.lg,
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
  priceTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  priceTab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
  },
  priceTabActive: {
    borderColor: colors.eco,
    backgroundColor: colors.eco,
  },
  priceTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  priceTabTextActive: {
    color: colors.white,
    fontWeight: '700',
  },
  foodTab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  foodTabActive: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceMuted,
  },
  foodTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  foodTabTextActive: {
    color: colors.primary,
    fontWeight: '800',
  },
  activeFiltersBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  activeFilterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  activeFilterCountText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.xs,
    backgroundColor: colors.surfaceMuted,
  },
  resetButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
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


