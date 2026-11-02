import { formatVnd as formatMoney } from '../../../shared/utils/formatters';
import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import { useRouter } from 'expo-router';
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
import ScreenContainer from '../../../shared/components/layout/ScreenContainer';
import { AppButton } from '../../../shared/components/ui';
import { colors, layout, radius, spacing } from '../../../shared/theme';

import { useAuth } from '../../auth/context/AuthProvider';
import { useCart } from '../../cart/context/CartProvider';
import { OrderApiError, orderApi } from '../../orders/api/order.api';
import {
    extractOrderId,
    validateOrderReceiver,
} from '../../orders/types/order.types';

import type {
    CreateOrderRequest,
} from '../../orders/types/order.types';



function Field({
  label,
  value,
  onChangeText,
  placeholder,
  phone = false,
  multiline = false,
  maxLength,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  phone?: boolean;
  multiline?: boolean;
  maxLength?: number;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={phone ? 'phone-pad' : 'default'}
        autoCapitalize="sentences"
        multiline={multiline}
        maxLength={maxLength}
        style={[
          styles.input,
          multiline && styles.multilineInput,
        ]}
        accessibilityLabel={label}
      />
    </View>
  );
}

export default function CheckoutScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();

  const { user, status, getAccessToken } = useAuth();
  const {
    items,
    shopName,
    subtotal,
    itemCount,
    clearCart,
  } = useCart();

  const [receiverName, setReceiverName] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');
  type PaymentMethod = 'MOMO' | 'VNPAY' | 'QR_CODE' | 'COD';
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('MOMO');
  const [autoPay, setAutoPay] = useState(true);

  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uncertain, setUncertain] = useState(false);

  const requestIdRef = useRef<string | null>(null);
  const submittingRef = useRef(false);
  const initializedUserIdRef = useRef<string | null>(null);

  const desktop = width >= layout.breakpoint.desktop;

  useEffect(() => {
    if (!user) {
      initializedUserIdRef.current = null;
      return;
    }

    if (initializedUserIdRef.current !== user.id) {
      setReceiverName(user.fullName ?? '');
      setReceiverPhone(user.phone ?? '');
      initializedUserIdRef.current = user.id;
    }
  }, [user]);

  const invalidateDraft = () => {
    requestIdRef.current = null;
    setError('');
  };

  const expiredItems = items.filter(
    (item) =>
      item.availableQuantity < item.quantity ||
      new Date(item.saleEndAt).getTime() <= Date.now()
  );

  const canSubmit =
    status === 'authenticated' &&
    items.length > 0 &&
    expiredItems.length === 0 &&
    items.length <= 50 &&
    !submitting &&
    !uncertain;

  const handleCreateOrder = async () => {
    if (!canSubmit || submittingRef.current) {
      return;
    }

    const validationError = validateOrderReceiver(
      receiverName,
      receiverPhone,
      note
    );

    if (validationError) {
      setError(validationError);
      return;
    }

    if (items.some((item) => item.quantity < 1)) {
      setError('Số lượng sản phẩm không hợp lệ.');
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setError('');

    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        setError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        return;
      }

      const requestId =
        requestIdRef.current ?? Crypto.randomUUID();

      requestIdRef.current = requestId;

      const payload: CreateOrderRequest = {
        requestId,
        receiverName: receiverName.trim(),
        receiverPhone: receiverPhone.trim(),
        note: note.trim() || null,
        items: items.map((item) => ({
          offerId: item.offerId,
          quantity: item.quantity,
          expectedUnitPrice: item.unitPrice,
        })),
      };

      const response = await orderApi.create(
        accessToken,
        payload
      );

      const createdOrderId = extractOrderId(response);

      if (!createdOrderId) {
        setUncertain(true);
        setError(
          'Backend báo tạo đơn thành công nhưng chưa xác định được mã UUID đơn hàng từ phản hồi. Không gửi lại yêu cầu để tránh tạo đơn trùng. Hãy kiểm tra đơn vừa tạo trong Backend.'
        );
        return;
      }

      clearCart();
      requestIdRef.current = null;

      if (autoPay) {
        try {
          await orderApi.mockPayment(accessToken, createdOrderId, {
            requestId: Crypto.randomUUID(),
            outcome: 'SUCCESS',
          });
        } catch {
          // Bỏ qua lỗi mock payment nếu có, vẫn chuyển đến trang chi tiết đơn
        }
      }

      router.replace({
        pathname: '/order/[id]',
        params: { id: createdOrderId },
      });
    } catch (caught: unknown) {
      if (caught instanceof OrderApiError) {
        setError(caught.message);

        if (
          caught.code === 'NETWORK_ERROR' ||
          caught.code === 'INVALID_RESPONSE'
        ) {
          // Không gửi lại tự động:
          // Backend có thể đã tạo đơn trước khi mất kết nối.
          setUncertain(true);
        }
      } else {
        setError(
          'Không thể hoàn tất thao tác. Hãy kiểm tra đơn hàng trước khi thử lại.'
        );
        setUncertain(true);
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  if (status === 'loading') {
    return (
      <CustomerLayout>
        <ScreenContainer style={styles.centered}>
          <ActivityIndicator
            size="large"
            color={colors.primary}
          />
          <Text style={styles.muted}>
            Đang kiểm tra tài khoản...
          </Text>
        </ScreenContainer>
      </CustomerLayout>
    );
  }

  if (status !== 'authenticated') {
    return (
      <CustomerLayout>
        <ScreenContainer style={styles.centered}>
          <Ionicons
            name="lock-closed-outline"
            size={42}
            color={colors.primary}
          />
          <Text style={styles.title}>
            Đăng nhập để đặt hàng
          </Text>
          <Text style={styles.muted}>
            Bạn có thể giữ các món trong giỏ và tiếp tục
            thanh toán sau khi đăng nhập.
          </Text>
          <AppButton
            title="Đăng nhập"
            onPress={() => router.push('/login')}
          />
          <AppButton
            title="Quay lại giỏ hàng"
            variant="outline"
            onPress={() => router.push('/cart')}
          />
        </ScreenContainer>
      </CustomerLayout>
    );
  }

  if (items.length === 0) {
    return (
      <CustomerLayout>
        <ScreenContainer style={styles.centered}>
          <Ionicons
            name="bag-outline"
            size={42}
            color={colors.textMuted}
          />
          <Text style={styles.title}>
            Chưa có sản phẩm để đặt hàng
          </Text>
          <Text style={styles.muted}>
            Hãy chọn ít nhất một ưu đãi trước khi Checkout.
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
        <Pressable
          onPress={() => router.push('/cart')}
          style={styles.backLink}
        >
          <Ionicons
            name="arrow-back"
            size={18}
            color={colors.primary}
          />
          <Text style={styles.backText}>
            Quay lại giỏ hàng
          </Text>
        </Pressable>

        <View style={styles.heading}>
          <Text style={styles.title}>
            Xác nhận đặt hàng
          </Text>
          <Text style={styles.muted}>
            Kiểm tra thông tin trước khi gửi đơn đến cửa hàng.
          </Text>
        </View>

        <View
          style={[
            styles.columns,
            desktop && styles.columnsDesktop,
          ]}
        >
          <View style={styles.mainColumn}>
            <View style={styles.panel}>
              <View style={styles.sectionHeading}>
                <Ionicons
                  name="person-outline"
                  size={22}
                  color={colors.primary}
                />
                <Text style={styles.sectionTitle}>
                  Thông tin người nhận
                </Text>
              </View>

              <Field
                label="Họ và tên người nhận *"
                value={receiverName}
                onChangeText={(value) => {
                  invalidateDraft();
                  setReceiverName(value);
                }}
                placeholder="Nhập họ và tên"
                maxLength={100}
              />

              <Field
                label="Số điện thoại *"
                value={receiverPhone}
                phone
                onChangeText={(value) => {
                  invalidateDraft();
                  setReceiverPhone(value);
                }}
                placeholder="Ví dụ: 0901234567"
                maxLength={16}
              />

              <Field
                label="Ghi chú cho cửa hàng"
                value={note}
                multiline
                onChangeText={(value) => {
                  invalidateDraft();
                  setNote(value);
                }}
                placeholder="Yêu cầu thêm nếu có..."
                maxLength={1000}
              />

              <Text style={styles.muted}>
                Cửa hàng sẽ sử dụng thông tin này để xác nhận
                người đến nhận hàng.
              </Text>
            </View>

            <View style={styles.panel}>
              <View style={styles.sectionHeading}>
                <Ionicons
                  name="storefront-outline"
                  size={22}
                  color={colors.primary}
                />
                <Text style={styles.sectionTitle}>
                  Cửa hàng và sản phẩm
                </Text>
              </View>

              <Text style={styles.shopName}>
                {shopName}
              </Text>

              {items.map((item, index) => (
                <View key={item.offerId}>
                  {index > 0 && (
                    <View style={styles.separator} />
                  )}

                  <View style={styles.itemRow}>
                    <View style={styles.itemDetails}>
                      <Text style={styles.itemTitle}>
                        {item.title}
                      </Text>
                      <Text style={styles.muted}>
                        {item.offerType === 'FLASH_SALE'
                          ? 'Flash Sale'
                          : 'SaviBite Box'}
                        {' · '}SL: {item.quantity}
                      </Text>
                    </View>

                    <Text style={styles.itemPrice}>
                      {formatMoney(
                        item.unitPrice * item.quantity
                      )}
                    </Text>
                  </View>

                  <Text style={styles.pickupText}>
                    Nhận hàng tại: {item.shopAddress}
                  </Text>
                </View>
              ))}
            </View>

            {/* PHƯƠNG THỨC THANH TOÁN (MÔ PHỎNG) */}
            <View style={styles.panel}>
              <View style={styles.sectionHeading}>
                <Ionicons
                  name="card-outline"
                  size={22}
                  color={colors.primary}
                />
                <Text style={styles.sectionTitle}>
                  Phương thức thanh toán (Giả lập)
                </Text>
              </View>

              <Text style={styles.muted}>
                Chọn cổng thanh toán mô phỏng để trải nghiệm tính năng:
              </Text>

              <View style={styles.paymentMethodsList}>
                <Pressable
                  style={[
                    styles.paymentMethodItem,
                    paymentMethod === 'MOMO' && styles.paymentMethodActive,
                  ]}
                  onPress={() => setPaymentMethod('MOMO')}
                >
                  <View style={[styles.paymentMethodIconCircle, { backgroundColor: '#A50064' }]}>
                    <Text style={styles.paymentMethodIconText}>M</Text>
                  </View>
                  <View style={styles.paymentMethodInfo}>
                    <Text style={styles.paymentMethodTitle}>Ví MoMo (Mô phỏng)</Text>
                    <Text style={styles.paymentMethodSub}>Thanh toán nhanh qua ví MoMo</Text>
                  </View>
                  <Ionicons
                    name={paymentMethod === 'MOMO' ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={paymentMethod === 'MOMO' ? colors.primary : colors.textMuted}
                  />
                </Pressable>

                <Pressable
                  style={[
                    styles.paymentMethodItem,
                    paymentMethod === 'VNPAY' && styles.paymentMethodActive,
                  ]}
                  onPress={() => setPaymentMethod('VNPAY')}
                >
                  <View style={[styles.paymentMethodIconCircle, { backgroundColor: '#005BAA' }]}>
                    <Text style={styles.paymentMethodIconText}>V</Text>
                  </View>
                  <View style={styles.paymentMethodInfo}>
                    <Text style={styles.paymentMethodTitle}>Cổng VNPAY / Thẻ ATM (Mô phỏng)</Text>
                    <Text style={styles.paymentMethodSub}>Thẻ ngân hàng nội địa và quốc tế</Text>
                  </View>
                  <Ionicons
                    name={paymentMethod === 'VNPAY' ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={paymentMethod === 'VNPAY' ? colors.primary : colors.textMuted}
                  />
                </Pressable>

                <Pressable
                  style={[
                    styles.paymentMethodItem,
                    paymentMethod === 'QR_CODE' && styles.paymentMethodActive,
                  ]}
                  onPress={() => setPaymentMethod('QR_CODE')}
                >
                  <View style={[styles.paymentMethodIconCircle, { backgroundColor: '#107C41' }]}>
                    <Ionicons name="qr-code-outline" size={18} color="#fff" />
                  </View>
                  <View style={styles.paymentMethodInfo}>
                    <Text style={styles.paymentMethodTitle}>Chuyển khoản QR Napas 247 (Mô phỏng)</Text>
                    <Text style={styles.paymentMethodSub}>Quét mã QR từ app ngân hàng</Text>
                  </View>
                  <Ionicons
                    name={paymentMethod === 'QR_CODE' ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={paymentMethod === 'QR_CODE' ? colors.primary : colors.textMuted}
                  />
                </Pressable>

                <Pressable
                  style={[
                    styles.paymentMethodItem,
                    paymentMethod === 'COD' && styles.paymentMethodActive,
                  ]}
                  onPress={() => setPaymentMethod('COD')}
                >
                  <View style={[styles.paymentMethodIconCircle, { backgroundColor: '#F2711C' }]}>
                    <Ionicons name="cash-outline" size={18} color="#fff" />
                  </View>
                  <View style={styles.paymentMethodInfo}>
                    <Text style={styles.paymentMethodTitle}>Thanh toán tiền mặt khi nhận hàng</Text>
                    <Text style={styles.paymentMethodSub}>Thanh toán trực tiếp tại quầy cửa hàng</Text>
                  </View>
                  <Ionicons
                    name={paymentMethod === 'COD' ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={paymentMethod === 'COD' ? colors.primary : colors.textMuted}
                  />
                </Pressable>
              </View>

              <Pressable
                style={styles.autoPayToggle}
                onPress={() => setAutoPay(!autoPay)}
              >
                <Ionicons
                  name={autoPay ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={autoPay ? colors.eco : colors.textMuted}
                />
                <Text style={styles.autoPayText}>
                  Tự động mô phỏng thanh toán thành công ngay khi bấm Đặt hàng
                </Text>
              </Pressable>
            </View>

            <View style={styles.notice}>
              <Ionicons
                name="information-circle-outline"
                size={20}
                color={colors.primary}
              />
              <Text style={styles.noticeText}>
                SaviBite không giao hàng. Bạn cần đến cửa hàng
                nhận món trong khung giờ ghi trên từng ưu đãi.
                Giá và tồn kho cuối cùng do Backend xác nhận
                khi tạo đơn.
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.summaryColumn,
              desktop && styles.summaryColumnDesktop,
            ]}
          >
            <View style={styles.panel}>
              <Text style={styles.sectionTitle}>
                Thông tin thanh toán
              </Text>

              <View style={styles.totalLine}>
                <Text style={styles.muted}>
                  Số lượng sản phẩm
                </Text>
                <Text style={styles.value}>
                  {itemCount}
                </Text>
              </View>

              <View style={styles.totalLine}>
                <Text style={styles.muted}>
                  Tạm tính
                </Text>
                <Text style={styles.value}>
                  {formatMoney(subtotal)}
                </Text>
              </View>

              <View style={styles.separator} />

              <View style={styles.totalLine}>
                <Text style={styles.totalLabel}>
                  Tổng tạm tính
                </Text>
                <Text style={styles.totalAmount}>
                  {formatMoney(subtotal)}
                </Text>
              </View>

              {expiredItems.length > 0 && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>
                    Giỏ hàng có {expiredItems.length} ưu đãi
                    đã hết hạn hoặc không đủ số lượng.
                    Vui lòng trở lại giỏ hàng và cập nhật.
                  </Text>
                </View>
              )}

              {!!error && (
                <View style={styles.errorBox}>
                  <Ionicons
                    name="alert-circle-outline"
                    size={18}
                    color={colors.danger}
                  />
                  <Text style={styles.errorText}>
                    {error}
                  </Text>
                </View>
              )}

              <AppButton
                title={
                  submitting
                    ? 'Đang tạo đơn hàng...'
                    : uncertain
                      ? 'Cần kiểm tra kết quả đơn'
                      : 'Xác nhận đặt hàng'
                }
                fullWidth
                disabled={!canSubmit}
                onPress={() => {
                  void handleCreateOrder();
                }}
              />

              <Text style={styles.disclaimer}>
                Nhấn xác nhận sẽ gửi yêu cầu tạo đơn hàng
                thật đến Backend SaviBite. Thanh toán mô
                phỏng sẽ được thực hiện riêng sau đó.
              </Text>
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
  centered: {
    minHeight: 440,
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
    fontWeight: '600',
  },
  heading: {
    gap: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 29,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  muted: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 21,
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
  summaryColumn: {
    width: '100%',
  },
  summaryColumnDesktop: {
    width: 350,
  },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.lg,
    shadowColor: colors.text,
    shadowOpacity: 0.04,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 1,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  field: {
    gap: spacing.sm,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  input: {
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  multilineInput: {
    minHeight: 92,
    textAlignVertical: 'top',
  },
  shopName: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.primary,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  itemDetails: {
    flex: 1,
    gap: spacing.sm,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  pickupText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 19,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
  },
  notice: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.lg,
    borderRadius: radius.md,
  },
  noticeText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 23,
  },
  totalLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  totalAmount: {
    fontSize: 23,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.5,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
    borderRadius: radius.sm,
  },
  errorText: {
    flex: 1,
    color: colors.danger,
    fontSize: 13,
    lineHeight: 21,
  },
  disclaimer: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 20,
    textAlign: 'center',
  },
  paymentMethodsList: {
    gap: spacing.sm,
  },
  paymentMethodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  paymentMethodActive: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceMuted,
  },
  paymentMethodIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentMethodIconText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '900',
  },
  paymentMethodInfo: {
    flex: 1,
  },
  paymentMethodTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  paymentMethodSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  autoPayToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  autoPayText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
});
