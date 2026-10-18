import { formatVnd as money } from '../../../shared/utils/formatters';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
    useWindowDimensions,
} from 'react-native';

import CustomerLayout from '../../../shared/components/layout/CustomerLayout';
import ScreenContainer from '../../../shared/components/layout/ScreenContainer';
import { AppBadge, AppButton } from '../../../shared/components/ui';
import { colors, layout, radius, spacing } from '../../../shared/theme';

import { useCart } from '../../cart/context/CartProvider';
import type { CartAddInput } from '../../cart/types/cart.types';
import { useOfferDetail } from '../hooks/useOfferDetail';



function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Chưa xác định';
  }

  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Ionicons
        name={icon}
        size={19}
        color={colors.textSecondary}
      />

      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

export default function OfferDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const { width } = useWindowDimensions();

  const id =
    typeof params.id === 'string'
      ? params.id
      : undefined;

  const desktop = width >= layout.breakpoint.desktop;

  const {
    data: offer,
    loading,
    error,
    reload,
  } = useOfferDetail(id);

  const {
    addItem,
    replaceCart,
    shopName,
    itemCount,
  } = useCart();

  const [quantity, setQuantity] = useState(1);
  const [conflictVisible, setConflictVisible] =
    useState(false);
  const [feedback, setFeedback] = useState('');
  const [pendingItem, setPendingItem] =
    useState<CartAddInput | null>(null);

  useEffect(() => {
    setQuantity(1);
    setFeedback('');
    setConflictVisible(false);
    setPendingItem(null);
  }, [id]);

  const available =
    !!offer &&
    offer.isAvailable &&
    offer.availableQuantity > 0 &&
    new Date(offer.saleEndAt).getTime() > Date.now();

  const toCartInput = (): CartAddInput | null => {
    if (!offer) {
      return null;
    }

    return {
      offerId: offer.id,
      offerType: offer.offerType,
      title: offer.title,
      shopId: offer.shop.id,
      shopName: offer.shop.name,
      shopAddress: offer.shop.address,
      unitPrice: offer.salePrice,
      originalValue: offer.originalValue,
      availableQuantity: offer.availableQuantity,
      saleEndAt: offer.saleEndAt,
      pickupStartAt: offer.pickupStartAt,
      pickupEndAt: offer.pickupEndAt,
      imageUrl:
        offer.imageUrl ||
        offer.product?.imageUrl ||
        null,
    };
  };

  const handleAdd = () => {
    if (!available) {
      setFeedback('Ưu đãi này không còn khả dụng.');
      return;
    }

    const item = toCartInput();

    if (!item) {
      return;
    }

    const result = addItem(item, quantity);

    if (result === 'SHOP_CONFLICT') {
      setPendingItem(item);
      setConflictVisible(true);
      return;
    }

    if (result === 'UNAVAILABLE') {
      setFeedback(
        'Ưu đãi đã hết thời gian bán hoặc hết hàng.'
      );
      return;
    }

    setFeedback('Đã thêm sản phẩm vào giỏ hàng.');
  };

  const confirmReplace = () => {
    if (!pendingItem) {
      return;
    }

    const result = replaceCart(
      pendingItem,
      quantity
    );

    setConflictVisible(false);
    setPendingItem(null);

    setFeedback(
      result === 'ADDED'
        ? 'Đã thay giỏ cũ bằng sản phẩm của cửa hàng mới.'
        : 'Ưu đãi này không còn khả dụng.'
    );
  };

  if (loading || error || !offer) {
    return (
      <CustomerLayout>
        <ScreenContainer style={styles.feedbackPage}>
          {loading ? (
            <>
              <ActivityIndicator
                size="large"
                color={colors.primary}
              />
              <Text style={styles.secondary}>
                Đang tải chi tiết ưu đãi...
              </Text>
            </>
          ) : (
            <>
              <Ionicons
                name="alert-circle-outline"
                size={36}
                color={colors.danger}
              />

              <Text style={styles.sectionTitle}>
                Không thể tải ưu đãi
              </Text>

              <Text style={styles.secondary}>
                {error ?? 'Không tìm thấy dữ liệu.'}
              </Text>

              <AppButton
                title="Thử lại"
                variant="outline"
                onPress={reload}
              />

              <AppButton
                title="Quay lại Khám phá"
                variant="ghost"
                onPress={() => router.push('/offers')}
              />
            </>
          )}
        </ScreenContainer>
      </CustomerLayout>
    );
  }

  const isFlash =
    offer.offerType === 'FLASH_SALE';

  const imageUrl =
    offer.imageUrl || offer.product?.imageUrl;

  const discount =
    offer.originalValue > 0
      ? Math.max(
          0,
          Math.round(
            (1 -
              offer.salePrice /
                offer.originalValue) *
              100
          )
        )
      : 0;

  return (
    <CustomerLayout>
      <ScreenContainer style={styles.page}>
        <View style={styles.topLinks}>
          <Pressable
            onPress={() => router.push('/offers')}
            style={styles.link}
          >
            <Ionicons
              name="arrow-back"
              size={17}
              color={colors.primary}
            />

            <Text style={styles.linkText}>
              Quay lại Khám phá
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.push('/cart')}
            style={styles.link}
          >
            <Ionicons
              name="bag-outline"
              size={19}
              color={colors.primary}
            />

            <Text style={styles.linkText}>
              Giỏ hàng ({itemCount})
            </Text>
          </Pressable>
        </View>

        <View
          style={[
            styles.columns,
            desktop && styles.columnsDesktop,
          ]}
        >
          <View style={styles.mainColumn}>
            <View style={styles.imageContainer}>
              {imageUrl ? (
                <Image
                  source={{ uri: imageUrl }}
                  style={styles.image}
                  resizeMode="cover"
                  accessibilityLabel={offer.title}
                />
              ) : (
                <View style={styles.placeholder}>
                  <Ionicons
                    name={
                      isFlash
                        ? 'restaurant-outline'
                        : 'gift-outline'
                    }
                    size={54}
                    color={colors.textMuted}
                  />

                  <Text style={styles.secondary}>
                    {isFlash
                      ? 'Hình ảnh món ăn'
                      : 'SaviBite Box'}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.panel}>
              <Text style={styles.sectionTitle}>
                Mô tả ưu đãi
              </Text>

              <Text style={styles.paragraph}>
                {offer.description ||
                  'Chưa có mô tả.'}
              </Text>

              {!isFlash && (
                <Text style={styles.secondary}>
                  SaviBite Box là hộp thực phẩm
                  bất ngờ. Thành phần thực tế
                  có thể thay đổi theo thực phẩm
                  còn lại tại cửa hàng.
                </Text>
              )}
            </View>

            {offer.product && (
              <View style={styles.panel}>
                <Text style={styles.sectionTitle}>
                  Thông tin sản phẩm
                </Text>

                <InfoRow
                  icon="restaurant-outline"
                  label="Tên sản phẩm"
                  value={offer.product.name}
                />

                {!!offer.product.description && (
                  <InfoRow
                    icon="information-circle-outline"
                    label="Mô tả"
                    value={offer.product.description}
                  />
                )}

                {!!offer.product.ingredients && (
                  <InfoRow
                    icon="list-outline"
                    label="Thành phần"
                    value={offer.product.ingredients}
                  />
                )}

                {!!offer.product.categoryName && (
                  <InfoRow
                    icon="pricetag-outline"
                    label="Danh mục"
                    value={offer.product.categoryName}
                  />
                )}
              </View>
            )}

            <View style={styles.panel}>
              <Text style={styles.sectionTitle}>
                Dị ứng và bảo quản
              </Text>

              <InfoRow
                icon="alert-circle-outline"
                label="Thông tin dị ứng"
                value={
                  offer.allergyInfo ||
                  'Chưa có thông tin'
                }
              />

              <InfoRow
                icon="information-circle-outline"
                label="Hướng dẫn bảo quản"
                value={
                  offer.storageInstruction ||
                  'Chưa có thông tin'
                }
              />
            </View>

            <View style={styles.panel}>
              <Text style={styles.sectionTitle}>
                Thông tin cửa hàng
              </Text>

              <Text style={styles.shopName}>
                {offer.shop.name}
              </Text>

              {!!offer.shop.description && (
                <Text style={styles.paragraph}>
                  {offer.shop.description}
                </Text>
              )}

              <InfoRow
                icon="location-outline"
                label="Địa chỉ nhận hàng"
                value={offer.shop.address}
              />

              {!!offer.shop.phone && (
                <InfoRow
                  icon="call-outline"
                  label="Số điện thoại"
                  value={offer.shop.phone}
                />
              )}

              <InfoRow
                icon="star-outline"
                label="Đánh giá"
                value={
                  offer.shop.averageRating > 0
                    ? `${offer.shop.averageRating.toFixed(1)}/5`
                    : 'Chưa có đánh giá'
                }
              />
            </View>
          </View>

          <View
            style={[
              styles.purchaseColumn,
              desktop &&
                styles.purchaseColumnDesktop,
            ]}
          >
            <View style={styles.panel}>
              <View style={styles.badgeRow}>
                <AppBadge
                  label={
                    isFlash
                      ? 'FLASH SALE'
                      : 'SAVIBITE BOX'
                  }
                  variant={
                    isFlash
                      ? 'promotion'
                      : 'success'
                  }
                />

                {discount > 0 && (
                  <AppBadge
                    label={`Giảm ${discount}%`}
                    variant="promotion"
                  />
                )}
              </View>

              <Text style={styles.offerTitle}>
                {offer.title}
              </Text>

              <View style={styles.priceRow}>
                <Text style={styles.salePrice}>
                  {money(offer.salePrice)}
                </Text>

                {offer.originalValue >
                  offer.salePrice && (
                  <Text style={styles.oldPrice}>
                    {money(offer.originalValue)}
                  </Text>
                )}
              </View>

              <View style={styles.separator} />

              <InfoRow
                icon="cube-outline"
                label="Số lượng còn lại"
                value={`${offer.availableQuantity} ${
                  isFlash ? 'suất' : 'hộp'
                }`}
              />

              <InfoRow
                icon="time-outline"
                label="Kết thúc bán"
                value={formatDate(offer.saleEndAt)}
              />

              <InfoRow
                icon="calendar-outline"
                label="Bắt đầu nhận"
                value={formatDate(
                  offer.pickupStartAt
                )}
              />

              <InfoRow
                icon="checkmark-circle-outline"
                label="Kết thúc nhận"
                value={formatDate(
                  offer.pickupEndAt
                )}
              />

              <View
                style={[
                  styles.availability,
                  !available &&
                    styles.unavailable,
                ]}
              >
                <Text
                  style={[
                    styles.availabilityText,
                    !available &&
                      styles.unavailableText,
                  ]}
                >
                  {available
                    ? offer.availabilityMessage ||
                      'Ưu đãi đang mở bán.'
                    : 'Ưu đãi không còn khả dụng để đặt hàng.'}
                </Text>
              </View>

              {available && (
                <>
                  <View style={styles.quantityRow}>
                    <Text
                      style={styles.quantityLabel}
                    >
                      Số lượng
                    </Text>

                    <View
                      style={styles.quantityControl}
                    >
                      <Pressable
                        onPress={() =>
                          setQuantity((current) =>
                            Math.max(
                              1,
                              current - 1
                            )
                          )
                        }
                        disabled={quantity <= 1}
                        style={
                          styles.quantityButton
                        }
                      >
                        <Ionicons
                          name="remove"
                          size={18}
                          color={colors.text}
                        />
                      </Pressable>

                      <Text
                        style={styles.quantityNumber}
                      >
                        {quantity}
                      </Text>

                      <Pressable
                        onPress={() =>
                          setQuantity((current) =>
                            Math.min(
                              offer.availableQuantity,
                              current + 1
                            )
                          )
                        }
                        disabled={
                          quantity >=
                          offer.availableQuantity
                        }
                        style={
                          styles.quantityButton
                        }
                      >
                        <Ionicons
                          name="add"
                          size={18}
                          color={colors.text}
                        />
                      </Pressable>
                    </View>
                  </View>

                  <View style={styles.totalRow}>
                    <Text style={styles.secondary}>
                      Tạm tính
                    </Text>

                    <Text style={styles.total}>
                      {money(
                        offer.salePrice *
                          quantity
                      )}
                    </Text>
                  </View>
                </>
              )}

              <AppButton
                title={
                  available
                    ? 'Thêm vào giỏ hàng'
                    : 'Không thể đặt hàng'
                }
                disabled={!available}
                fullWidth
                onPress={handleAdd}
              />

              {!!feedback && (
                <View style={styles.message}>
                  <Text
                    style={styles.messageText}
                  >
                    {feedback}
                  </Text>
                </View>
              )}

              {feedback.includes('Đã thêm') && (
                <AppButton
                  title="Xem giỏ hàng"
                  variant="outline"
                  fullWidth
                  onPress={() =>
                    router.push('/cart')
                  }
                />
              )}

              <Text style={styles.purchaseNote}>
                Đặt trước trực tuyến và đến nhận
                tại cửa hàng. SaviBite không
                hỗ trợ giao hàng.
              </Text>
            </View>
          </View>
        </View>
      </ScreenContainer>

      <Modal
        visible={conflictVisible}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setConflictVisible(false)
        }
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Giỏ hàng thuộc cửa hàng khác
            </Text>

            <Text style={styles.paragraph}>
              Giỏ hiện tại đang có sản phẩm từ{' '}
              <Text style={styles.emphasis}>
                {shopName || 'cửa hàng khác'}
              </Text>
              . SaviBite chỉ cho phép đặt món
              từ một cửa hàng trong mỗi đơn.
            </Text>

            <Text style={styles.paragraph}>
              Bạn có muốn xóa giỏ cũ và thêm
              sản phẩm từ{' '}
              <Text style={styles.emphasis}>
                {offer.shop.name}
              </Text>{' '}
              không?
            </Text>

            <View style={styles.modalActions}>
              <AppButton
                title="Giữ giỏ cũ"
                variant="outline"
                onPress={() => {
                  setConflictVisible(false);
                  setPendingItem(null);
                }}
              />

              <AppButton
                title="Thay giỏ hàng"
                onPress={confirmReplace}
              />
            </View>
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
  topLinks: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.lg,
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  linkText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  columns: {
    gap: spacing.xxl,
  },
  columnsDesktop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  mainColumn: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xl,
  },
  purchaseColumn: {
    width: '100%',
  },
  purchaseColumnDesktop: {
    width: 360,
  },
  imageContainer: {
    height: 330,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  panel: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.lg,
    shadowColor: colors.text,
    shadowOpacity: 0.04,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 1,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '800',
  },
  paragraph: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 24,
  },
  secondary: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  infoContent: {
    flex: 1,
    gap: spacing.xs,
  },
  infoLabel: {
    color: colors.textMuted,
    fontSize: 12,
  },
  infoValue: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 22,
  },
  shopName: {
    color: colors.primary,
    fontSize: 17,
    fontWeight: '700',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  offerTitle: {
    color: colors.text,
    fontSize: 23,
    fontWeight: '800',
    lineHeight: 31,
    letterSpacing: -0.6,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  salePrice: {
    color: colors.primary,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  oldPrice: {
    color: colors.textMuted,
    fontSize: 15,
    textDecorationLine: 'line-through',
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
  },
  availability: {
    backgroundColor: '#EAF6E4',
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  unavailable: {
    backgroundColor: colors.surfaceMuted,
  },
  availabilityText: {
    color: colors.eco,
    fontSize: 13,
    fontWeight: '600',
  },
  unavailableText: {
    color: colors.textSecondary,
  },
  quantityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quantityLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
  },
  quantityButton: {
    padding: spacing.md,
  },
  quantityNumber: {
    minWidth: 32,
    textAlign: 'center',
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  total: {
    color: colors.primary,
    fontSize: 19,
    fontWeight: '800',
  },
  message: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  messageText: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 21,
  },
  purchaseNote: {
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 20,
    color: colors.textMuted,
  },
  feedbackPage: {
    minHeight: 360,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.lg,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor:
      'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalContent: {
    width: '100%',
    maxWidth: 480,
    padding: spacing.xxl,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    gap: spacing.lg,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  emphasis: {
    fontWeight: '700',
    color: colors.text,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
});
