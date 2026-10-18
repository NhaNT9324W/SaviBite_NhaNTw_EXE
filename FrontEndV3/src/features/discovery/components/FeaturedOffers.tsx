
import { useRouter } from 'expo-router';
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    View,
    useWindowDimensions,
} from 'react-native';

import ScreenContainer from '../../../shared/components/layout/ScreenContainer';
import AppButton from '../../../shared/components/ui/AppButton';
import OfferFeedback from '../../../shared/components/ui/OfferFeedback';

import {
    colors,
    layout,
    spacing,
} from '../../../shared/theme';

import OfferCard from '../../offers/components/OfferCard';
import { useOffers } from '../../offers/hooks/useOffers';

export default function FeaturedOffers() {
  const router = useRouter();
  const { width } = useWindowDimensions();

  const { data, loading, error, reload } = useOffers({
    page: 1,
    limit: 6,
    sortBy: 'endingSoon',
    sortOrder: 'asc',
  });

  const desktop = width >= layout.breakpoint.desktop;
  const tablet = width >= layout.breakpoint.tablet;

  const columns = desktop ? 3 : tablet ? 2 : 1;

  const goToOffer = (id: string) => {
    router.push({
      pathname: '/offer/[id]',
      params: { id },
    });
  };

  const goToOffers = () => {
    router.push('/offers');
  };

  return (
    <ScreenContainer style={styles.section}>
      <View style={styles.header}>
        <View style={styles.heading}>
          <Text style={styles.title}>
            Ưu đãi đáng thử hôm nay
          </Text>

          <Text style={styles.subtitle}>
            Những ưu đãi đang mở bán từ các cửa hàng.
          </Text>
        </View>

        <AppButton
          title="Xem tất cả"
          variant="outline"
          onPress={goToOffers}
        />
      </View>

      {loading ? (
        <OfferFeedback kind="loading" description="Đang tải ưu đãi..." />
      ) : error ? (
        <OfferFeedback kind="error" title="Không thể tải danh sách ưu đãi" description={error} actionLabel="Thử lại" onAction={reload} />
      ) : !data?.items.length ? (
        <OfferFeedback kind="empty" title="Chưa có ưu đãi đang mở bán" description="Hiện chưa có ưu đãi phù hợp. Hãy quay lại sau để khám phá món ngon mới." actionLabel="Khám phá ưu đãi" onAction={goToOffers} />
      ) : (
        <View style={styles.grid}>
          {data.items.map((offer) => (
            <View
              key={offer.id}
              style={[
                styles.gridItem,
                columns === 3 && styles.gridItemDesktop,
                columns === 2 && styles.gridItemTablet,
              ]}
            >
              <OfferCard
                offer={offer}
                onPress={() => goToOffer(offer.id)}
              />
            </View>
          ))}
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingTop: spacing.section,
    paddingBottom: spacing.section,
    gap: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.lg,
  },
  heading: {
    flexShrink: 1,
    gap: spacing.sm,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.textSecondary,
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
    minHeight: 210,
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  feedbackText: {
    maxWidth: 480,
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.danger,
  },
});


