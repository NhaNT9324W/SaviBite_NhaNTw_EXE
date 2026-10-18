
import { Ionicons } from '@expo/vector-icons';
import {
    Pressable,
    StyleSheet,
    Text,
    View,
    type StyleProp,
    type ViewStyle,
} from 'react-native';

import { AppBadge } from '../../../shared/components/ui';
import {
    colors,
    radius,
    spacing,
} from '../../../shared/theme';

import type { OfferListItem } from '../types/offer.types';

type OfferCardProps = {
  offer: OfferListItem;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

const money = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

export default function OfferCard({
  offer,
  onPress,
  style,
}: OfferCardProps) {
  const isFlashSale = offer.offerType === 'FLASH_SALE';

  const discount =
    offer.originalValue > 0
      ? Math.max(
          0,
          Math.round(
            (1 - offer.salePrice / offer.originalValue) * 100
          )
        )
      : 0;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [
        styles.card,
        style,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.imagePlaceholder}>
        <Ionicons
          name={
            isFlashSale
              ? 'restaurant-outline'
              : 'gift-outline'
          }
          size={32}
          color={colors.textMuted}
        />

        <Text style={styles.imageText}>
          {isFlashSale ? 'Flash Sale' : 'SaviBite Box'}
        </Text>
      </View>

      <View style={styles.content}>
        <View style={styles.badgeRow}>
          <AppBadge
            label={
              isFlashSale
                ? 'FLASH SALE'
                : 'SAVIBITE BOX'
            }
            variant={isFlashSale ? 'promotion' : 'success'}
          />

          {discount > 0 && (
            <Text style={styles.discount}>
              -{discount}%
            </Text>
          )}
        </View>

        <Text style={styles.title} numberOfLines={2}>
          {offer.title}
        </Text>

        <View style={styles.shopRow}>
          <Ionicons
            name="storefront-outline"
            size={15}
            color={colors.textSecondary}
          />
          <Text style={styles.shopName} numberOfLines={1}>
            {offer.shopName}
          </Text>
        </View>

        <View style={styles.priceRow}>
          <Text style={styles.salePrice}>
            {money.format(offer.salePrice)}
          </Text>

          {offer.originalValue > offer.salePrice && (
            <Text style={styles.originalPrice}>
              {money.format(offer.originalValue)}
            </Text>
          )}
        </View>

        <View style={styles.bottom}>
          <View style={styles.stockRow}>
            <Ionicons
              name="cube-outline"
              size={14}
              color={colors.textMuted}
            />
            <Text style={styles.stockText}>
              Còn {offer.availableQuantity} suất
            </Text>
          </View>

          {onPress && (
            <Ionicons
              name="arrow-forward"
              size={18}
              color={colors.primary}
            />
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.88,
  },
  imagePlaceholder: {
    height: 155,
    backgroundColor: colors.surfaceMuted,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  imageText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  content: {
    padding: spacing.base,
    gap: spacing.md,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  discount: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.promotion,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 23,
    color: colors.text,
    minHeight: 46,
  },
  shopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  shopName: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  salePrice: {
    fontSize: 19,
    fontWeight: '800',
    color: colors.primary,
  },
  originalPrice: {
    fontSize: 13,
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  bottom: {
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  stockText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});
