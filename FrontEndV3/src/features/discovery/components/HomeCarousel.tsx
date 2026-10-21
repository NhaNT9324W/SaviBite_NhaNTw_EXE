import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import ScreenContainer from '../../../shared/components/layout/ScreenContainer';
import { colors, layout, radius, spacing } from '../../../shared/theme';

interface CarouselSlide {
  id: string;
  badge: string;
  badgeIcon: keyof typeof Ionicons.glyphMap;
  eyebrow: string;
  title: string;
  highlightText: string;
  description: string;
  buttonText: string;
  image: any;
  tag: string;
  bgColor: string;
  accentColor: string;
  tagBg: string;
  route: string;
  params?: Record<string, string>;
}

const SLIDES: CarouselSlide[] = [
  {
    id: 'flash-sale',
    badge: 'GIỜ VÀNG FLASH SALE',
    badgeIcon: 'flash',
    eyebrow: 'ƯU ĐÃI NÓNG TRONG NGÀY',
    title: 'Món ngon tươi mới mỗi ngày',
    highlightText: 'Giảm sốc đến 60%',
    description:
      'Cơ hội thưởng thức bánh ngọt, món ăn trưa và điểm tâm thơm ngon từ các thương hiệu hàng đầu với mức giá cực kỳ ưu đãi.',
    buttonText: 'Săn Flash Sale',
    image: require('../../../../assets/food_images/croissant-ngot.png'),
    tag: '⚡ GIẢM ĐẾN 60%',
    bgColor: '#FFF7ED',
    accentColor: '#F47B20',
    tagBg: '#EA580C',
    route: '/offers',
    params: { type: 'FLASH_SALE' },
  },
  {
    id: 'savibite-box',
    badge: 'SAVIBITE BOX BẤT NGỜ',
    badgeIcon: 'gift',
    eyebrow: 'HỘP BÍ MẬT TIẾT KIỆM',
    title: 'Khám phá SaviBite Box',
    highlightText: 'Bất ngờ & tiết kiệm 70%',
    description:
      'Mỗi hộp quà là một trải nghiệm ẩm thực thú vị được tuyển chọn kỹ lưỡng từ nguồn thực phẩm tươi mới cuối ngày. Tiết kiệm tối đa chi phí.',
    buttonText: 'Đặt Hộp Bí Mật',
    image: require('../../../../assets/food_images/com-chay-thap-cam.png'),
    tag: '🎁 TIẾT KIỆM 70%',
    bgColor: '#F0FDF4',
    accentColor: '#16A34A',
    tagBg: '#15803D',
    route: '/offers',
    params: { type: 'SAVIBITE_BOX' },
  },
  {
    id: 'drinks',
    badge: 'THỨC UỐNG THANH MÁT',
    badgeIcon: 'cafe',
    eyebrow: 'ĐỒ UỐNG & CÀ PHÊ',
    title: 'Trà đào, Matcha & Cà phê',
    highlightText: 'Nạp năng lượng tức thì',
    description:
      'Thưởng thức các loại thức uống pha chế tươi ngon, mát lành từ chuỗi đối tác uy tín với mức giá hạt dẻ mỗi ngày.',
    buttonText: 'Xem Đồ Uống',
    image: require('../../../../assets/food_images/tra-dao-cam-sa.png'),
    tag: '🍹 TỪ 15.000đ',
    bgColor: '#EFF6FF',
    accentColor: '#07509A',
    tagBg: '#0284C7',
    route: '/offers',
    params: { category: 'beverage' },
  },
  {
    id: 'eco-action',
    badge: 'CÙNG SAVIBITE SỐNG XANH',
    badgeIcon: 'leaf',
    eyebrow: 'BẢO VỆ MÔI TRƯỜNG',
    title: 'Mỗi món ăn được cứu',
    highlightText: 'Là một hành động vì hành tinh',
    description:
      'Hơn 10.000+ bữa ăn đã được cứu tại SaviBite, cùng người tiêu dùng chung tay giảm rác thải thực phẩm và bảo vệ môi trường.',
    buttonText: 'Chung Tay Cứu Món',
    image: require('../../../../assets/food_images/banh-kem-dau.png'),
    tag: '🌱 GIẢM 2.5KG CO2',
    bgColor: '#F0FDFA',
    accentColor: '#0D9488',
    tagBg: '#0F766E',
    route: '/offers',
    params: {},
  },
];

const AUTO_PLAY_INTERVAL = 4500;

export default function HomeCarousel() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const desktop = width >= layout.breakpoint.desktop;
  const tablet = width >= layout.breakpoint.tablet;

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const touchStartX = useRef<number | null>(null);

  const currentSlide = SLIDES[currentIndex];

  const changeSlide = (newIndex: number) => {
    Animated.timing(fadeAnim, {
      toValue: 0.25,
      duration: 140,
      useNativeDriver: Platform.OS !== 'web',
    }).start(() => {
      setCurrentIndex(newIndex);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    });
  };

  const handleNext = () => {
    const nextIndex = (currentIndex + 1) % SLIDES.length;
    changeSlide(nextIndex);
  };

  const handlePrev = () => {
    const prevIndex = (currentIndex - 1 + SLIDES.length) % SLIDES.length;
    changeSlide(prevIndex);
  };

  const handleDotClick = (index: number) => {
    if (index === currentIndex) return;
    changeSlide(index);
  };

  const handleAction = () => {
    router.push({
      pathname: currentSlide.route as any,
      params: currentSlide.params,
    });
  };

  // Auto-play timer
  useEffect(() => {
    if (isPaused) return;

    const timer = setInterval(() => {
      handleNext();
    }, AUTO_PLAY_INTERVAL);

    return () => clearInterval(timer);
  }, [currentIndex, isPaused]);

  // Touch swipe handling for mobile
  const handleTouchStart = (e: any) => {
    touchStartX.current = e.nativeEvent.pageX;
  };

  const handleTouchEnd = (e: any) => {
    if (touchStartX.current === null) return;
    const diff = e.nativeEvent.pageX - touchStartX.current;
    if (Math.abs(diff) > 45) {
      if (diff > 0) {
        handlePrev();
      } else {
        handleNext();
      }
    }
    touchStartX.current = null;
  };

  return (
    <View style={styles.wrapper}>
      <ScreenContainer>
        <View
          style={[
            styles.carouselCard,
            { backgroundColor: currentSlide.bgColor },
            desktop && styles.carouselCardDesktop,
          ]}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          // @ts-ignore Web hover props
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {/* Animated Slide Content */}
          <Animated.View
            style={[
              styles.slideContent,
              desktop && styles.slideContentDesktop,
              { opacity: fadeAnim },
            ]}
          >
            {/* Left Content Column */}
            <View
              style={[
                styles.infoColumn,
                desktop && styles.infoColumnDesktop,
              ]}
            >
              {/* Badge */}
              <View style={styles.badgeRow}>
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: `${currentSlide.accentColor}18` },
                  ]}
                >
                  <Ionicons
                    name={currentSlide.badgeIcon}
                    size={14}
                    color={currentSlide.accentColor}
                  />
                  <Text
                    style={[
                      styles.badgeText,
                      { color: currentSlide.accentColor },
                    ]}
                  >
                    {currentSlide.badge}
                  </Text>
                </View>

                <Text style={styles.eyebrowText}>
                  {currentSlide.eyebrow}
                </Text>
              </View>

              {/* Title & Highlight */}
              <View style={styles.titleContainer}>
                <Text
                  style={[
                    styles.slideTitle,
                    desktop && styles.slideTitleDesktop,
                  ]}
                >
                  {currentSlide.title}
                </Text>
                <Text
                  style={[
                    styles.slideHighlight,
                    desktop && styles.slideHighlightDesktop,
                    { color: currentSlide.accentColor },
                  ]}
                >
                  {currentSlide.highlightText}
                </Text>
              </View>

              {/* Description */}
              <Text style={styles.slideDescription}>
                {currentSlide.description}
              </Text>

              {/* CTA Button */}
              <View style={styles.actionRow}>
                <Pressable
                  style={({ pressed }) => [
                    styles.ctaButton,
                    {
                      backgroundColor: currentSlide.accentColor,
                      opacity: pressed ? 0.9 : 1,
                      transform: [{ scale: pressed ? 0.98 : 1 }],
                    },
                  ]}
                  onPress={handleAction}
                  accessibilityRole="button"
                >
                  <Text style={styles.ctaButtonText}>
                    {currentSlide.buttonText}
                  </Text>
                  <Ionicons
                    name="arrow-forward"
                    size={18}
                    color="#FFFFFF"
                  />
                </Pressable>

                <View style={styles.trustBadge}>
                  <Ionicons
                    name="shield-checkmark"
                    size={16}
                    color={colors.eco}
                  />
                  <Text style={styles.trustText}>
                    Cam kết chất lượng
                  </Text>
                </View>
              </View>
            </View>

            {/* Right Media Column */}
            <View
              style={[
                styles.mediaColumn,
                desktop && styles.mediaColumnDesktop,
              ]}
            >
              <Pressable
                onPress={handleAction}
                style={styles.imageWrapper}
              >
                <Image
                  source={currentSlide.image}
                  style={styles.slideImage}
                  resizeMode="cover"
                />

                {/* Floating Tag */}
                <View
                  style={[
                    styles.floatingTag,
                    { backgroundColor: currentSlide.tagBg },
                  ]}
                >
                  <Text style={styles.floatingTagText}>
                    {currentSlide.tag}
                  </Text>
                </View>
              </Pressable>
            </View>
          </Animated.View>

          {/* Navigation Arrows */}
          <Pressable
            style={[styles.arrowButton, styles.prevButton]}
            onPress={handlePrev}
            accessibilityLabel="Slide trước"
            accessibilityRole="button"
          >
            <Ionicons
              name="chevron-back"
              size={20}
              color={colors.text}
            />
          </Pressable>

          <Pressable
            style={[styles.arrowButton, styles.nextButton]}
            onPress={handleNext}
            accessibilityLabel="Slide tiếp theo"
            accessibilityRole="button"
          >
            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.text}
            />
          </Pressable>

          {/* Indicator Dots */}
          <View style={styles.indicatorsRow}>
            {SLIDES.map((slide, index) => {
              const isActive = index === currentIndex;
              return (
                <Pressable
                  key={slide.id}
                  style={[
                    styles.dot,
                    isActive && [
                      styles.dotActive,
                      { backgroundColor: currentSlide.accentColor },
                    ],
                  ]}
                  onPress={() => handleDotClick(index)}
                  accessibilityLabel={`Chuyển tới slide ${index + 1}`}
                />
              );
            })}
          </View>
        </View>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    backgroundColor: colors.background,
  },
  carouselCard: {
    position: 'relative',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    padding: spacing.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  carouselCardDesktop: {
    padding: spacing.xxl,
    minHeight: 330,
  },
  slideContent: {
    flexDirection: 'column',
    gap: spacing.lg,
  },
  slideContentDesktop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxxl,
  },
  infoColumn: {
    flex: 1,
    gap: spacing.md,
    zIndex: 2,
  },
  infoColumnDesktop: {
    paddingLeft: 36,
    paddingRight: spacing.lg,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  eyebrowText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  titleContainer: {
    gap: 4,
  },
  slideTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    lineHeight: 28,
  },
  slideTitleDesktop: {
    fontSize: 32,
    lineHeight: 38,
  },
  slideHighlight: {
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 28,
  },
  slideHighlightDesktop: {
    fontSize: 32,
    lineHeight: 38,
  },
  slideDescription: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
    maxWidth: 500,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: spacing.xs,
    flexWrap: 'wrap',
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: radius.pill,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 3,
  },
  ctaButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  trustText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  mediaColumn: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaColumnDesktop: {
    width: 380,
  },
  imageWrapper: {
    width: '100%',
    height: 220,
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 4,
  },
  slideImage: {
    width: '100%',
    height: '100%',
  },
  floatingTag: {
    position: 'absolute',
    top: 14,
    right: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  floatingTagText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  arrowButton: {
    position: 'absolute',
    top: '50%',
    marginTop: -20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  prevButton: {
    left: 12,
  },
  nextButton: {
    right: 12,
  },
  indicatorsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing.lg,
    zIndex: 5,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
  },
  dotActive: {
    width: 26,
    borderRadius: 4,
  },
});
