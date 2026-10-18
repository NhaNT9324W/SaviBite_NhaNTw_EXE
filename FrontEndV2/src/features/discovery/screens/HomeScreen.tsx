
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { APP_CONFIG } from '../../../config/app.config';
import { MEDIA } from '../../../config/media';

import CustomerLayout from '../../../shared/components/layout/CustomerLayout';
import ScreenContainer from '../../../shared/components/layout/ScreenContainer';
import { AppBadge, AppButton } from '../../../shared/components/ui';

import {
  colors,
  layout,
  radius,
  spacing,
  typography,
} from '../../../shared/theme';

import FeaturedOffers from '../components/FeaturedOffers';

const HOW_IT_WORKS = [
  {
    number: '01',
    title: 'Tìm món ngon',
    description: 'Khám phá ưu đãi từ các cửa hàng.',
  },
  {
    number: '02',
    title: 'Đặt trước',
    description: 'Chọn số lượng và giờ nhận hàng.',
  },
  {
    number: '03',
    title: 'Đến nhận',
    description: 'Xuất trình mã nhận hàng tại cửa hàng.',
  },
] as const;

export default function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const desktop =
    mounted && width >= layout.breakpoint.desktop;

  const tablet =
    mounted && width >= layout.breakpoint.tablet;

  const goOffers = () => {
    router.push('/offers');
  };

  const goFlashSales = () => {
    router.push({
      pathname: '/offers',
      params: { type: 'FLASH_SALE' },
    });
  };

  const goSaviBiteBoxes = () => {
    router.push({
      pathname: '/offers',
      params: { type: 'SAVIBITE_BOX' },
    });
  };

  return (
    <CustomerLayout>
      {/* ================= HERO ================= */}
      <View style={styles.heroBackground}>
        <ScreenContainer>
          <View
            style={[
              styles.hero,
              desktop && styles.heroDesktop,
            ]}
          >
            <View
              style={[
                styles.heroContent,
                desktop && styles.heroContentDesktop,
              ]}
            >
              <Text style={styles.eyebrow}>
                {APP_CONFIG.home.eyebrow}
              </Text>

              <Text
                style={[
                  styles.heroHeading,
                  desktop && styles.heroHeadingDesktop,
                ]}
              >
                {APP_CONFIG.home.heading}
              </Text>

              <Text style={styles.heroDescription}>
                {APP_CONFIG.home.description}
              </Text>

              <View style={styles.heroActions}>
                <AppButton
                  title={APP_CONFIG.home.exploreButton}
                  size="lg"
                  onPress={goOffers}
                />
              </View>

              <View style={styles.heroNote}>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={18}
                  color={colors.eco}
                />

                <Text style={styles.heroNoteText}>
                  Đặt trước trực tuyến. Nhận tại cửa hàng.
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.heroMedia,
                desktop && styles.heroMediaDesktop,
              ]}
            >
              <Image
                source={{ uri: MEDIA.home.hero }}
                style={styles.heroImage}
                resizeMode="cover"
                accessibilityLabel="Hình ảnh minh họa món ăn"
              />

              <View style={styles.imageLabel}>
                <Text style={styles.imageLabelText}>
                  EAT GOOD. WASTE LESS.
                </Text>
              </View>
            </View>
          </View>
        </ScreenContainer>
      </View>

      {/* ================= CATEGORIES ================= */}
      <ScreenContainer style={styles.section}>
        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>
            Hôm nay bạn muốn khám phá gì?
          </Text>

          <Text style={styles.sectionSubtitle}>
            Hai cách tiết kiệm thực phẩm cùng SaviBite.
          </Text>
        </View>

        <View
          style={[
            styles.categoryRow,
            tablet && styles.categoryRowTablet,
          ]}
        >
          {/* FLASH SALE */}
          <Pressable
            onPress={goFlashSales}
            accessibilityRole="button"
            style={[
              styles.category,
              tablet && styles.categoryTablet,
            ]}
          >
            <View style={styles.categoryTop}>
              <View style={styles.categoryIcon}>
                <Ionicons
                  name="flash-outline"
                  size={22}
                  color={colors.promotion}
                />
              </View>

              <AppBadge
                label="FLASH SALE"
                variant="promotion"
              />
            </View>

            <Text style={styles.categoryTitle}>
              Chọn món bạn thích
            </Text>

            <Text style={styles.categoryDescription}>
              Biết trước món ăn, giá giảm và khung giờ nhận.
            </Text>

            <View style={styles.categoryLink}>
              <Text style={styles.categoryLinkText}>
                Xem Flash Sale
              </Text>

              <Ionicons
                name="arrow-forward"
                size={17}
                color={colors.primary}
              />
            </View>
          </Pressable>

          {/* SAVIBITE BOX */}
          <Pressable
            onPress={goSaviBiteBoxes}
            accessibilityRole="button"
            style={[
              styles.category,
              tablet && styles.categoryTablet,
            ]}
          >
            <View style={styles.categoryTop}>
              <View style={styles.categoryIcon}>
                <Ionicons
                  name="gift-outline"
                  size={22}
                  color={colors.eco}
                />
              </View>

              <AppBadge
                label="SAVIBITE BOX"
                variant="success"
              />
            </View>

            <Text style={styles.categoryTitle}>
              Một hộp đầy bất ngờ
            </Text>

            <Text style={styles.categoryDescription}>
              Khám phá hộp thực phẩm cuối ngày với giá tiết kiệm.
            </Text>

            <View style={styles.categoryLink}>
              <Text style={styles.categoryLinkText}>
                Xem SaviBite Box
              </Text>

              <Ionicons
                name="arrow-forward"
                size={17}
                color={colors.primary}
              />
            </View>
          </Pressable>
        </View>
      </ScreenContainer>

      {/* ================= FEATURED OFFERS ================= */}
      {/*
        FeaturedOffers tự quản lý:
        - GET /api/offers
        - Loading
        - Error
        - Empty state
        - Danh sách OfferCard

        Không sử dụng dữ liệu sản phẩm giả.
      */}
      <FeaturedOffers />

      {/* ================= HOW IT WORKS ================= */}
      <View style={styles.howBackground}>
        <ScreenContainer style={styles.section}>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>
              Đặt món đơn giản, nhận hàng dễ dàng
            </Text>

            <Text style={styles.sectionSubtitle}>
              Chỉ cần chọn món, đặt trước và đến cửa hàng.
            </Text>
          </View>

          <View
            style={[
              styles.steps,
              tablet && styles.stepsTablet,
            ]}
          >
            {HOW_IT_WORKS.map((step) => (
              <View
                key={step.number}
                style={[
                  styles.step,
                  tablet && styles.stepTablet,
                ]}
              >
                <Text style={styles.stepNumber}>
                  {step.number}
                </Text>

                <Text style={styles.stepTitle}>
                  {step.title}
                </Text>

                <Text style={styles.stepDescription}>
                  {step.description}
                </Text>
              </View>
            ))}
          </View>
        </ScreenContainer>
      </View>
    </CustomerLayout>
  );
}

const styles = StyleSheet.create({
  // HERO
  heroBackground: {
    backgroundColor: colors.surface,
  },
  hero: {
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxxl,
    gap: spacing.xxl,
  },
  heroDesktop: {
    minHeight: 480,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxxl,
  },
  heroContent: {
    gap: spacing.lg,
  },
  heroContentDesktop: {
    flex: 1,
    paddingRight: spacing.xl,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: colors.eco,
  },
  heroHeading: {
    fontSize: typography.fontSize.heading,
    fontWeight: '800',
    lineHeight: 40,
    letterSpacing: -1,
    color: colors.text,
  },
  heroHeadingDesktop: {
    fontSize: typography.fontSize.hero,
    lineHeight: typography.lineHeight.hero,
  },
  heroDescription: {
    maxWidth: 520,
    color: colors.textSecondary,
    fontSize: 16,
    lineHeight: 26,
  },
  heroActions: {
    flexDirection: 'row',
    marginTop: spacing.sm,
  },
  heroNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  heroNoteText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  heroMedia: {
    width: '100%',
    height: 260,
    overflow: 'hidden',
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
  },
  heroMediaDesktop: {
    flex: 1,
    height: 380,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  imageLabel: {
    position: 'absolute',
    bottom: spacing.base,
    left: spacing.base,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.xs,
  },
  imageLabelText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    color: colors.text,
  },

  // COMMON SECTIONS
  section: {
    paddingTop: spacing.section,
    paddingBottom: spacing.section,
    gap: spacing.xxl,
  },
  sectionHeading: {
    gap: spacing.sm,
    flexShrink: 1,
  },
  sectionTitle: {
    fontSize: typography.fontSize.xxl,
    lineHeight: 32,
    fontWeight: '800',
    color: colors.text,
  },
  sectionSubtitle: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.textSecondary,
  },

  // CATEGORIES
  categoryRow: {
    gap: spacing.lg,
  },
  categoryRowTablet: {
    flexDirection: 'row',
  },
  category: {
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    gap: spacing.md,
  },
  categoryTablet: {
    flex: 1,
  },
  categoryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  categoryIcon: {
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: radius.sm,
  },
  categoryTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  categoryDescription: {
    fontSize: 14,
    lineHeight: 23,
    color: colors.textSecondary,
    maxWidth: 350,
  },
  categoryLink: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  categoryLinkText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },

  // HOW IT WORKS
  howBackground: {
    backgroundColor: colors.surface,
  },
  steps: {
    gap: spacing.xl,
  },
  stepsTablet: {
    flexDirection: 'row',
  },
  step: {
    gap: spacing.md,
  },
  stepTablet: {
    flex: 1,
  },
  stepNumber: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.eco,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  stepDescription: {
    fontSize: 14,
    lineHeight: 23,
    color: colors.textSecondary,
  },
});
