
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

import { APP_CONFIG } from '../../../config/app.config';
import { useAuth } from '../context/AuthProvider';
import {
  getEffectiveGoogleClientId,
  promptOfficialGoogleSignIn,
  saveGoogleClientId,
} from '../services/googleAuth.service';

import CustomerLayout from '../../../shared/components/layout/CustomerLayout';
import ScreenContainer from '../../../shared/components/layout/ScreenContainer';
import AppButton from '../../../shared/components/ui/AppButton';

import {
  colors,
  layout,
  radius,
  spacing,
} from '../../../shared/theme';

export default function LoginScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();

  const {
    login,
    loginWithGoogle,
    isAuthenticated,
    user,
    status,
  } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [showPassword, setShowPassword] =
    useState(false);

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] = useState('');

  const [googleConfigModalOpen, setGoogleConfigModalOpen] =
    useState(false);
  const [inputClientId, setInputClientId] = useState('');
  const [googleSubmitting, setGoogleSubmitting] =
    useState(false);
  const [googleError, setGoogleError] = useState('');

  const desktop =
    width >= layout.breakpoint.desktop;

  const handleLogin = async () => {
    if (submitting) {
      return;
    }

    const normalizedEmail = email.trim();

    if (!normalizedEmail || !password) {
      setError('Vui lòng nhập email và mật khẩu.');
      return;
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        normalizedEmail
      )
    ) {
      setError('Địa chỉ email không hợp lệ.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await login(normalizedEmail, password);

      setPassword('');

      router.replace('/');
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Đăng nhập thất bại. Vui lòng thử lại.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const triggerGoogleOAuth = async (clientIdToUse: string) => {
    const trimmedId = clientIdToUse.trim();
    if (!trimmedId) {
      setGoogleConfigModalOpen(true);
      return;
    }

    setGoogleSubmitting(true);
    setGoogleError('');

    await promptOfficialGoogleSignIn(
      trimmedId,
      async (profile, token) => {
        try {
          await loginWithGoogle({
            idToken: token,
            email: profile.email,
            fullName: profile.name,
            avatarUrl: profile.picture,
          });
          setGoogleConfigModalOpen(false);
          router.replace('/');
        } catch (backendErr: unknown) {
          setGoogleError(
            backendErr instanceof Error
              ? backendErr.message
              : 'Đăng nhập Google thất bại trên hệ thống SaviBite.'
          );
        } finally {
          setGoogleSubmitting(false);
        }
      },
      (errorMessage) => {
        setGoogleSubmitting(false);
        setGoogleError(errorMessage);
        if (
          errorMessage.toLowerCase().includes('client id') ||
          errorMessage.toLowerCase().includes('client_id')
        ) {
          setGoogleConfigModalOpen(true);
        }
      }
    );
  };

  const handleGoogleLogin = () => {
    setGoogleError('');
    const existingClientId = getEffectiveGoogleClientId();
    if (existingClientId) {
      triggerGoogleOAuth(existingClientId);
    } else {
      setGoogleConfigModalOpen(true);
    }
  };

  const handleSaveAndLoginGoogle = () => {
    const trimmed = inputClientId.trim();
    if (!trimmed) {
      setGoogleError('Vui lòng nhập Google Client ID của bạn.');
      return;
    }
    saveGoogleClientId(trimmed);
    triggerGoogleOAuth(trimmed);
  };

  if (status === 'loading') {
    return (
      <CustomerLayout>
        <ScreenContainer style={styles.loading}>
          <ActivityIndicator
            size="large"
            color={colors.primary}
          />

          <Text style={styles.muted}>
            Đang kiểm tra phiên đăng nhập...
          </Text>
        </ScreenContainer>
      </CustomerLayout>
    );
  }

  if (isAuthenticated) {
    return (
      <CustomerLayout>
        <ScreenContainer style={styles.loading}>
          <View style={styles.successIcon}>
            <Ionicons
              name="checkmark"
              size={28}
              color={colors.eco}
            />
          </View>

          <Text style={styles.successHeading}>
            Bạn đã đăng nhập
          </Text>

          <Text style={styles.muted}>
            Xin chào, {user?.fullName || 'bạn'}!
          </Text>

          <AppButton
            title="Về trang chủ"
            onPress={() => router.replace('/')}
          />
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
          {/* GIỚI THIỆU */}
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
              Món ngon đang chờ bạn khám phá.
            </Text>

            <Text style={styles.introDescription}>
              Đăng nhập để tiếp tục mua những
              ưu đãi thực phẩm cuối ngày,
              quản lý đơn hàng và nhận hàng
              tại cửa hàng.
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
                  SaviBite Box.
                </Text>
              </View>

              <View style={styles.benefit}>
                <Ionicons
                  name="bag-check-outline"
                  size={19}
                  color={colors.eco}
                />

                <Text style={styles.benefitText}>
                  Đặt trước và nhận trực tiếp
                  tại cửa hàng.
                </Text>
              </View>

              <View style={styles.benefit}>
                <Ionicons
                  name="receipt-outline"
                  size={19}
                  color={colors.eco}
                />

                <Text style={styles.benefitText}>
                  Theo dõi đơn hàng và
                  lịch sử mua sắm.
                </Text>
              </View>
            </View>

            <Text style={styles.slogan}>
              {APP_CONFIG.brand.slogan}
            </Text>
          </View>

          {/* FORM LOGIN */}
          <View style={styles.formCard}>
            <View style={styles.formHeading}>
              <Text style={styles.formTitle}>
                Chào mừng trở lại
              </Text>

              <Text style={styles.formSubtitle}>
                Đăng nhập vào tài khoản SaviBite
                của bạn.
              </Text>
            </View>

            <View style={styles.formFields}>
              {/* EMAIL */}
              <View style={styles.field}>
                <Text style={styles.label}>
                  Địa chỉ email
                </Text>

                <View style={styles.inputWrapper}>
                  <Ionicons
                    name="mail-outline"
                    size={19}
                    color={colors.textMuted}
                  />

                  <TextInput
                    value={email}
                    onChangeText={(value) => {
                      setEmail(value);
                      if (error) setError('');
                    }}
                    placeholder="email@example.com"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    textContentType="username"
                    autoComplete="email"
                    editable={!submitting}
                    style={styles.input}
                    accessibilityLabel="Địa chỉ email"
                  />
                </View>
              </View>

              {/* PASSWORD */}
              <View style={styles.field}>
                <Text style={styles.label}>
                  Mật khẩu
                </Text>

                <View style={styles.inputWrapper}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={19}
                    color={colors.textMuted}
                  />

                  <TextInput
                    value={password}
                    onChangeText={(value) => {
                      setPassword(value);
                      if (error) setError('');
                    }}
                    placeholder="Nhập mật khẩu"
                    placeholderTextColor={colors.textMuted}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="password"
                    autoComplete="password"
                    editable={!submitting}
                    onSubmitEditing={() => {
                      void handleLogin();
                    }}
                    returnKeyType="done"
                    style={styles.input}
                    accessibilityLabel="Mật khẩu"
                  />

                  <Pressable
                    onPress={() =>
                      setShowPassword((current) => !current)
                    }
                    accessibilityRole="button"
                    accessibilityLabel={
                      showPassword
                        ? 'Ẩn mật khẩu'
                        : 'Hiện mật khẩu'
                    }
                    style={styles.visibilityButton}
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
              </View>

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
            </View>

            {/* NÚT ĐĂNG NHẬP */}
            <AppButton
              title={
                submitting
                  ? 'Đang đăng nhập...'
                  : 'Đăng nhập'
              }
              onPress={() => {
                void handleLogin();
              }}
              disabled={submitting}
              fullWidth
              size="lg"
            />

            {/* HOẶC */}
            <View style={styles.orDivider}>
              <View style={styles.orLine} />

              <Text style={styles.orText}>
                HOẶC
              </Text>

              <View style={styles.orLine} />
            </View>

            {/* NÚT GOOGLE */}
            <Pressable
              style={[
                styles.googleButton,
                (submitting || googleSubmitting) && styles.buttonDisabled,
              ]}
              disabled={submitting || googleSubmitting}
              onPress={handleGoogleLogin}
              accessibilityRole="button"
              accessibilityLabel="Tiếp tục với Google"
            >
              {googleSubmitting ? (
                <ActivityIndicator size="small" color="#4285F4" />
              ) : (
                <View style={styles.googleIcon}>
                  <Text style={styles.googleLetter}>
                    G
                  </Text>
                </View>
              )}

              <Text style={styles.googleText}>
                {googleSubmitting ? 'Đang kết nối Google...' : 'Tiếp tục với Google'}
              </Text>

              <Ionicons
                name="arrow-forward-outline"
                size={18}
                color={colors.textSecondary}
              />
            </Pressable>

            {!!googleError && !googleConfigModalOpen && (
              <View style={styles.googleInlineErrorBox}>
                <Ionicons name="alert-circle-outline" size={16} color="#D93025" />
                <Text style={styles.googleInlineErrorText}>{googleError}</Text>
              </View>
            )}

            {/* NÚT ĐĂNG KÝ */}
            <View style={styles.registerRow}>
              <Text style={styles.registerPrompt}>
                Chưa có tài khoản?
              </Text>

              <Pressable
                onPress={() => router.push('/register')}
                accessibilityRole="link"
                accessibilityLabel="Đăng ký tài khoản mới"
                style={styles.registerButton}
              >
                <Text style={styles.registerText}>
                  Đăng ký ngay
                </Text>

                <Ionicons
                  name="arrow-forward"
                  size={15}
                  color={colors.primary}
                />
              </Pressable>
            </View>

            <Text style={styles.securityNotice}>
              Vui lòng chỉ đăng nhập trên thiết bị
              và kết nối mạng đáng tin cậy.
            </Text>

            <View style={styles.formDivider} />

            <Pressable
              onPress={() => router.push('/offers')}
              style={styles.browseLink}
              accessibilityRole="link"
            >
              <Text style={styles.browseText}>
                Xem ưu đãi mà không cần đăng nhập
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

      {/* MODAL CẤU HÌNH GOOGLE CLIENT ID */}
      <Modal
        visible={googleConfigModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!googleSubmitting) setGoogleConfigModalOpen(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              if (!googleSubmitting) setGoogleConfigModalOpen(false);
            }}
            accessibilityLabel="Đóng thông báo"
          />

          <View style={styles.modalCard}>
            <View style={styles.googleBrandHeader}>
              <View style={styles.googleIconCircle}>
                <Text style={styles.googleBrandLetter}>G</Text>
              </View>
              <Text style={styles.modalTitle}>
                Đăng nhập với Google
              </Text>
              <Text style={styles.modalDescription}>
                Để mở cửa sổ chọn tài khoản Google thật như Ảnh 2, bạn cần cung cấp Google Web Client ID:
              </Text>
            </View>

            {!!googleError && (
              <View style={styles.googleErrorBox}>
                <Ionicons name="alert-circle-outline" size={18} color="#D93025" />
                <Text style={styles.googleErrorText}>{googleError}</Text>
              </View>
            )}

            <View style={styles.googleInstructionBox}>
              <Text style={styles.googleInstructionTitle}>Các bước tạo Client ID (2 phút):</Text>
              <Text style={styles.googleInstructionStep}>1. Vào console.cloud.google.com</Text>
              <Text style={styles.googleInstructionStep}>2. Tạo OAuth Client ID (loại Web application)</Text>
              <Text style={styles.googleInstructionStep}>3. Thêm URI khởi tạo: http://localhost:8081</Text>
              <Text style={styles.googleInstructionStep}>4. Dán Client ID vào ô bên dưới:</Text>
            </View>

            <TextInput
              value={inputClientId}
              onChangeText={setInputClientId}
              placeholder="ví dụ: 123456789-abc.apps.googleusercontent.com"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.googleClientIdInput}
              editable={!googleSubmitting}
            />

            <Pressable
              style={[styles.modalPrimary, googleSubmitting && styles.buttonDisabled]}
              disabled={googleSubmitting}
              onPress={handleSaveAndLoginGoogle}
            >
              {googleSubmitting ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.modalPrimaryText}>
                  Lưu & Mở đăng nhập Google ngay
                </Text>
              )}
            </Pressable>

            <Pressable
              style={styles.modalSecondary}
              disabled={googleSubmitting}
              onPress={() => setGoogleConfigModalOpen(false)}
            >
              <Text style={styles.modalSecondaryText}>Đóng</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
    minHeight: 530,
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

  introDescription: {
    fontSize: 16,
    lineHeight: 27,
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
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
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
    fontSize: 13,
    lineHeight: 20,
    color: colors.danger,
  },

  // PHẦN HOẶC
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },

  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },

  orText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.textMuted,
  },

  // GOOGLE
  googleButton: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },

  googleIcon: {
    width: 27,
    height: 27,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
  },

  googleLetter: {
    fontSize: 17,
    fontWeight: '800',
    color: '#4285F4',
  },

  googleText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },

  buttonDisabled: {
    opacity: 0.5,
  },

  // ĐĂNG KÝ
  registerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },

  registerPrompt: {
    color: colors.textSecondary,
    fontSize: 14,
  },

  registerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
  },

  registerText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '800',
  },

  securityNotice: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 20,
    color: colors.textMuted,
  },

  formDivider: {
    height: 1,
    backgroundColor: colors.border,
  },

  browseLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },

  browseText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    textAlign: 'center',
  },

  loading: {
    minHeight: 430,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.lg,
  },

  muted: {
    fontSize: 14,
    lineHeight: 23,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  successIcon: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 32,
    backgroundColor: colors.surfaceMuted,
  },

  successHeading: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
  },

  // MODAL GOOGLE
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(14, 30, 50, 0.48)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },

  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xxl,
    gap: spacing.lg,
    alignItems: 'center',
  },

  modalIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },

  googleBrandHeader: {
    alignItems: 'center',
    gap: spacing.sm,
    width: '100%',
  },
  googleIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#4285F4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  googleBrandLetter: {
    fontSize: 24,
    fontWeight: '900',
    color: '#4285F4',
  },
  googleErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: '#FCE8E6',
    borderWidth: 1,
    borderColor: '#F2998C',
    borderRadius: radius.sm,
    padding: spacing.sm,
    width: '100%',
  },
  googleErrorText: {
    fontSize: 13,
    color: '#D93025',
    fontWeight: '600',
    flex: 1,
  },
  googleInstructionBox: {
    width: '100%',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    padding: spacing.md,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  googleInstructionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  googleInstructionStep: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  googleClientIdInput: {
    width: '100%',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 13,
    color: colors.text,
    marginTop: spacing.xs,
  },
  googleInlineErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: '#FCE8E6',
    borderWidth: 1,
    borderColor: '#F2998C',
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  googleInlineErrorText: {
    fontSize: 12,
    color: '#D93025',
    fontWeight: '600',
    flex: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },

  modalDescription: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  modalPrimary: {
    width: '100%',
    minHeight: 44,
    backgroundColor: '#4285F4',
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xs,
  },

  modalPrimaryText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.white,
  },

  modalSecondary: {
    paddingVertical: spacing.sm,
  },

  modalSecondaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textMuted,
  },
});
