
import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { ENV } from '../../../config/env';
import { useAuth } from '../../../features/auth/context/AuthProvider';
import { useCart } from '../../../features/cart/context/CartProvider';
import {
  colors,
  layout,
  radius,
  spacing,
} from '../../theme';
import ScreenContainer from './ScreenContainer';

const brandLogo =
  require('../../../../assets/LogoSaveBiteTachNen.png');

type NavPath =
  | '/'
  | '/offers'
  | '/orders'
  | '/profile'
  | '/reviews'
  | '/refunds'
  | '/admin-users'
  | '/admin-shops'
  | '/admin-refunds'
  | '/shop-orders';

type NavLink = {
  label: string;
  href: NavPath;
};

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject | null {
  return value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

function readString(
  value: unknown,
  ...keys: string[]
): string | null {
  const source = asObject(value);

  for (const key of keys) {
    const field = source?.[key];

    if (
      typeof field === 'string' &&
      field.trim()
    ) {
      return field.trim();
    }
  }

  return null;
}

function findList(
  value: unknown,
  depth = 0
): unknown[] | null {
  if (Array.isArray(value)) {
    return value;
  }

  if (depth >= 5) {
    return null;
  }

  const object = asObject(value);

  if (!object) {
    return null;
  }

  for (const key of [
    'data',
    'items',
    'shops',
    'managedShops',
    'memberships',
    'results',
  ]) {
    if (!(key in object)) {
      continue;
    }

    const found = findList(
      object[key],
      depth + 1
    );

    if (found !== null) {
      return found;
    }
  }

  return null;
}

function isManagedShop(value: unknown): boolean {
  const shop = asObject(asObject(value)?.shop);

  const role = (
    readString(
      value,
      'memberRole',
      'shopRole',
      'role'
    ) ??
    readString(
      shop,
      'memberRole',
      'shopRole',
      'role'
    ) ??
    ''
  ).toUpperCase();

  const status = (
    readString(
      value,
      'membershipStatus',
      'memberStatus'
    ) ??
    ''
  ).toUpperCase();

  const shopStatus = (
    readString(value, 'shopStatus') ??
    readString(shop, 'status') ??
    ''
  ).toUpperCase();

  return (
    ['OWNER', 'STAFF', 'MANAGER'].includes(role) &&
    (
      !status ||
      ['ACTIVE', 'APPROVED'].includes(status)
    ) &&
    (
      !shopStatus ||
      ['ACTIVE', 'APPROVED'].includes(shopStatus)
    )
  );
}

type MenuItemProps = {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  active?: boolean;
  accessibilityLabel?: string;
};

function MenuItem({
  label,
  icon,
  onPress,
  active = false,
  accessibilityLabel,
}: MenuItemProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.menuAction,
        active && styles.menuActionActive,
      ]}
      accessibilityRole="button"
      accessibilityLabel={
        accessibilityLabel ?? label
      }
    >
      <Ionicons
        name={icon}
        size={19}
        color={colors.primary}
      />

      <Text
        style={[
          styles.menuActionText,
          active && styles.menuActionTextActive,
        ]}
      >
        {label}
      </Text>

      {active && (
        <Ionicons
          name="chevron-forward"
          size={15}
          color={colors.primary}
        />
      )}
    </Pressable>
  );
}

export default function WebHeader() {
  const router = useRouter();
  const pathname = usePathname();

  const { width, height } = useWindowDimensions();

  const {
    user,
    status,
    logout,
    getAccessToken,
  } = useAuth();

  const { itemCount } = useCart();

  const [mounted, setMounted] =
    useState(false);

  const [menuOpen, setMenuOpen] =
    useState(false);

  const [loggingOut, setLoggingOut] =
    useState(false);

  const [canManageShop, setCanManageShop] =
    useState(false);

  const [checkingShop, setCheckingShop] =
    useState(false);

  const desktop =
    mounted &&
    width >= layout.breakpoint.desktop;

  const authenticated =
    status === 'authenticated' &&
    user !== null;

  const isAdmin =
    authenticated &&
    user.systemRole?.toUpperCase() === 'ADMIN';

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    let active = true;

    setCanManageShop(false);

    if (!authenticated) {
      setCheckingShop(false);
      return;
    }

    const checkPermission = async () => {
      setCheckingShop(true);

      try {
        const token =
          await getAccessToken();

        if (!token || !active) {
          return;
        }

        const response = await fetch(
          `${ENV.apiUrl.replace(/\/+$/, '')}/api/me/managed-shops`,
          {
            headers: {
              Accept: 'application/json',
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          return;
        }

        const json: unknown =
          await response.json();

        if (
          asObject(json)?.success === false
        ) {
          return;
        }

        const list = findList(json);

        if (active) {
          setCanManageShop(
            list?.some(isManagedShop) ?? false
          );
        }
      } catch {
        if (active) {
          setCanManageShop(false);
        }
      } finally {
        if (active) {
          setCheckingShop(false);
        }
      }
    };

    void checkPermission();

    return () => {
      active = false;
    };
  }, [
    authenticated,
    user?.id,
    getAccessToken,
  ]);

  const navigate = (path: NavPath) => {
    setMenuOpen(false);
    router.push(path);
  };

  const handleLogout = async () => {
    if (loggingOut) {
      return;
    }

    setLoggingOut(true);

    try {
      await logout();

      setCanManageShop(false);
      setMenuOpen(false);

      router.replace('/');
    } finally {
      setLoggingOut(false);
    }
  };

  const initial =
    user?.fullName
      ?.trim()
      .charAt(0)
      .toUpperCase() || 'U';

  const links: NavLink[] = [
    {
      label: 'Trang chủ',
      href: '/',
    },
    {
      label: 'Khám phá',
      href: '/offers',
    },
  ];

  if (authenticated) {
    links.push({
      label: 'Đơn hàng',
      href: '/orders',
    });

    if (canManageShop) {
      links.push({
        label: 'Quản lý cửa hàng',
        href: '/shop-orders',
      });
    }
  }

  const isActive = (path: NavPath) => {
    if (path === '/orders') {
      return (
        pathname === '/orders' ||
        pathname.startsWith('/order/') ||
        pathname === '/reviews' ||
        pathname === '/refunds'
      );
    }

    if (path === '/shop-orders') {
      return (
        pathname === '/shop-orders' ||
        pathname.startsWith('/shop-pickup/') ||
        pathname === '/shop-members' ||
        pathname.startsWith('/shop-reviews/') ||
        pathname === '/products' ||
        pathname === '/flash-sales' ||
        pathname === '/savibite-boxes'
      );
    }

    return pathname === path;
  };

  const menuTop = desktop
    ? layout.headerHeight + 10
    : layout.headerHeight + 48;

  const menuRight = desktop
    ? Math.max(16, (width - 1200) / 2)
    : 12;

  const menuWidth = Math.min(
    340,
    Math.max(200, width - 24)
  );

  const menuMaxHeight = Math.max(
    120,
    height - menuTop - 16
  );

  return (
    <View style={styles.header}>
      <ScreenContainer style={styles.inner}>
        <Pressable
          style={styles.brand}
          onPress={() => navigate('/')}
          accessibilityRole="link"
          accessibilityLabel="SaviBite - về trang chủ"
        >
          <Image
            source={brandLogo}
            style={styles.brandLogo}
            resizeMode="contain"
            accessibilityLabel="Logo SaviBite"
          />
        </Pressable>

        {desktop && (
          <View style={styles.navigation}>
            {links.map((link) => {
              const active =
                isActive(link.href);

              return (
                <Pressable
                  key={link.href}
                  style={styles.navLink}
                  onPress={() =>
                    navigate(link.href)
                  }
                  accessibilityRole="link"
                >
                  <Text
                    style={[
                      styles.navText,
                      active &&
                        styles.navActive,
                    ]}
                  >
                    {link.label}
                  </Text>

                  {active && (
                    <View
                      style={styles.activeLine}
                    />
                  )}
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={styles.actions}>
          <Pressable
            onPress={() => router.push('/cart')}
            accessibilityRole="button"
            accessibilityLabel={
              `Giỏ hàng có ${itemCount} sản phẩm`
            }
            style={styles.cartButton}
          >
            <Ionicons
              name="bag-outline"
              size={22}
              color={colors.text}
            />

            {itemCount > 0 && (
              <View style={styles.cartCount}>
                <Text style={styles.cartCountText}>
                  {itemCount > 99
                    ? '99+'
                    : itemCount}
                </Text>
              </View>
            )}
          </Pressable>

          {status === 'loading' ? (
            <ActivityIndicator
              color={colors.primary}
            />
          ) : authenticated ? (
            <Pressable
              onPress={() =>
                setMenuOpen(true)
              }
              style={styles.accountButton}
              accessibilityRole="button"
              accessibilityLabel="Mở menu tài khoản"
              accessibilityState={{
                expanded: menuOpen,
              }}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {initial}
                </Text>
              </View>

              {desktop && (
                <Text
                  numberOfLines={1}
                  style={styles.accountName}
                >
                  {user.fullName}
                </Text>
              )}

              <Ionicons
                name={
                  menuOpen
                    ? 'chevron-up'
                    : 'chevron-down'
                }
                size={15}
                color={colors.textSecondary}
              />
            </Pressable>
          ) : (
            <Pressable
              style={styles.loginButton}
              onPress={() =>
                router.push('/login')
              }
              accessibilityRole="button"
            >
              <Ionicons
                name="person-outline"
                size={18}
                color={colors.primary}
              />

              <Text style={styles.loginText}>
                Đăng nhập
              </Text>
            </Pressable>
          )}
        </View>
      </ScreenContainer>

      {!desktop && mounted && (
        <ScreenContainer
          style={styles.mobileNavigation}
        >
          {links.map((link) => (
            <Pressable
              key={link.href}
              onPress={() =>
                navigate(link.href)
              }
              style={styles.mobileLink}
            >
              <Text
                style={[
                  styles.navText,
                  isActive(link.href) &&
                    styles.navActive,
                ]}
              >
                {link.label}
              </Text>
            </Pressable>
          ))}
        </ScreenContainer>
      )}

      <Modal
        visible={menuOpen && authenticated}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() =>
          setMenuOpen(false)
        }
      >
        <View style={styles.overlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() =>
              setMenuOpen(false)
            }
            accessibilityLabel="Đóng menu tài khoản"
          />

          <View
            style={[
              styles.floatingMenu,
              {
                top: menuTop,
                right: menuRight,
                width: menuWidth,
                maxHeight: menuMaxHeight,
              },
            ]}
          >
            {authenticated && (
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={
                  styles.menuScrollContent
                }
              >
                {/* Nhấn tên/avatar để mở Profile */}
                <Pressable
                  style={styles.menuProfile}
                  onPress={() =>
                    navigate('/profile')
                  }
                  accessibilityRole="button"
                  accessibilityLabel="Xem hồ sơ cá nhân"
                >
                  <View style={styles.menuAvatar}>
                    <Text style={styles.avatarText}>
                      {initial}
                    </Text>
                  </View>

                  <View style={styles.profileText}>
                    <Text style={styles.profileName}>
                      {user.fullName}
                    </Text>

                    <Text
                      style={styles.profileEmail}
                      numberOfLines={1}
                    >
                      {user.email}
                    </Text>
                  </View>

                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={colors.textSecondary}
                  />
                </Pressable>

                <View style={styles.separator} />

                <MenuItem
                  label="Hồ sơ cá nhân"
                  icon="person-circle-outline"
                  active={pathname === '/profile'}
                  onPress={() =>
                    navigate('/profile')
                  }
                />

                <MenuItem
                  label="Đơn hàng của tôi"
                  icon="receipt-outline"
                  active={
                    pathname === '/orders' ||
                    pathname.startsWith('/order/')
                  }
                  onPress={() =>
                    navigate('/orders')
                  }
                />

                <MenuItem
                  label="Đánh giá đơn hàng"
                  icon="star-outline"
                  active={pathname === '/reviews'}
                  onPress={() =>
                    navigate('/reviews')
                  }
                />

                {!isAdmin && (
                  <MenuItem
                    label="Yêu cầu hoàn tiền"
                    icon="wallet-outline"
                    active={pathname === '/refunds'}
                    onPress={() =>
                      navigate('/refunds')
                    }
                  />
                )}

                {isAdmin && (
                  <>
                    <View style={styles.separator} />

                    <View style={styles.sectionHeading}>
                      <Ionicons
                        name="shield-checkmark-outline"
                        size={16}
                        color={colors.textSecondary}
                      />

                      <Text
                        style={styles.sectionHeadingText}
                      >
                        QUẢN TRỊ HỆ THỐNG
                      </Text>
                    </View>

                    <MenuItem
                      label="Quản lý người dùng"
                      icon="people-outline"
                      active={
                        pathname === '/admin-users'
                      }
                      onPress={() =>
                        navigate('/admin-users')
                      }
                    />

                    <MenuItem
                      label="Duyệt cửa hàng"
                      icon="storefront-outline"
                      active={
                        pathname === '/admin-shops'
                      }
                      onPress={() =>
                        navigate('/admin-shops')
                      }
                    />

                    <MenuItem
                      label="Quản lý hoàn tiền"
                      icon="wallet-outline"
                      active={
                        pathname === '/admin-refunds'
                      }
                      onPress={() =>
                        navigate('/admin-refunds')
                      }
                    />
                  </>
                )}

                {canManageShop && (
                  <>
                    <View style={styles.separator} />

                    <MenuItem
                      label="Quản lý cửa hàng"
                      icon="business-outline"
                      active={
                        isActive('/shop-orders')
                      }
                      onPress={() =>
                        navigate('/shop-orders')
                      }
                    />
                  </>
                )}

                {checkingShop && (
                  <View style={styles.roleRow}>
                    <ActivityIndicator
                      size="small"
                      color={colors.primary}
                    />

                    <Text style={styles.roleText}>
                      Đang kiểm tra quyền cửa hàng...
                    </Text>
                  </View>
                )}

                <View style={styles.roleRow}>
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={18}
                    color={colors.textSecondary}
                  />

                  <Text style={styles.roleText}>
                    Vai trò hệ thống:{' '}
                    {isAdmin
                      ? 'Quản trị viên'
                      : 'Người dùng'}
                  </Text>
                </View>

                <View style={styles.separator} />

                <Pressable
                  disabled={loggingOut}
                  onPress={() =>
                    void handleLogout()
                  }
                  style={styles.menuAction}
                  accessibilityRole="button"
                  accessibilityLabel="Đăng xuất"
                >
                  <Ionicons
                    name="log-out-outline"
                    size={19}
                    color={colors.danger}
                  />

                  <Text style={styles.logoutText}>
                    {loggingOut
                      ? 'Đang đăng xuất...'
                      : 'Đăng xuất'}
                  </Text>
                </Pressable>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  inner: {
    minHeight: layout.headerHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },

  brand: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  brandLogo: {
    width: 180,
    height: 44,
  },

  navigation: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: spacing.lg,
  },

  navLink: {
    minHeight: layout.headerHeight,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },

  navText: {
    color: colors.textSecondary,
    fontWeight: '500',
    fontSize: 13,
  },

  navActive: {
    color: colors.primary,
    fontWeight: '800',
  },

  activeLine: {
    height: 2,
    position: 'absolute',
    bottom: 0,
    left: spacing.sm,
    right: spacing.sm,
    backgroundColor: colors.primary,
  },

  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },

  cartButton: {
    position: 'relative',
    padding: spacing.sm,
  },

  cartCount: {
    position: 'absolute',
    right: -5,
    top: -3,
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.promotion,
  },

  cartCountText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 10,
  },

  loginButton: {
    minHeight: 38,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  loginText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },

  accountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },

  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },

  avatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.white,
  },

  accountName: {
    maxWidth: 140,
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },

  mobileNavigation: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
    paddingBottom: spacing.md,
  },

  mobileLink: {
    paddingVertical: spacing.sm,
  },

  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },

  floatingMenu: {
    position: 'absolute',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    elevation: 15,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 22,
    shadowOffset: {
      width: 0,
      height: 10,
    },
    overflow: 'hidden',
  },

  menuScrollContent: {
    padding: spacing.lg,
    gap: spacing.md,
  },

  menuProfile: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },

  menuAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primary,
  },

  profileText: {
    flex: 1,
    gap: spacing.xs,
  },

  profileName: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 14,
  },

  profileEmail: {
    color: colors.textSecondary,
    fontSize: 12,
  },

  separator: {
    height: 1,
    backgroundColor: colors.border,
  },

  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },

  sectionHeadingText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },

  menuAction: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },

  menuActionActive: {
    backgroundColor: colors.surfaceMuted,
  },

  menuActionText: {
    flex: 1,
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },

  menuActionTextActive: {
    fontWeight: '800',
  },

  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
  },

  roleText: {
    fontSize: 13,
    color: colors.textSecondary,
  },

  logoutText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '700',
  },
});
