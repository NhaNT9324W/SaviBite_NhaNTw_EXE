import styles from './ProfileScreen.styles';

import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ENV } from '../../../config/env';
import { useAuth } from '../../../features/auth/context/AuthProvider';
import CustomerLayout from '../../../shared/components/layout/CustomerLayout';
import ScreenContainer from '../../../shared/components/layout/ScreenContainer';

const C = {
  primary: '#07549B',
  primarySoft: '#EAF3FC',
  text: '#182D49',
  muted: '#71839C',
  border: '#DFE7F0',
  surface: '#FFFFFF',
  background: '#F7FAFD',
  success: '#248348',
  successBg: '#EAF7EE',
  danger: '#C63737',
  dangerBg: '#FDEDED',
};

type Dict = Record<string, unknown>;

type Profile = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  systemRole: string;
  status: string;
  avatarUrl: string | null;
};

type ManagedShop = {
  id: string;
  name: string;
  role: string;
  status: string;
};

type SelectedAvatar = {
  uri: string;
  fileName: string;
  mimeType: string;
  file?: File;
};

function asObject(value: unknown): Dict | null {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    return null;
  }

  return value as Dict;
}

function getString(
  value: unknown,
  ...keys: string[]
): string | null {
  const source = asObject(value);

  if (!source) return null;

  for (const key of keys) {
    const field = source[key];

    if (
      typeof field === 'string' &&
      field.trim().length > 0
    ) {
      return field.trim();
    }
  }

  return null;
}

function unwrap(value: unknown): unknown {
  let current = value;

  for (let i = 0; i < 3; i += 1) {
    const source = asObject(current);

    if (!source || !('data' in source)) {
      break;
    }

    current = source.data;
  }

  return current;
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

  const source = asObject(value);

  if (!source) {
    return null;
  }

  for (const key of [
    'data',
    'items',
    'shops',
    'managedShops',
    'memberships',
    'results',
    'records',
  ]) {
    if (!(key in source)) {
      continue;
    }

    const found = findList(
      source[key],
      depth + 1
    );

    if (found !== null) {
      return found;
    }
  }

  return null;
}

function normalizeProfile(
  value: unknown
): Profile | null {
  const root = asObject(value);

  if (!root) return null;

  const source =
    asObject(root.profile) ??
    asObject(root.user) ??
    root;

  const id = getString(
    source,
    'id',
    'userId'
  );

  const fullName = getString(
    source,
    'fullName',
    'name'
  );

  const email = getString(
    source,
    'email'
  );

  if (!id && !fullName && !email) {
    return null;
  }

  return {
    id: id ?? '',
    fullName: fullName ?? '',
    email: email ?? '',
    phone:
      getString(
        source,
        'phone',
        'phoneNumber'
      ) ?? '',
    systemRole: (
      getString(
        source,
        'systemRole',
        'role'
      ) ?? 'USER'
    ).toUpperCase(),
    status: (
      getString(
        source,
        'status',
        'accountStatus'
      ) ?? 'ACTIVE'
    ).toUpperCase(),
    avatarUrl: getString(
      source,
      'avatarUrl',
      'avatarImageUrl',
      'profileImageUrl',
      'imageUrl'
    ),
  };
}

/**
 * Đồng bộ cách đọc cửa hàng với shop-orders.tsx.
 *
 * API có thể trả:
 * {
 *   shopId: "...",
 *   name: "Bánh Nhà Hân",
 *   role: "OWNER",
 *   status: "APPROVED"
 * }
 *
 * Hoặc dữ liệu shop lồng bên trong.
 */
function normalizeManagedShop(
  value: unknown
): ManagedShop | null {
  const root = asObject(value);

  if (!root) {
    return null;
  }

  const nestedShop = asObject(root.shop);

  const id =
    getString(root, 'shopId') ??
    getString(nestedShop, 'id', 'shopId') ??
    getString(root, 'id');

  if (!id) {
    return null;
  }

  const name =
    getString(root, 'shopName', 'name') ??
    getString(
      nestedShop,
      'name',
      'shopName'
    ) ??
    'Cửa hàng chưa có tên';

  const role = (
    getString(
      root,
      'role',
      'memberRole',
      'shopRole'
    ) ??
    getString(
      nestedShop,
      'role',
      'memberRole',
      'shopRole'
    ) ??
    ''
  ).toUpperCase();

  const membershipStatus = (
    getString(
      root,
      'membershipStatus',
      'memberStatus'
    ) ?? ''
  ).toUpperCase();

  const shopStatus = (
    getString(
      root,
      'shopStatus',
      'status'
    ) ??
    getString(
      nestedShop,
      'status'
    ) ??
    'ACTIVE'
  ).toUpperCase();

  if (
    !['OWNER', 'STAFF', 'MANAGER'].includes(
      role
    )
  ) {
    return null;
  }

  if (
    membershipStatus &&
    !['ACTIVE', 'APPROVED'].includes(
      membershipStatus
    )
  ) {
    return null;
  }

  // Hiển thị trạng thái thực tế của cửa hàng.
  // Backend vẫn quyết định quyền truy cập API.
  return {
    id,
    name,
    role,
    status: shopStatus,
  };
}

function resolveAvatarUrl(
  value: string | null
): string | null {
  if (!value) return null;

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  if (value.startsWith('/')) {
    return `${
      ENV.apiUrl.replace(/\/+$/, '')
    }${value}`;
  }

  return null;
}

function roleLabel(value: string): string {
  switch (value.toUpperCase()) {
    case 'ADMIN':
      return 'Quản trị viên';
    case 'OWNER':
      return 'Chủ cửa hàng';
    case 'STAFF':
      return 'Nhân viên cửa hàng';
    case 'MANAGER':
      return 'Quản lý cửa hàng';
    default:
      return 'Người dùng';
  }
}

function statusLabel(value: string): string {
  switch (value.toUpperCase()) {
    case 'ACTIVE':
      return 'Đang hoạt động';
    case 'APPROVED':
      return 'Đã duyệt';
    case 'LOCKED':
      return 'Đã khóa';
    case 'INACTIVE':
      return 'Ngừng hoạt động';
    case 'PENDING':
      return 'Chờ duyệt';
    case 'REJECTED':
      return 'Đã từ chối';
    case 'SUSPENDED':
      return 'Tạm ngừng';
    default:
      return value || 'Chưa xác định';
  }
}

function errorMessage(
  error: unknown,
  fallback: string
): string {
  return error instanceof Error
    ? error.message
    : fallback;
}

async function readApiResponse(
  response: Response
): Promise<unknown> {
  const raw = await response.text();

  let json: unknown = null;

  if (raw.trim()) {
    try {
      json = JSON.parse(raw);
    } catch {
      throw new Error(
        `Backend trả về dữ liệu không hợp lệ (HTTP ${response.status}).`
      );
    }
  }

  const root = asObject(json);
  const apiError = asObject(root?.error);

  if (
    !response.ok ||
    root?.success === false
  ) {
    throw new Error(
      getString(
        apiError,
        'message',
        'detail'
      ) ??
      getString(
        root,
        'message',
        'detail'
      ) ??
      `Yêu cầu thất bại (HTTP ${response.status}).`
    );
  }

  return unwrap(json);
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>
        {label}
      </Text>

      <Text style={styles.infoValue}>
        {value || 'Chưa cập nhật'}
      </Text>
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();

  const {
    user,
    status,
    getAccessToken,
    syncUser,
  } = useAuth();

  const authenticated =
    status === 'authenticated' &&
    user !== null;

  const [profile, setProfile] =
    useState<Profile | null>(null);

  const [managedShops, setManagedShops] =
    useState<ManagedShop[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [loadingShops, setLoadingShops] =
    useState(false);

  const [shopError, setShopError] =
    useState('');

  const [saving, setSaving] =
    useState(false);

  const [uploading, setUploading] =
    useState(false);

  const [editing, setEditing] =
    useState(false);

  const [fullName, setFullName] =
    useState('');

  const [phone, setPhone] =
    useState('');

  const [
    selectedAvatar,
    setSelectedAvatar,
  ] = useState<SelectedAvatar | null>(
    null
  );

  const [
    uploadedPreview,
    setUploadedPreview,
  ] = useState<string | null>(null);

  const [
    confirmSave,
    setConfirmSave,
  ] = useState(false);

  const [error, setError] =
    useState('');

  const [notice, setNotice] =
    useState('');

  const apiRequest = useCallback(
    async (
      path: string,
      options?: {
        method?: 'GET' | 'PATCH';
        body?: unknown;
      }
    ): Promise<unknown> => {
      const token =
        await getAccessToken();

      if (!token) {
        throw new Error(
          'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
        );
      }

      const headers: Record<
        string,
        string
      > = {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      };

      if (options?.body !== undefined) {
        headers['Content-Type'] =
          'application/json';
      }

      const response = await fetch(
        `${
          ENV.apiUrl.replace(/\/+$/, '')
        }${path}`,
        {
          method:
            options?.method ?? 'GET',
          headers,
          body:
            options?.body !== undefined
              ? JSON.stringify(
                  options.body
                )
              : undefined,
        }
      );

      return readApiResponse(
        response
      );
    },
    [getAccessToken]
  );

  const loadProfile = useCallback(
    async (): Promise<void> => {
      if (!authenticated) {
        setProfile(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const data =
          await apiRequest(
            '/api/me/profile'
          );

        const normalized =
          normalizeProfile(data);

        if (!normalized) {
          throw new Error(
            'Không nhận diện được hồ sơ từ Backend.'
          );
        }

        setProfile(normalized);
        setFullName(
          normalized.fullName
        );
        setPhone(
          normalized.phone
        );
      } catch (caught: unknown) {
        setError(
          errorMessage(
            caught,
            'Không thể tải hồ sơ cá nhân.'
          )
        );
      } finally {
        setLoading(false);
      }
    },
    [
      apiRequest,
      authenticated,
    ]
  );

  const loadManagedShops =
    useCallback(
      async (): Promise<void> => {
        if (!authenticated) {
          setManagedShops([]);
          setLoadingShops(false);
          setShopError('');
          return;
        }

        setLoadingShops(true);
        setShopError('');

        try {
          const data =
            await apiRequest(
              '/api/me/managed-shops'
            );

          const list =
            findList(data);

          if (list === null) {
            throw new Error(
              'Không nhận diện được danh sách cửa hàng từ Backend.'
            );
          }

          const normalized = list
            .map(
              normalizeManagedShop
            )
            .filter(
              (
                shop
              ): shop is ManagedShop =>
                shop !== null
            );

          setManagedShops(
            normalized
          );
        } catch (
          caught: unknown
        ) {
          setManagedShops([]);

          setShopError(
            errorMessage(
              caught,
              'Không thể tải quyền quản lý cửa hàng.'
            )
          );
        } finally {
          setLoadingShops(false);
        }
      },
      [
        apiRequest,
        authenticated,
      ]
    );

  useEffect(() => {
    if (status === 'loading') {
      return;
    }

    void loadProfile();
    void loadManagedShops();
  }, [
    status,
    loadProfile,
    loadManagedShops,
  ]);

  const cleanName =
    fullName.trim();

  const cleanPhone =
    phone.trim();

  const nameValid =
    cleanName.length >= 2 &&
    cleanName.length <= 150;

  const phoneValid =
    /^[0-9]{10,11}$/.test(
      cleanPhone
    );

  const changed =
    profile !== null &&
    (
      cleanName !==
        profile.fullName ||
      cleanPhone !==
        profile.phone
    );

  const canSave =
    profile !== null &&
    nameValid &&
    phoneValid &&
    changed &&
    !saving &&
    !uploading;

  const cancelEdit = () => {
    if (saving) return;

    setFullName(
      profile?.fullName ?? ''
    );

    setPhone(
      profile?.phone ?? ''
    );

    setEditing(false);
    setConfirmSave(false);
    setError('');
  };

  const saveProfile = async () => {
    if (!canSave) return;

    setConfirmSave(false);
    setSaving(true);
    setError('');
    setNotice('');

    let patchSucceeded = false;

    try {
      await apiRequest(
        '/api/me/profile',
        {
          method: 'PATCH',
          body: {
            fullName: cleanName,
            phone: cleanPhone,
          },
        }
      );

      patchSucceeded = true;

      const updated =
        await apiRequest(
          '/api/me/profile'
        );

      const normalized =
        normalizeProfile(
          updated
        );

      if (!normalized) {
        throw new Error(
          'Backend đã nhận cập nhật nhưng không trả về hồ sơ hợp lệ khi đọc lại.'
        );
      }

      setProfile(normalized);
      setFullName(
        normalized.fullName
      );
      setPhone(
        normalized.phone
      );

      setEditing(false);

      let synced = false;

      try {
        synced =
          await syncUser();
      } catch {
        synced = false;
      }

      setNotice(
        synced
          ? 'Đã cập nhật hồ sơ và đồng bộ tên trên Header.'
          : 'Đã cập nhật hồ sơ. Header chưa đồng bộ được; hãy làm mới trang nếu cần.'
      );
    } catch (
      caught: unknown
    ) {
      setError(
        patchSucceeded
          ? 'Backend đã nhận cập nhật nhưng chưa xác minh được dữ liệu mới: ' +
              errorMessage(
                caught,
                'Lỗi không xác định.'
              )
          : errorMessage(
              caught,
              'Không thể cập nhật hồ sơ.'
            )
      );
    } finally {
      setSaving(false);
    }
  };

  const chooseAvatar =
    async () => {
      if (
        uploading ||
        saving
      ) {
        return;
      }

      setError('');
      setNotice('');

      try {
        const result =
          await ImagePicker.launchImageLibraryAsync(
            {
              mediaTypes: [
                'images',
              ],
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.8,
            }
          );

        if (result.canceled) {
          return;
        }

        const asset =
          result.assets[0];

        if (!asset) {
          return;
        }

        setSelectedAvatar({
          uri: asset.uri,
          fileName:
            asset.fileName ??
            `avatar-${Date.now()}.jpg`,
          mimeType:
            asset.mimeType ??
            'image/jpeg',
          file:
            asset.file ??
            undefined,
        });
      } catch (
        caught: unknown
      ) {
        setError(
          errorMessage(
            caught,
            'Không thể chọn ảnh đại diện.'
          )
        );
      }
    };

  const uploadAvatar =
    async () => {
      if (
        !selectedAvatar ||
        uploading ||
        saving
      ) {
        return;
      }

      const avatar =
        selectedAvatar;

      setUploading(true);
      setError('');
      setNotice('');

      try {
        const token =
          await getAccessToken();

        if (!token) {
          throw new Error(
            'Phiên đăng nhập đã hết hạn.'
          );
        }

        const form =
          new FormData();

        if (
          Platform.OS ===
          'web'
        ) {
          let blob: Blob;

          if (avatar.file) {
            blob = avatar.file;
          } else {
            const imageResponse =
              await fetch(
                avatar.uri
              );

            if (
              !imageResponse.ok
            ) {
              throw new Error(
                'Không thể đọc ảnh từ thiết bị.'
              );
            }

            blob =
              await imageResponse.blob();
          }

          form.append(
            'File',
            blob,
            avatar.fileName
          );
        } else {
          form.append(
            'File',
            {
              uri:
                avatar.uri,
              name:
                avatar.fileName,
              type:
                avatar.mimeType,
            } as unknown as Blob
          );
        }

        const response =
          await fetch(
            `${
              ENV.apiUrl.replace(
                /\/+$/,
                ''
              )
            }/api/me/avatar`,
            {
              method: 'POST',
              headers: {
                Accept:
                  'application/json',
                Authorization:
                  `Bearer ${token}`,
              },
              body: form,
            }
          );

        await readApiResponse(
          response
        );

        setUploadedPreview(
          avatar.uri
        );

        setSelectedAvatar(
          null
        );

        try {
          const data =
            await apiRequest(
              '/api/me/profile'
            );

          const updated =
            normalizeProfile(
              data
            );

          if (updated) {
            setProfile(
              updated
            );
          }
        } catch {
          // Upload thành công;
          // có thể đọc lại sau.
        }

        setNotice(
          'Backend đã chấp nhận ảnh đại diện. Hãy làm mới trang để kiểm tra ảnh được lưu và hiển thị lại.'
        );
      } catch (
        caught: unknown
      ) {
        setError(
          errorMessage(
            caught,
            'Không thể cập nhật ảnh đại diện.'
          )
        );
      } finally {
        setUploading(false);
      }
    };

  const avatarSource =
    selectedAvatar?.uri ??
    uploadedPreview ??
    resolveAvatarUrl(
      profile?.avatarUrl ??
        null
    );

  const displayName =
    profile?.fullName ||
    user?.fullName ||
    'Người dùng SaviBite';

  const initial =
    displayName
      .trim()
      .charAt(0)
      .toUpperCase() ||
    'U';

  const systemRole =
    profile?.systemRole ??
    user?.systemRole ??
    'USER';

  const primaryShopRole =
    managedShops.some(
      (shop) =>
        shop.role === 'OWNER'
    )
      ? 'OWNER'
      : managedShops.some(
          (shop) =>
            shop.role ===
            'MANAGER'
        )
        ? 'MANAGER'
        : managedShops.some(
            (shop) =>
              shop.role ===
              'STAFF'
          )
          ? 'STAFF'
          : null;

  const displayRole =
    systemRole.toUpperCase() ===
    'ADMIN'
      ? 'Quản trị viên'
      : primaryShopRole
        ? roleLabel(
            primaryShopRole
          )
        : 'Người dùng';

  if (
    status === 'loading'
  ) {
    return (
      <CustomerLayout>
        <ScreenContainer
          style={styles.center}
        >
          <ActivityIndicator
            size="large"
            color={C.primary}
          />
        </ScreenContainer>
      </CustomerLayout>
    );
  }

  if (!authenticated) {
    return (
      <CustomerLayout>
        <ScreenContainer
          style={styles.center}
        >
          <Ionicons
            name="person-circle-outline"
            size={48}
            color={C.primary}
          />

          <Text
            style={styles.title}
          >
            Đăng nhập để xem hồ sơ
          </Text>

          <Pressable
            style={
              styles.primaryButton
            }
            onPress={() =>
              router.replace(
                '/login'
              )
            }
          >
            <Text
              style={
                styles.primaryText
              }
            >
              Đăng nhập
            </Text>
          </Pressable>
        </ScreenContainer>
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout>
      <ScreenContainer
        style={styles.page}
      >
        <Pressable
          style={styles.backLink}
          onPress={() =>
            router.push('/')
          }
        >
          <Ionicons
            name="arrow-back"
            size={18}
            color={C.primary}
          />

          <Text
            style={styles.linkText}
          >
            Quay lại trang chủ
          </Text>
        </Pressable>

        <View
          style={styles.heading}
        >
          <Text
            style={styles.eyebrow}
          >
            SAVIBITE · MY PROFILE
          </Text>

          <Text
            style={styles.title}
          >
            Hồ sơ cá nhân
          </Text>

          <Text
            style={styles.muted}
          >
            Xem và cập nhật thông tin tài khoản SaviBite.
          </Text>
        </View>

        {!!notice && (
          <View
            style={
              styles.successBox
            }
          >
            <Ionicons
              name="checkmark-circle-outline"
              size={20}
              color={C.success}
            />

            <Text
              style={
                styles.successText
              }
            >
              {notice}
            </Text>
          </View>
        )}

        {!!error && (
          <View
            style={styles.errorBox}
          >
            <Text
              style={styles.errorText}
            >
              {error}
            </Text>
          </View>
        )}

        {loading ? (
          <View
            style={styles.center}
          >
            <ActivityIndicator
              size="large"
              color={C.primary}
            />

            <Text
              style={styles.muted}
            >
              Đang tải hồ sơ...
            </Text>
          </View>
        ) : !profile ? (
          <View
            style={styles.panel}
          >
            <Text
              style={
                styles.sectionTitle
              }
            >
              Chưa tải được hồ sơ
            </Text>

            <Pressable
              style={
                styles.outlineButton
              }
              onPress={() =>
                void loadProfile()
              }
            >
              <Text
                style={
                  styles.outlineText
                }
              >
                Thử lại
              </Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* THÔNG TIN TỔNG QUAN */}
            <View
              style={
                styles.profileCard
              }
            >
              <View
                style={
                  styles.avatarWrap
                }
              >
                {avatarSource ? (
                  <Image
                    source={{
                      uri:
                        avatarSource,
                    }}
                    style={
                      styles.avatarImage
                    }
                    resizeMode="cover"
                  />
                ) : (
                  <Text
                    style={
                      styles.avatarInitial
                    }
                  >
                    {initial}
                  </Text>
                )}
              </View>

              <View
                style={
                  styles.profileIdentity
                }
              >
                <Text
                  style={
                    styles.profileName
                  }
                >
                  {profile.fullName}
                </Text>

                <Text
                  style={
                    styles.muted
                  }
                >
                  {profile.email}
                </Text>

                <View
                  style={
                    styles.rolePill
                  }
                >
                  <Ionicons
                    name={
                      primaryShopRole
                        ? 'storefront-outline'
                        : 'shield-checkmark-outline'
                    }
                    size={15}
                    color={
                      C.primary
                    }
                  />

                  <Text
                    style={
                      styles.roleText
                    }
                  >
                    {loadingShops
                      ? 'Đang tải vai trò...'
                      : displayRole}
                  </Text>
                </View>
              </View>
            </View>

            {/* VAI TRÒ VÀ CỬA HÀNG */}
            <View
              style={styles.panel}
            >
              <View
                style={
                  styles.panelHeading
                }
              >
                <View
                  style={
                    styles.flex
                  }
                >
                  <Text
                    style={
                      styles.sectionTitle
                    }
                  >
                    Vai trò và quyền cửa hàng
                  </Text>

                  <Text
                    style={
                      styles.muted
                    }
                  >
                    Quyền được đồng bộ từ hệ thống SaviBite.
                  </Text>
                </View>

                <Pressable
                  style={
                    styles.outlineButton
                  }
                  disabled={
                    loadingShops
                  }
                  onPress={() =>
                    void loadManagedShops()
                  }
                >
                  <Ionicons
                    name="refresh-outline"
                    size={17}
                    color={
                      C.primary
                    }
                  />

                  <Text
                    style={
                      styles.outlineText
                    }
                  >
                    Làm mới quyền
                  </Text>
                </Pressable>
              </View>

              <View
                style={
                  styles.infoPanel
                }
              >
                <InfoRow
                  label="Vai trò hệ thống"
                  value={roleLabel(
                    profile.systemRole
                  )}
                />

                <InfoRow
                  label="Vai trò hiển thị"
                  value={
                    loadingShops
                      ? 'Đang kiểm tra...'
                      : displayRole
                  }
                />

                <InfoRow
                  label="Trạng thái tài khoản"
                  value={statusLabel(
                    profile.status
                  )}
                />
              </View>

              {loadingShops ? (
                <View
                  style={
                    styles.loadingRow
                  }
                >
                  <ActivityIndicator
                    color={
                      C.primary
                    }
                    size="small"
                  />

                  <Text
                    style={
                      styles.muted
                    }
                  >
                    Đang tải quyền quản lý cửa hàng...
                  </Text>
                </View>
              ) : !!shopError ? (
                <View
                  style={
                    styles.errorBox
                  }
                >
                  <Text
                    style={
                      styles.errorText
                    }
                  >
                    Không thể xác minh quyền cửa hàng: {shopError}
                  </Text>
                </View>
              ) : managedShops.length >
                0 ? (
                <View
                  style={
                    styles.shopsList
                  }
                >
                  {managedShops.map(
                    (
                      shop,
                      index
                    ) => (
                      <View
                        key={`${
                          shop.id
                        }-${index}`}
                        style={
                          styles.shopCard
                        }
                      >
                        <View
                          style={
                            styles.shopIcon
                          }
                        >
                          <Ionicons
                            name="storefront-outline"
                            size={22}
                            color={
                              C.primary
                            }
                          />
                        </View>

                        <View
                          style={
                            styles.shopDetails
                          }
                        >
                          <Text
                            style={
                              styles.shopName
                            }
                          >
                            {shop.name}
                          </Text>

                          <Text
                            style={
                              styles.shopSubtitle
                            }
                          >
                            {roleLabel(
                              shop.role
                            )}
                          </Text>

                          <Text
                            style={
                              styles.shopStatus
                            }
                          >
                            {statusLabel(
                              shop.status
                            )}
                          </Text>
                        </View>
                      </View>
                    )
                  )}
                </View>
              ) : (
                <Text
                  style={
                    styles.muted
                  }
                >
                  Tài khoản chưa có quyền quản lý cửa hàng đang hoạt động.
                </Text>
              )}

              {managedShops.length >
                0 && (
                <Pressable
                  style={
                    styles.primaryButton
                  }
                  onPress={() =>
                    router.push(
                      '/shop-orders'
                    )
                  }
                >
                  <Ionicons
                    name="storefront-outline"
                    size={18}
                    color={
                      C.surface
                    }
                  />

                  <Text
                    style={
                      styles.primaryText
                    }
                  >
                    Đến trang quản lý cửa hàng
                  </Text>
                </Pressable>
              )}
            </View>

            {/* THÔNG TIN CÁ NHÂN */}
            <View
              style={styles.panel}
            >
              <View
                style={
                  styles.panelHeading
                }
              >
                <View
                  style={
                    styles.flex
                  }
                >
                  <Text
                    style={
                      styles.sectionTitle
                    }
                  >
                    Thông tin cá nhân
                  </Text>

                  <Text
                    style={
                      styles.muted
                    }
                  >
                    Cập nhật họ tên và số điện thoại.
                  </Text>
                </View>

                {!editing && (
                  <Pressable
                    style={
                      styles.outlineButton
                    }
                    onPress={() => {
                      setError(
                        ''
                      );
                      setNotice(
                        ''
                      );
                      setEditing(
                        true
                      );
                    }}
                  >
                    <Ionicons
                      name="create-outline"
                      size={17}
                      color={
                        C.primary
                      }
                    />

                    <Text
                      style={
                        styles.outlineText
                      }
                    >
                      Chỉnh sửa
                    </Text>
                  </Pressable>
                )}
              </View>

              {!editing ? (
                <View
                  style={
                    styles.infoPanel
                  }
                >
                  <InfoRow
                    label="Họ và tên"
                    value={
                      profile.fullName
                    }
                  />

                  <InfoRow
                    label="Email"
                    value={
                      profile.email
                    }
                  />

                  <InfoRow
                    label="Số điện thoại"
                    value={
                      profile.phone
                    }
                  />

                  <InfoRow
                    label="Vai trò hệ thống"
                    value={roleLabel(
                      profile.systemRole
                    )}
                  />

                  <InfoRow
                    label="Trạng thái"
                    value={statusLabel(
                      profile.status
                    )}
                  />
                </View>
              ) : (
                <View
                  style={
                    styles.form
                  }
                >
                  <View
                    style={
                      styles.field
                    }
                  >
                    <Text
                      style={
                        styles.label
                      }
                    >
                      Họ và tên *
                    </Text>

                    <TextInput
                      style={
                        styles.input
                      }
                      value={
                        fullName
                      }
                      onChangeText={
                        setFullName
                      }
                      editable={
                        !saving
                      }
                      maxLength={
                        150
                      }
                      placeholder="Nhập họ và tên"
                      placeholderTextColor={
                        C.muted
                      }
                    />

                    <Text
                      style={
                        styles.hint
                      }
                    >
                      Tối thiểu 2 ký tự.
                    </Text>
                  </View>

                  <View
                    style={
                      styles.field
                    }
                  >
                    <Text
                      style={
                        styles.label
                      }
                    >
                      Số điện thoại *
                    </Text>

                    <TextInput
                      style={
                        styles.input
                      }
                      value={
                        phone
                      }
                      onChangeText={
                        setPhone
                      }
                      editable={
                        !saving
                      }
                      keyboardType="phone-pad"
                      maxLength={
                        11
                      }
                      placeholder="Nhập số điện thoại"
                      placeholderTextColor={
                        C.muted
                      }
                    />

                    <Text
                      style={
                        styles.hint
                      }
                    >
                      Nhập 10–11 chữ số.
                    </Text>
                  </View>

                  <View
                    style={
                      styles.field
                    }
                  >
                    <Text
                      style={
                        styles.label
                      }
                    >
                      Email
                    </Text>

                    <View
                      style={
                        styles.readonlyBox
                      }
                    >
                      <Text
                        style={
                          styles.readonlyText
                        }
                      >
                        {profile.email}
                      </Text>
                    </View>

                    <Text
                      style={
                        styles.hint
                      }
                    >
                      Backend hiện chưa hỗ trợ sửa email.
                    </Text>
                  </View>

                  <View
                    style={
                      styles.actions
                    }
                  >
                    <Pressable
                      style={
                        styles.outlineButton
                      }
                      disabled={
                        saving
                      }
                      onPress={
                        cancelEdit
                      }
                    >
                      <Text
                        style={
                          styles.outlineText
                        }
                      >
                        Hủy
                      </Text>
                    </Pressable>

                    <Pressable
                      style={[
                        styles.primaryButton,
                        !canSave &&
                          styles.disabled,
                      ]}
                      disabled={
                        !canSave
                      }
                      onPress={() =>
                        setConfirmSave(
                          true
                        )
                      }
                    >
                      <Ionicons
                        name="save-outline"
                        size={17}
                        color={
                          C.surface
                        }
                      />

                      <Text
                        style={
                          styles.primaryText
                        }
                      >
                        Lưu thay đổi
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>

            {/* ẢNH ĐẠI DIỆN */}
            <View
              style={styles.panel}
            >
              <Text
                style={
                  styles.sectionTitle
                }
              >
                Ảnh đại diện
              </Text>

              <Text
                style={
                  styles.muted
                }
              >
                Chọn ảnh từ thiết bị để cập nhật avatar.
              </Text>

              <View
                style={
                  styles.avatarSection
                }
              >
                <View
                  style={
                    styles.avatarWrap
                  }
                >
                  {avatarSource ? (
                    <Image
                      source={{
                        uri:
                          avatarSource,
                      }}
                      style={
                        styles.avatarImage
                      }
                      resizeMode="cover"
                    />
                  ) : (
                    <Text
                      style={
                        styles.avatarInitial
                      }
                    >
                      {initial}
                    </Text>
                  )}
                </View>

                <View
                  style={
                    styles.avatarActions
                  }
                >
                  <Pressable
                    style={
                      styles.outlineButton
                    }
                    disabled={
                      uploading ||
                      saving
                    }
                    onPress={() =>
                      void chooseAvatar()
                    }
                  >
                    <Ionicons
                      name="image-outline"
                      size={18}
                      color={
                        C.primary
                      }
                    />

                    <Text
                      style={
                        styles.outlineText
                      }
                    >
                      Chọn ảnh
                    </Text>
                  </Pressable>

                  {selectedAvatar && (
                    <>
                      <Pressable
                        style={[
                          styles.primaryButton,
                          uploading &&
                            styles.disabled,
                        ]}
                        disabled={
                          uploading
                        }
                        onPress={() =>
                          void uploadAvatar()
                        }
                      >
                        {uploading ? (
                          <ActivityIndicator
                            color={
                              C.surface
                            }
                            size="small"
                          />
                        ) : (
                          <Ionicons
                            name="cloud-upload-outline"
                            size={18}
                            color={
                              C.surface
                            }
                          />
                        )}

                        <Text
                          style={
                            styles.primaryText
                          }
                        >
                          {uploading
                            ? 'Đang tải ảnh...'
                            : 'Lưu ảnh đại diện'}
                        </Text>
                      </Pressable>

                      <Pressable
                        style={
                          styles.outlineButton
                        }
                        disabled={
                          uploading
                        }
                        onPress={() =>
                          setSelectedAvatar(
                            null
                          )
                        }
                      >
                        <Text
                          style={
                            styles.outlineText
                          }
                        >
                          Bỏ chọn
                        </Text>
                      </Pressable>
                    </>
                  )}
                </View>
              </View>

              <Text
                style={
                  styles.hint
                }
              >
                Ảnh được chọn chỉ là bản xem trước cho đến khi bạn nhấn Lưu ảnh đại diện.
              </Text>
            </View>

            {/* LÀM MỚI */}
            <View
              style={
                styles.bottomActions
              }
            >
              <Pressable
                style={
                  styles.outlineButton
                }
                disabled={
                  saving ||
                  uploading
                }
                onPress={() => {
                  setUploadedPreview(
                    null
                  );
                  setSelectedAvatar(
                    null
                  );
                  void loadProfile();
                  void loadManagedShops();
                }}
              >
                <Ionicons
                  name="refresh-outline"
                  size={17}
                  color={
                    C.primary
                  }
                />

                <Text
                  style={
                    styles.outlineText
                  }
                >
                  Làm mới hồ sơ
                </Text>
              </Pressable>
            </View>
          </>
        )}
      </ScreenContainer>

      {/* XÁC NHẬN CẬP NHẬT */}
      <Modal
        visible={
          confirmSave
        }
        transparent
        animationType="fade"
        onRequestClose={() =>
          setConfirmSave(
            false
          )
        }
      >
        <View
          style={
            styles.backdrop
          }
        >
          <View
            style={
              styles.confirmPanel
            }
          >
            <Text
              style={
                styles.sectionTitle
              }
            >
              Xác nhận cập nhật hồ sơ
            </Text>

            <Text
              style={
                styles.muted
              }
            >
              Thông tin mới sẽ được lưu vào Backend.
            </Text>

            <InfoRow
              label="Họ và tên"
              value={
                cleanName
              }
            />

            <InfoRow
              label="Số điện thoại"
              value={
                cleanPhone
              }
            />

            <View
              style={
                styles.actions
              }
            >
              <Pressable
                style={
                  styles.outlineButton
                }
                disabled={
                  saving
                }
                onPress={() =>
                  setConfirmSave(
                    false
                  )
                }
              >
                <Text
                  style={
                    styles.outlineText
                  }
                >
                  Quay lại
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.primaryButton,
                  !canSave &&
                    styles.disabled,
                ]}
                disabled={
                  !canSave
                }
                onPress={() =>
                  void saveProfile()
                }
              >
                <Text
                  style={
                    styles.primaryText
                  }
                >
                  Xác nhận lưu
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </CustomerLayout>
  );
}


