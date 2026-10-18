import { formatVnd as money } from '../../../shared/utils/formatters';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
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

import { useCart } from '../context/CartProvider';
import type { CartItem } from '../types/cart.types';



function CartProductRow({
  item,
  onIncrease,
  onDecrease,
  onRemove,
}: {
  item: CartItem;
  onIncrease: () => void;
  onDecrease: () => void;
  onRemove: () => void;
}) {
  const isFlash = item.offerType === 'FLASH_SALE';
  const expired =
    new Date(item.saleEndAt).getTime() <= Date.now();

  return (
    <View style={styles.productRow}>
      <View style={styles.productImage}>
        {item.imageUrl ? (
          <Image
            source={{ uri: item.imageUrl }}
            style={styles.image}
            resizeMode="cover"
          />
        ) : (
          <Ionicons
            name={
              isFlash
                ? 'restaurant-outline'
                : 'gift-outline'
            }
            size={28}
            color={colors.textMuted}
          />
        )}
      </View>

      <View style={styles.productContent}>
        <View style={styles.badgeRow}>
          <AppBadge
            label={
              isFlash
                ? 'FLASH SALE'
                : 'SAVIBITE BOX'
            }
            variant={
              isFlash ? 'promotion' : 'success'
            }
          />

          {expired && (
            <AppBadge
              label="ĐÃ HẾT HẠN"
              variant="danger"
            />
          )}
        </View>

        <Text style={styles.productTitle}>
          {item.title}
        </Text>

        <Text style={styles.price}>
          {money(item.unitPrice)}
        </Text>

        <View style={styles.productBottom}>
          <View style={styles.quantityControl}>
            <Pressable
              onPress={onDecrease}
              disabled={item.quantity <= 1}
              accessibilityLabel="Giảm số lượng"
              style={[
                styles.quantityButton,
                item.quantity <= 1 &&
                  styles.disabledControl,
              ]}
            >
              <Ionicons
                name="remove"
                size={18}
                color={colors.text}
              />
            </Pressable>

            <Text style={styles.quantityText}>
              {item.quantity}
            </Text>

            <Pressable
              onPress={onIncrease}
              disabled={
                expired ||
                item.quantity >= item.availableQuantity
              }
              accessibilityLabel="Tăng số lượng"
              style={[
                styles.quantityButton,
                (expired ||
                  item.quantity >= item.availableQuantity) &&
                  styles.disabledControl,
              ]}
            >
              <Ionicons
                name="add"
                size={18}
                color={colors.text}
              />
            </Pressable>
          </View>

          <Pressable
            onPress={onRemove}
            style={styles.removeButton}
          >
            <Ionicons
              name="trash-outline"
              size={17}
              color={colors.danger}
            />
            <Text style={styles.removeText}>
              Xóa
            </Text>
          </Pressable>
        </View>

        <Text style={styles.itemSubtotal}>
          Thành tiền:{' '}
          {money(item.unitPrice * item.quantity)}
        </Text>
      </View>
    </View>
  );
}

export default function CartScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const desktop = width >= layout.breakpoint.desktop;

  const {
    items,
    itemCount,
    subtotal,
    shopName,
    updateQuantity,
    removeItem,
    clearCart,
  } = useCart();

  const [confirmClear, setConfirmClear] =
    useState(false);

  const invalidItems = items.filter(
    (item) =>
      new Date(item.saleEndAt).getTime() <= Date.now() ||
      item.availableQuantity < item.quantity
  );

  const canCheckout =
    items.length > 0 &&
    items.length <= 50 &&
    invalidItems.length === 0;

  if (items.length === 0) {
    return (
      <CustomerLayout>
        <ScreenContainer style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <Ionicons
              name="bag-outline"
              size={42}
              color={colors.textMuted}
            />
          </View>

          <Text style={styles.emptyTitle}>
            Giỏ hàng của bạn đang trống
          </Text>

          <Text style={styles.emptyDescription}>
            Khám phá những món ngon cuối ngày và
            thêm vào giỏ để chuẩn bị đặt hàng.
          </Text>

          <AppButton
            title="Khám phá ưu đãi"
            onPress={() => router.push('/offers')}
          />
        </ScreenContainer>
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout>
      <ScreenContainer style={styles.page}>
        <View style={styles.heading}>
          <View style={styles.headingText}>
            <Text style={styles.title}>
              Giỏ hàng của bạn
            </Text>
            <Text style={styles.subtitle}>
              {itemCount} sản phẩm trong giỏ
            </Text>
          </View>

          <Pressable
            onPress={() => setConfirmClear(true)}
            style={styles.clearButton}
          >
            <Ionicons
              name="trash-outline"
              size={17}
              color={colors.danger}
            />
            <Text style={styles.clearText}>
              Xóa giỏ hàng
            </Text>
          </Pressable>
        </View>

        <View
          style={[
            styles.columns,
            desktop && styles.columnsDesktop,
          ]}
        >
          <View style={styles.itemsColumn}>
            <View style={styles.shopHeader}>
              <Ionicons
                name="storefront-outline"
                size={20}
                color={colors.primary}
              />
              <View style={styles.shopInfo}>
                <Text style={styles.shopLabel}>
                  Đơn hàng từ cửa hàng
                </Text>
                <Text style={styles.shopName}>
                  {shopName}
                </Text>
              </View>
            </View>

            <View style={styles.itemsPanel}>
              {items.map((item, index) => (
                <React.Fragment key={item.offerId}>
                  {index > 0 && (
                    <View style={styles.separator} />
                  )}

                  <CartProductRow
                    item={item}
                    onIncrease={() =>
                      updateQuantity(
                        item.offerId,
                        item.quantity + 1
                      )
                    }
                    onDecrease={() =>
                      updateQuantity(
                        item.offerId,
                        item.quantity - 1
                      )
                    }
                    onRemove={() =>
                      removeItem(item.offerId)
                    }
                  />
                </React.Fragment>
              ))}
            </View>

            <Pressable
              onPress={() => router.push('/offers')}
              style={styles.continueShopping}
            >
              <Ionicons
                name="arrow-back-outline"
                color={colors.primary}
                size={17}
              />
              <Text style={styles.continueText}>
                Tiếp tục khám phá món ngon
              </Text>
            </Pressable>
          </View>

          <View
            style={[
              styles.summaryColumn,
              desktop && styles.summaryColumnDesktop,
            ]}
          >
            <View style={styles.summaryPanel}>
              <Text style={styles.summaryTitle}>
                Tóm tắt giỏ hàng
              </Text>

              <View style={styles.summaryLine}>
                <Text style={styles.summaryLabel}>
                  Số lượng sản phẩm
                </Text>
                <Text style={styles.summaryValue}>
                  {itemCount}
                </Text>
              </View>

              <View style={styles.summaryLine}>
                <Text style={styles.summaryLabel}>
                  Tạm tính
                </Text>
                <Text style={styles.summaryValue}>
                  {money(subtotal)}
                </Text>
              </View>

              <View style={styles.separator} />

              <View style={styles.summaryLine}>
                <Text style={styles.totalLabel}>
                  Tổng tạm tính
                </Text>
                <Text style={styles.totalValue}>
                  {money(subtotal)}
                </Text>
              </View>

              {invalidItems.length > 0 && (
                <View style={styles.warning}>
                  <Ionicons
                    name="alert-circle-outline"
                    color={colors.warning}
                    size={18}
                  />
                  <Text style={styles.warningText}>
                    Có {invalidItems.length} ưu đãi hết
                    hạn hoặc không đủ số lượng. Vui lòng
                    cập nhật giỏ trước khi đặt hàng.
                  </Text>
                </View>
              )}

              <AppButton
                title="Tiến hành đặt hàng"
                disabled={!canCheckout}
                fullWidth
                onPress={() =>
                  router.push('/checkout')
                }
              />

              <Text style={styles.note}>
                Giá và tồn kho sẽ được Backend
                xác minh khi tạo đơn. Bạn nhận hàng
                trực tiếp tại cửa hàng.
              </Text>
            </View>
          </View>
        </View>
      </ScreenContainer>

      <Modal
        visible={confirmClear}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setConfirmClear(false)
        }
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Xóa toàn bộ giỏ hàng?
            </Text>

            <Text style={styles.modalDescription}>
              Tất cả sản phẩm trong giỏ sẽ bị xóa.
            </Text>

            <View style={styles.modalActions}>
              <AppButton
                title="Hủy"
                variant="outline"
                onPress={() =>
                  setConfirmClear(false)
                }
              />

              <AppButton
                title="Xóa giỏ"
                variant="danger"
                onPress={() => {
                  clearCart();
                  setConfirmClear(false);
                }}
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
    paddingTop: spacing.xxxl,
    paddingBottom: spacing.section,
    gap: spacing.xl,
  },
  heading: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.lg,
  },
  headingText: {
    gap: spacing.sm,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.7,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  clearText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.danger,
  },
  columns: {
    gap: spacing.xxl,
  },
  columnsDesktop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  itemsColumn: {
    flex: 1,
    minWidth: 0,
    gap: spacing.lg,
  },
  shopHeader: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  shopInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  shopLabel: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  shopName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  itemsPanel: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.base,
    paddingVertical: spacing.md,
  },
  productImage: {
    width: 92,
    height: 92,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    height: '100%',
    width: '100%',
  },
  productContent: {
    flex: 1,
    minWidth: 0,
    gap: spacing.sm,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  productTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 24,
  },
  price: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.primary,
  },
  productBottom: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
  },
  quantityButton: {
    padding: spacing.sm,
  },
  disabledControl: {
    opacity: 0.4,
  },
  quantityText: {
    minWidth: 30,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  removeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
  },
  removeText: {
    fontSize: 13,
    color: colors.danger,
  },
  itemSubtotal: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
  },
  continueShopping: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'flex-start',
  },
  continueText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  summaryColumn: {
    width: '100%',
  },
  summaryColumnDesktop: {
    width: 350,
  },
  summaryPanel: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.lg,
    shadowColor: colors.text,
    shadowOpacity: 0.055,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  summaryTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: colors.text,
  },
  summaryLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  summaryLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  totalValue: {
    fontSize: 23,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.5,
  },
  warning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
    borderRadius: radius.sm,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 19,
    color: colors.warning,
  },
  note: {
    fontSize: 12,
    lineHeight: 20,
    textAlign: 'center',
    color: colors.textSecondary,
  },
  emptyContainer: {
    minHeight: 460,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.section,
  },
  emptyIcon: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: colors.surfaceMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 23,
    fontWeight: '800',
    textAlign: 'center',
    color: colors.text,
  },
  emptyDescription: {
    maxWidth: 420,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 23,
    color: colors.textSecondary,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  modalContent: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xxl,
    gap: spacing.lg,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  modalDescription: {
    fontSize: 14,
    lineHeight: 23,
    color: colors.textSecondary,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
});
