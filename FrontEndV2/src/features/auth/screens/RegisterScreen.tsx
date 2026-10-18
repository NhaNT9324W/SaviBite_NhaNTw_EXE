
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
    useWindowDimensions,
} from 'react-native';

import { APP_CONFIG } from '../../../config/app.config';
import CustomerLayout from '../../../shared/components/layout/CustomerLayout';
import ScreenContainer from '../../../shared/components/layout/ScreenContainer';
import {
    colors,
    layout,
    radius,
    spacing,
} from '../../../shared/theme';

import { authApi } from '../api/auth.api';
import { useAuth } from '../context/AuthProvider';
import type { RegisterRequest } from '../types/auth.types';

type FieldName =
  | 'fullName'
  | 'email'
  | 'phone'
  | 'password'
  | 'confirmPassword';

type RegisterForm = Record<FieldName, string>;

const initialForm: RegisterForm = {
  fullName: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
};

function validateForm(
  form: RegisterForm
): string | null {
  const name = form.fullName.trim();
  const email = form.email.trim();
  const phone = form.phone.trim();
  const password = form.password;

  if (name.length < 2 || name.length > 100) {
    return 'Họ tên phải từ 2 đến 100 ký tự.';
  }

  if (
    !email ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return 'Vui lòng nhập email hợp lệ (tối đa 254 ký tự).';
  }

  if (!/^0[0-9]{9}$/.test(phone)) {
    return 'Số điện thoại phải gồm đúng 10 chữ số, bắt đầu bằng 0.';
  }

  if (
    password.length < 8 ||
    password.length > 100 ||
    !/[A-Za-z]/.test(password) ||
    !/[0-9]/.test(password)
  ) {
    return 'Mật khẩu cần 8–100 ký tự, có ít nhất một chữ cái và một chữ số.';
  }

  if (password !== form.confirmPassword) {
    return 'Xác nhận mật khẩu không khớp.';
  }

  return null;
}

export default function RegisterScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { status, isAuthenticated } = useAuth();

  const [form, setForm] =
    useState<RegisterForm>(initialForm);

  const [showPassword, setShowPassword] =
    useState(false);

  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [submitting, setSubmitting] =
    useState(false);

  const [registered, setRegistered] =
    useState(false);

  const [error, setError] = useState('');

  const desktop =
    width >= layout.breakpoint.desktop;

  const updateField = (
    field: FieldName,
    value: string
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    if (error) {
      setError('');
    }
  };

  const handleRegister = async () => {
    if (submitting || registered) {
      return;
    }

    const validationError = validateForm(form);

    if (validationError) {
      setError(validationError);
      return;
    }

    const request: RegisterRequest = {
      fullName: form.fullName.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim(),
      password: form.password,
    };

    setSubmitting(true);
    setError('');

    try {
      await authApi.register(request);

      setRegistered(true);

      // Không lưu lại mật khẩu trong form
      // sau khi đăng ký thành công.
      setForm((current) => ({
        ...current,
        password: '',
        confirmPassword: '',
      }));
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Không thể đăng ký tài khoản. Vui lòng thử lại.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'loading') {
    return (
      <CustomerLayout>
        <ScreenContainer style={styles.center}>
          <ActivityIndicator
            size="large"
            color={colors.primary}
          />

          <Text style={styles.description}>
            Đang kiểm tra phiên đăng nhập...
          </Text>
        </ScreenContainer>
      </CustomerLayout>
    );
  }

  if (registered) {
    return (
      <CustomerLayout>
        <ScreenContainer style={styles.center}>
          <View style={styles.successCircle}>
            <Ionicons
              name="checkmark-circle"
              size={52}
              color={colors.eco}
            />
          </View>

          <Text style={styles.successTitle}>
            Đăng ký thành công!
          </Text>

          <Text style={styles.successDescription}>
            Tài khoản {form.email.trim()} đã được
            hệ thống chấp nhận đăng ký.
          </Text>

          <Text style={styles.description}>
            Bạn có thể đăng nhập bằng email
            và mật khẩu vừa tạo.
          </Text>

          <Pressable
            style={styles.primaryButton}
            onPress={() => router.replace('/login')}
            accessibilityRole="button"
          >
            <Text style={styles.primaryButtonText}>
              Đến trang đăng nhập
            </Text>

            <Ionicons
              name="arrow-forward"
              size={18}
              color={colors.white}
            />
          </Pressable>
        </ScreenContainer>
      </CustomerLayout>
    );
  }

  if (isAuthenticated) {
    return (
      <CustomerLayout>
        <ScreenContainer style={styles.center}>
          <Ionicons
            name="person-circle-outline"
            size={52}
            color={colors.primary}
          />

          <Text style={styles.successTitle}>
            Bạn đã đăng nhập
          </Text>

          <Text style={styles.description}>
            Hãy đăng xuất nếu muốn đăng ký
            một tài khoản khác.
          </Text>

          <Pressable
            style={styles.primaryButton}
            onPress={() => router.replace('/')}
          >
            <Text style={styles.primaryButtonText}>
              Về trang chủ
            </Text>
          </Pressable>
        </ScreenContainer>
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout>
      <ScreenContainer style={styles.page}>
        <View
          style={[
            styles.content,
            desktop && styles.contentDesktop,
          ]}
        >
          {/* Giới thiệu */}
          <View
            style={[
              styles.introduction,
              desktop && styles.introductionDesktop,
            ]}
          >
            <View style={styles.brandTag}>
              <Ionicons
                name="leaf-outline"
                size={16}
                color={colors.eco}
              />

              <Text style={styles.brandTagText}>
                SAVIBITE ACCOUNT
              </Text>
            </View>

            <Text style={styles.introHeading}>
              Bắt đầu hành trình
              tiết kiệm cùng SaviBite.
            </Text>

            <Text style={styles.description}>
              Tạo tài khoản để khám phá ưu đãi
              thực phẩm cuối ngày, đặt món
              nhanh chóng và cùng giảm
              lãng phí thực phẩm.
            </Text>

            <View style={styles.benefits}>
              <View style={styles.benefit}>
                <Ionicons
                  name="pricetag-outline"
                  size={19}
                  color={colors.eco}
                />

                <Text style={styles.benefitText}>
                  Khám phá Flash Sale và
                  SaviBite Box hấp dẫn.
                </Text>
              </View>

              <View style={styles.benefit}>
                <Ionicons
                  name="bag-check-outline"
                  size={19}
                  color={colors.eco}
                />

                <Text style={styles.benefitText}>
                  Đặt trước và nhận món
                  trực tiếp tại cửa hàng.
                </Text>
              </View>

              <View style={styles.benefit}>
                <Ionicons
                  name="heart-outline"
                  size={19}
                  color={colors.eco}
                />

                <Text style={styles.benefitText}>
                  Tiết kiệm chi phí và góp phần
                  giảm lãng phí thực phẩm.
                </Text>
              </View>
            </View>

            <Text style={styles.slogan}>
              {APP_CONFIG.brand.slogan}
            </Text>
          </View>

          {/* Form đăng ký */}
          <View style={styles.formCard}>
            <View style={styles.formHeading}>
              <Text style={styles.formTitle}>
                Tạo tài khoản mới
              </Text>

              <Text style={styles.formSubtitle}>
                Điền thông tin để tham gia SaviBite.
              </Text>
            </View>

            <View style={styles.formFields}>
              <View style={styles.field}>
                <Text style={styles.label}>
                  Họ và tên *
                </Text>

                <View style={styles.inputWrapper}>
                  <Ionicons
                    name="person-outline"
                    size={19}
                    color={colors.textMuted}
                  />

                  <TextInput
                    value={form.fullName}
                    onChangeText={(value) =>
                      updateField('fullName', value)
                    }
                    placeholder="Nguyễn Văn A"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="words"
                    autoComplete="name"
                    maxLength={100}
                    editable={!submitting}
                    style={styles.input}
                    accessibilityLabel="Họ và tên"
                  />
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>
                  Địa chỉ email *
                </Text>

                <View style={styles.inputWrapper}>
                  <Ionicons
                    name="mail-outline"
                    size={19}
                    color={colors.textMuted}
                  />

                  <TextInput
                    value={form.email}
                    onChangeText={(value) =>
                      updateField('email', value)
                    }
                    placeholder="email@example.com"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    autoComplete="email"
                    maxLength={254}
                    editable={!submitting}
                    style={styles.input}
                    accessibilityLabel="Địa chỉ email"
                  />
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>
                  Số điện thoại *
                </Text>

                <View style={styles.inputWrapper}>
                  <Ionicons
                    name="call-outline"
                    size={19}
                    color={colors.textMuted}
                  />

                  <TextInput
                    value={form.phone}
                    onChangeText={(value) =>
                      updateField(
                        'phone',
                        value.replace(/[^0-9]/g, '')
                      )
                    }
                    placeholder="0912345678"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="phone-pad"
                    autoComplete="tel"
                    maxLength={10}
                    editable={!submitting}
                    style={styles.input}
                    accessibilityLabel="Số điện thoại"
                  />
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>
                  Mật khẩu *
                </Text>

                <View style={styles.inputWrapper}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={19}
                    color={colors.textMuted}
                  />

                  <TextInput
                    value={form.password}
                    onChangeText={(value) =>
                      updateField('password', value)
                    }
                    placeholder="Nhập mật khẩu"
                    placeholderTextColor={colors.textMuted}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="new-password"
                    maxLength={100}
                    editable={!submitting}
                    style={styles.input}
                    accessibilityLabel="Mật khẩu"
                  />

                  <Pressable
                    style={styles.visibilityButton}
                    onPress={() =>
                      setShowPassword((value) => !value)
                    }
                    accessibilityLabel={
                      showPassword
                        ? 'Ẩn mật khẩu'
                        : 'Hiện mật khẩu'
                    }
                  >
                    <Ionicons
                      name={
                        showPassword
                          ? 'eye-off-outline'
                          : 'eye-outline'
                      }
                      size={20}
                      color={colors.textSecondary}
                    />
                  </Pressable>
                </View>

                <Text style={styles.hint}>
                  8–100 ký tự, ít nhất 1 chữ cái
                  và 1 chữ số.
                </Text>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>
                  Xác nhận mật khẩu *
                </Text>

                <View style={styles.inputWrapper}>
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={19}
                    color={colors.textMuted}
                  />

                  <TextInput
                    value={form.confirmPassword}
                    onChangeText={(value) =>
                      updateField(
                        'confirmPassword',
                        value
                      )
                    }
                    placeholder="Nhập lại mật khẩu"
                    placeholderTextColor={colors.textMuted}
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={100}
                    editable={!submitting}
                    style={styles.input}
                    accessibilityLabel="Xác nhận mật khẩu"
                    onSubmitEditing={() => {
                      void handleRegister();
                    }}
                    returnKeyType="done"
                  />

                  <Pressable
                    style={styles.visibilityButton}
                    onPress={() =>
                      setShowConfirmPassword(
                        (value) => !value
                      )
                    }
                    accessibilityLabel={
                      showConfirmPassword
                        ? 'Ẩn xác nhận mật khẩu'
                        : 'Hiện xác nhận mật khẩu'
                    }
                  >
                    <Ionicons
                      name={
                        showConfirmPassword
                          ? 'eye-off-outline'
                          : 'eye-outline'
                      }
                      size={20}
                      color={colors.textSecondary}
                    />
                  </Pressable>
                </View>
              </View>

              {!!error && (
                <View style={styles.errorBox}>
                  <Ionicons
                    name="alert-circle-outline"
                    size={19}
                    color={colors.danger}
                  />

                  <Text style={styles.errorText}>
                    {error}
                  </Text>
                </View>
              )}
            </View>

            <Pressable
              style={[
                styles.primaryButton,
                submitting && styles.disabledButton,
              ]}
              onPress={() => void handleRegister()}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityLabel="Đăng ký tài khoản"
            >
              {submitting ? (
                <ActivityIndicator
                  size="small"
                  color={colors.white}
                />
              ) : (
                <Ionicons
                  name="person-add-outline"
                  size={19}
                  color={colors.white}
                />
              )}

              <Text style={styles.primaryButtonText}>
                {submitting
                  ? 'Đang tạo tài khoản...'
                  : 'Đăng ký tài khoản'}
              </Text>
            </Pressable>

            <View style={styles.loginRow}>
              <Text style={styles.loginPrompt}>
                Đã có tài khoản?
              </Text>

              <Pressable
                onPress={() => router.replace('/login')}
                accessibilityRole="link"
              >
                <Text style={styles.loginLink}>
                  Đăng nhập ngay
                </Text>
              </Pressable>
            </View>

            <View style={styles.divider} />

            <Pressable
              style={styles.browseLink}
              onPress={() => router.push('/offers')}
              accessibilityRole="link"
            >
              <Text style={styles.browseText}>
                Khám phá ưu đãi không cần đăng nhập
              </Text>

              <Ionicons
                name="arrow-forward"
                size={17}
                color={colors.primary}
              />
            </Pressable>
          </View>
        </View>
      </ScreenContainer>
    </CustomerLayout>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingTop: spacing.section,
    paddingBottom: spacing.section,
  },

  content: {
    gap: spacing.xxxl,
  },

  contentDesktop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.section,
  },

  introduction: {
    gap: spacing.xl,
  },

  introductionDesktop: {
    flex: 1,
    maxWidth: 510,
  },

  brandTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  brandTagText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: colors.eco,
  },

  introHeading: {
    fontSize: 36,
    fontWeight: '800',
    lineHeight: 46,
    letterSpacing: -0.8,
    color: colors.text,
  },

  description: {
    fontSize: 15,
    lineHeight: 26,
    color: colors.textSecondary,
  },

  benefits: {
    gap: spacing.lg,
  },

  benefit: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },

  benefitText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 23,
    color: colors.textSecondary,
  },

  slogan: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.eco,
    letterSpacing: 0.5,
  },

  formCard: {
    width: '100%',
    maxWidth: 450,
    alignSelf: 'center',
    padding: spacing.xxl,
    gap: spacing.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
  },

  formHeading: {
    gap: spacing.sm,
  },

  formTitle: {
    fontSize: 25,
    fontWeight: '800',
    color: colors.text,
  },

  formSubtitle: {
    fontSize: 14,
    lineHeight: 23,
    color: colors.textSecondary,
  },

  formFields: {
    gap: spacing.lg,
  },

  field: {
    gap: spacing.sm,
  },

  label: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },

  inputWrapper: {
    minHeight: 50,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
  },

  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    fontSize: 15,
    color: colors.text,
  },

  visibilityButton: {
    padding: spacing.sm,
  },

  hint: {
    fontSize: 12,
    lineHeight: 19,
    color: colors.textMuted,
  },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
  },

  errorText: {
    flex: 1,
    color: colors.danger,
    fontSize: 13,
    lineHeight: 20,
  },

  primaryButton: {
    minHeight: 52,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },

  primaryButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.white,
  },

  disabledButton: {
    opacity: 0.65,
  },

  loginRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },

  loginPrompt: {
    fontSize: 14,
    color: colors.textSecondary,
  },

  loginLink: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primary,
  },

  divider: {
    height: 1,
    backgroundColor: colors.border,
  },

  browseLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },

  browseText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
    textAlign: 'center',
  },

  center: {
    minHeight: 450,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.section,
  },

  successCircle: {
    width: 78,
    height: 78,
    borderRadius: 39,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },

  successTitle: {
    fontSize: 27,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },

  successDescription: {
    fontSize: 15,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 24,
  },
});
