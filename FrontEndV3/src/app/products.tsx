
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
    useWindowDimensions,
} from 'react-native';

import { ENV } from '../config/env';
import { useAuth } from '../features/auth/context/AuthProvider';
import CustomerLayout from '../shared/components/layout/CustomerLayout';
import ScreenContainer from '../shared/components/layout/ScreenContainer';
import AppButton from '../shared/components/ui/AppButton';
import { colors, radius, spacing } from '../shared/theme';

type Obj = Record<string, unknown>;
type Status = 'ACTIVE' | 'INACTIVE';

type Shop = {
  id: string;
  name: string;
  role: string;
};

type Category = {
  id: string;
  name: string;
};

type Product = {
  id: string;
  name: string;
  categoryId: string;
  description: string;
  ingredients: string;
  allergyInfo: string;
  storageInstruction: string;
  originalPrice: number;
  status: Status;
  imageUrl: string | null;
};

type ProductForm = Omit<Product, 'id' | 'imageUrl'>;

type SelectedImage = {
  uri: string;
  fileName: string;
  mimeType: string;
  fileSize: number | null;
  file?: File;
};

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

function emptyForm(): ProductForm {
  return {
    name: '',
    categoryId: '',
    description: '',
    ingredients: '',
    allergyInfo: '',
    storageInstruction: '',
    originalPrice: 0,
    status: 'ACTIVE',
  };
}

function obj(value: unknown): Obj | null {
  return value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
    ? value as Obj
    : null;
}

function str(value: unknown, ...keys: string[]): string {
  const source = obj(value);

  for (const key of keys) {
    const item = source?.[key];

    if (typeof item === 'string' && item.trim()) {
      return item.trim();
    }
  }

  return '';
}

function numberOf(value: unknown, ...keys: string[]): number {
  const source = obj(value);

  for (const key of keys) {
    const item = source?.[key];

    if (typeof item === 'number' && Number.isFinite(item)) {
      return item;
    }
  }

  return 0;
}

function findList(value: unknown, depth = 0): unknown[] | null {
  if (Array.isArray(value)) return value;

  if (depth >= 5) return null;

  const source = obj(value);
  if (!source) return null;

  for (const key of [
    'data',
    'items',
    'products',
    'categories',
    'shops',
    'managedShops',
    'results',
  ]) {
    if (!(key in source)) continue;

    const result = findList(source[key], depth + 1);

    if (result !== null) return result;
  }

  return null;
}

function parseShop(value: unknown): Shop | null {
  const nested = obj(obj(value)?.shop);
  const source = nested ?? value;

  const id =
    str(source, 'id', 'shopId') ||
    str(value, 'shopId');

  const role = (
    str(value, 'memberRole', 'shopRole', 'role') ||
    str(source, 'memberRole', 'shopRole', 'role')
  ).toUpperCase();

  const membershipStatus = str(
    value,
    'membershipStatus',
    'memberStatus'
  ).toUpperCase();

  if (!UUID.test(id)) return null;

  if (!['OWNER', 'STAFF', 'MANAGER'].includes(role)) {
    return null;
  }

  if (
    membershipStatus &&
    !['ACTIVE', 'APPROVED'].includes(membershipStatus)
  ) {
    return null;
  }

  return {
    id,
    role,
    name:
      str(source, 'name', 'shopName') ||
      str(value, 'shopName') ||
      'Cửa hàng',
  };
}

function parseCategory(value: unknown): Category | null {
  const id = str(value, 'id', 'categoryId');

  if (!UUID.test(id)) return null;

  return {
    id,
    name: str(value, 'name', 'categoryName') || id,
  };
}

function resolveImageUrl(value: string): string | null {
  if (!value) return null;

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  if (value.startsWith('/')) {
    return ENV.apiUrl.replace(/\/+$/, '') + value;
  }

  return null;
}

function parseProduct(value: unknown): Product | null {
  const id = str(value, 'id', 'productId');
  if (!UUID.test(id)) return null;

  const category = obj(obj(value)?.category);
  const image = obj(obj(value)?.image);

  const rawImage =
    str(value, 'imageUrl', 'productImageUrl', 'thumbnailUrl') ||
    str(image, 'url', 'imageUrl');

  return {
    id,
    name: str(value, 'name', 'productName') || 'Chưa có tên',
    categoryId:
      str(value, 'categoryId') ||
      str(category, 'id'),
    description: str(value, 'description'),
    ingredients: str(value, 'ingredients'),
    allergyInfo: str(value, 'allergyInfo'),
    storageInstruction: str(value, 'storageInstruction'),
    originalPrice: numberOf(value, 'originalPrice'),
    status:
      str(value, 'status').toUpperCase() === 'ACTIVE'
        ? 'ACTIVE'
        : 'INACTIVE',
    imageUrl: resolveImageUrl(rawImage),
  };
}

function money(value: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
}

function apiError(json: unknown, fallback: string): string {
  const envelope = obj(json);
  const error = obj(envelope?.error);

  const message =
    str(error, 'message') ||
    str(envelope, 'message');

  if (message) return message;

  const validation = obj(envelope?.errors);

  if (validation) {
    const messages: string[] = [];

    for (const value of Object.values(validation)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string') {
            messages.push(item);
          }
        }
      }
    }

    if (messages.length > 0) {
      return messages.join('\n');
    }
  }

  return fallback;
}

async function parseResponse(response: Response): Promise<unknown> {
  const raw = await response.text();

  let json: unknown = null;

  if (raw.trim()) {
    try {
      json = JSON.parse(raw);
    } catch {
      if (!response.ok) {
        throw new Error(
          `Backend trả về HTTP ${response.status}: ${raw.slice(0, 200)}`
        );
      }

      throw new Error('Backend trả về dữ liệu không hợp lệ.');
    }
  }

  if (
    !response.ok ||
    obj(json)?.success === false
  ) {
    throw new Error(
      apiError(
        json,
        `Yêu cầu thất bại (HTTP ${response.status}).`
      )
    );
  }

  return obj(json) && 'data' in obj(json)!
    ? obj(json)!.data
    : json;
}

async function apiRequest(
  path: string,
  token: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
  body?: unknown
): Promise<unknown> {
  let response: Response;

  try {
    response = await fetch(
      `${ENV.apiUrl.replace(/\/+$/, '')}${path}`,
      {
        method,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
          ...(body !== undefined
            ? { 'Content-Type': 'application/json' }
            : {}),
        },
        ...(body !== undefined
          ? { body: JSON.stringify(body) }
          : {}),
      }
    );
  } catch {
    throw new Error(
      method === 'GET'
        ? 'Không thể kết nối Backend.'
        : 'Mất kết nối khi gửi thay đổi. Hãy tải lại danh sách trước khi thử lại.'
    );
  }

  return parseResponse(response);
}

async function uploadImage(
  shopId: string,
  productId: string,
  token: string,
  selected: SelectedImage
): Promise<unknown> {
  const form = new FormData();

  if (Platform.OS === 'web') {
    // Web: gửi File thật để browser tạo multipart boundary.
    if (!selected.file) {
      throw new Error('Không tìm thấy tệp ảnh để upload.');
    }

    form.append('File', selected.file, selected.fileName);
  } else {
    // React Native native: FormData nhận file dạng uri/name/type.
    // TypeScript DOM không mô tả kiểu file đặc thù của React Native.
    form.append('File', {
      uri: selected.uri,
      name: selected.fileName,
      type: selected.mimeType,
    } as unknown as Blob);
  }

  let response: Response;

  try {
    response = await fetch(
      `${ENV.apiUrl.replace(/\/+$/, '')}` +
      `/api/shops/${encodeURIComponent(shopId)}` +
      `/products/${encodeURIComponent(productId)}/image`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
          // KHÔNG đặt Content-Type cho FormData.
        },
        body: form,
      }
    );
  } catch {
    throw new Error(
      'Mất kết nối khi upload. Backend có thể đã nhận ảnh. Hãy làm mới sản phẩm trước khi thử lại.'
    );
  }

  return parseResponse(response);
}

function FormField({
  label,
  value,
  onChangeText,
  multiline,
  numeric,
  maxLength,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  multiline?: boolean;
  numeric?: boolean;
  maxLength?: number;
  placeholder?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        multiline={multiline}
        keyboardType={numeric ? 'numeric' : 'default'}
        maxLength={maxLength}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={[
          styles.input,
          multiline && styles.multilineInput,
        ]}
      />
    </View>
  );
}

export default function ProductsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ shopId?: string }>();
  const { width } = useWindowDimensions();

  const desktop = width >= 900;

  const { status, getAccessToken } = useAuth();

  const [shops, setShops] = useState<Shop[]>([]);
  const [shopId, setShopId] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState<number | null>(null);

  const [loadingShops, setLoadingShops] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [imageError, setImageError] = useState('');
  const [message, setMessage] = useState('');
  const [formatError, setFormatError] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm());
  const [priceText, setPriceText] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [imageTarget, setImageTarget] = useState<Product | null>(null);
  const [selectedImage, setSelectedImage] =
    useState<SelectedImage | null>(null);

  const selectedShop = shops.find((item) => item.id === shopId);

  const loadShops = useCallback(async () => {
    if (status !== 'authenticated') return;

    setLoadingShops(true);
    setError('');

    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Phiên đăng nhập đã hết hạn.');

      const data = await apiRequest(
        '/api/me/managed-shops',
        token
      );

      const list = findList(data);

      if (!list) {
        throw new Error('Không đọc được danh sách cửa hàng.');
      }

      const parsed = list
        .map(parseShop)
        .filter((item): item is Shop => item !== null);

      setShops(parsed);

      setShopId((previous) => {
        if (parsed.some((item) => item.id === previous)) {
          return previous;
        }

        const requested =
          typeof params.shopId === 'string'
            ? params.shopId
            : '';

        return parsed.some((item) => item.id === requested)
          ? requested
          : (parsed[0]?.id ?? '');
      });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Không thể tải cửa hàng.'
      );
    } finally {
      setLoadingShops(false);
    }
  }, [getAccessToken, params.shopId, status]);

  const loadProducts = useCallback(async () => {
    if (!shopId || status !== 'authenticated') return;

    setLoadingProducts(true);
    setError('');
    setFormatError(false);

    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Phiên đăng nhập đã hết hạn.');

      const data = await apiRequest(
        `/api/shops/${encodeURIComponent(shopId)}` +
        `/products?page=${page}&limit=20`,
        token
      );

      const list = findList(data);

      if (!list) {
        setProducts([]);
        setFormatError(true);
        return;
      }

      const parsed = list
        .map(parseProduct)
        .filter((item): item is Product => item !== null);

      setProducts(parsed);
      setFormatError(list.length > 0 && parsed.length === 0);

      const total = obj(data)?.totalPages;

      setTotalPages(
        typeof total === 'number' && Number.isFinite(total)
          ? total
          : null
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Không thể tải sản phẩm.'
      );
    } finally {
      setLoadingProducts(false);
    }
  }, [getAccessToken, page, shopId, status]);

  const loadCategories = useCallback(async () => {
    if (!shopId || status !== 'authenticated') return;

    try {
      const token = await getAccessToken();
      if (!token) return;

      const data = await apiRequest(
        `/api/shops/${encodeURIComponent(shopId)}` +
        '/products/categories',
        token
      );

      setCategories(
        (findList(data) ?? [])
          .map(parseCategory)
          .filter((item): item is Category => item !== null)
      );
    } catch {
      setCategories([]);
    }
  }, [getAccessToken, shopId, status]);

  useEffect(() => {
    if (status === 'authenticated') {
      void loadShops();
    } else {
      setShops([]);
      setShopId('');
      setProducts([]);
    }
  }, [loadShops, status]);

  useEffect(() => {
    setPage(1);
    setProducts([]);
    setTotalPages(null);
    setFormOpen(false);
    setImageTarget(null);
    setSelectedImage(null);
  }, [shopId]);

  useEffect(() => {
    if (shopId) void loadProducts();
  }, [loadProducts, shopId]);

  useEffect(() => {
    if (shopId) void loadCategories();
  }, [loadCategories, shopId]);

  const updateForm = (values: Partial<ProductForm>) => {
    setForm((previous) => ({ ...previous, ...values }));
    setFormError('');
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setPriceText('');
    setFormError('');
    setMessage('');
    setFormOpen(true);
  };

  const openEdit = async (product: Product) => {
    setError('');
    setFormError('');

    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Phiên đăng nhập đã hết hạn.');

      const data = await apiRequest(
        `/api/shops/${encodeURIComponent(shopId)}` +
        `/products/${encodeURIComponent(product.id)}`,
        token
      );

      const source = obj(data);

      const parsed = parseProduct(
        source && 'product' in source
          ? source.product
          : data
      );

      if (!parsed) {
        throw new Error('Không đọc được chi tiết sản phẩm.');
      }

      setEditingId(parsed.id);
      setForm({
        name: parsed.name,
        categoryId: parsed.categoryId,
        description: parsed.description,
        ingredients: parsed.ingredients,
        allergyInfo: parsed.allergyInfo,
        storageInstruction: parsed.storageInstruction,
        originalPrice: parsed.originalPrice,
        status: parsed.status,
      });
      setPriceText(String(parsed.originalPrice));
      setFormOpen(true);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Không thể mở sản phẩm.'
      );
    }
  };

  const saveProduct = async () => {
    if (saving || !selectedShop) return;

    const name = form.name.trim();
    const price = Number(priceText);

    if (!name || name.length > 150) {
      setFormError('Tên sản phẩm phải có từ 1 đến 150 ký tự.');
      return;
    }

    if (!UUID.test(form.categoryId)) {
      setFormError('Vui lòng chọn danh mục hợp lệ.');
      return;
    }

    if (
      !priceText.trim() ||
      !Number.isFinite(price) ||
      price < 0
    ) {
      setFormError('Giá gốc phải là số hợp lệ, không âm.');
      return;
    }

    setSaving(true);
    setFormError('');
    setError('');
    setMessage('');

    const body = {
      categoryId: form.categoryId,
      name,
      description: form.description.trim() || null,
      ingredients: form.ingredients.trim() || null,
      allergyInfo: form.allergyInfo.trim() || null,
      storageInstruction:
        form.storageInstruction.trim() || null,
      originalPrice: price,
      status: form.status,
    };

    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Phiên đăng nhập đã hết hạn.');

      const base =
        `/api/shops/${encodeURIComponent(shopId)}/products`;

      if (editingId) {
        await apiRequest(
          `${base}/${encodeURIComponent(editingId)}`,
          token,
          'PATCH',
          body
        );
      } else {
        await apiRequest(base, token, 'POST', body);
      }

      setMessage(
        editingId
          ? 'Đã cập nhật sản phẩm thành công.'
          : 'Đã thêm sản phẩm thành công.'
      );

      setFormOpen(false);
      setEditingId(null);

      if (page !== 1) {
        setPage(1);
      } else {
        await loadProducts();
      }
    } catch (caught) {
      setFormError(
        caught instanceof Error
          ? caught.message
          : 'Không thể lưu sản phẩm.'
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteProduct = async () => {
    if (!deleteTarget || deleting) return;

    setDeleting(true);
    setError('');
    setMessage('');

    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Phiên đăng nhập đã hết hạn.');

      await apiRequest(
        `/api/shops/${encodeURIComponent(shopId)}` +
        `/products/${encodeURIComponent(deleteTarget.id)}`,
        token,
        'DELETE'
      );

      setDeleteTarget(null);
      setMessage('Đã xóa sản phẩm thành công.');
      await loadProducts();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Không thể xóa sản phẩm.'
      );
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const openImageModal = (product: Product) => {
    setImageTarget(product);
    setSelectedImage(null);
    setImageError('');
    setMessage('');
  };

  const pickImage = async () => {
    setImageError('');

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
        allowsMultipleSelection: false,
      });

      if (result.canceled || !result.assets.length) {
        return;
      }

      const asset = result.assets[0];

      const mimeType =
        asset.mimeType ??
        (
          asset.fileName?.toLowerCase().endsWith('.png')
            ? 'image/png'
            : asset.fileName?.toLowerCase().endsWith('.webp')
              ? 'image/webp'
              : 'image/jpeg'
        );

      if (
        ![
          'image/jpeg',
          'image/png',
          'image/webp',
        ].includes(mimeType)
      ) {
        setImageError('Chỉ hỗ trợ chọn ảnh JPG, PNG hoặc WebP.');
        return;
      }

      if (
        typeof asset.fileSize === 'number' &&
        asset.fileSize > MAX_IMAGE_SIZE
      ) {
        setImageError('Vui lòng chọn ảnh nhỏ hơn hoặc bằng 5 MB.');
        return;
      }

      const fileName =
        asset.fileName ??
        `savibite-product-${Date.now()}.${mimeType.split('/')[1]}`;

      const webFile =
        Platform.OS === 'web'
          ? asset.file
          : undefined;

      setSelectedImage({
        uri: asset.uri,
        fileName,
        mimeType,
        fileSize: asset.fileSize ?? null,
        file: webFile,
      });
    } catch (caught) {
      setImageError(
        caught instanceof Error
          ? caught.message
          : 'Không thể chọn ảnh.'
      );
    }
  };

  const submitImage = async () => {
    if (
      !imageTarget ||
      !selectedImage ||
      uploading ||
      !shopId
    ) {
      return;
    }

    setUploading(true);
    setImageError('');

    try {
      const token = await getAccessToken();

      if (!token) {
        throw new Error('Phiên đăng nhập đã hết hạn.');
      }

      const result = await uploadImage(
        shopId,
        imageTarget.id,
        token,
        selectedImage
      );

      // Nếu Backend trả imageUrl, cập nhật thẻ ngay.
      // Dù không trả URL, danh sách vẫn được tải lại.
      const data = obj(result);
      const imageData = obj(data?.image);

      const returnedUrl = resolveImageUrl(
        str(data, 'imageUrl', 'url') ||
        str(imageData, 'url', 'imageUrl')
      );

      if (returnedUrl) {
        setProducts((current) =>
          current.map((product) =>
            product.id === imageTarget.id
              ? { ...product, imageUrl: returnedUrl }
              : product
          )
        );
      }

      setMessage(
        'Backend đã ghi nhận upload ảnh thành công.'
      );

      setImageTarget(null);
      setSelectedImage(null);

      await loadProducts();
    } catch (caught) {
      setImageError(
        caught instanceof Error
          ? caught.message
          : 'Không thể upload ảnh.'
      );
    } finally {
      setUploading(false);
    }
  };

  if (status === 'loading' || loadingShops) {
    return (
      <CustomerLayout>
        <ScreenContainer style={styles.center}>
          <ActivityIndicator
            size="large"
            color={colors.primary}
          />
          <Text style={styles.muted}>
            Đang tải tài khoản và cửa hàng...
          </Text>
        </ScreenContainer>
      </CustomerLayout>
    );
  }

  if (status !== 'authenticated') {
    return (
      <CustomerLayout>
        <ScreenContainer style={styles.center}>
          <Text style={styles.title}>
            Đăng nhập để quản lý sản phẩm
          </Text>
          <AppButton
            title="Đăng nhập"
            onPress={() => router.push('/login')}
          />
        </ScreenContainer>
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout>
      <ScreenContainer style={styles.page}>
        <Pressable
          onPress={() => router.push('/shop-orders')}
          style={styles.back}
        >
          <Ionicons
            name="arrow-back"
            size={18}
            color={colors.primary}
          />
          <Text style={styles.linkText}>
            Quay lại Dashboard
          </Text>
        </Pressable>

        <View style={styles.heading}>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>
              SAVIBITE · PRODUCT MANAGEMENT
            </Text>
            <Text style={styles.title}>
              Quản lý sản phẩm
            </Text>
            <Text style={styles.muted}>
              Thêm, chỉnh sửa và quản lý ảnh sản phẩm.
            </Text>
          </View>

          {!!selectedShop && (
            <AppButton
              title="Thêm sản phẩm"
              onPress={openCreate}
            />
          )}
        </View>

        {shops.length > 1 && (
          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>
              Chọn cửa hàng
            </Text>

            <View style={styles.wrap}>
              {shops.map((shop) => (
                <Pressable
                  key={shop.id}
                  onPress={() => setShopId(shop.id)}
                  style={[
                    styles.chip,
                    shopId === shop.id && styles.selectedChip,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      shopId === shop.id &&
                        styles.selectedChipText,
                    ]}
                  >
                    {shop.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {selectedShop && (
          <View style={styles.shopBanner}>
            <Ionicons
              name="storefront-outline"
              size={23}
              color={colors.primary}
            />
            <View style={styles.flex}>
              <Text style={styles.shopName}>
                {selectedShop.name}
              </Text>
              <Text style={styles.muted}>
                Vai trò: {selectedShop.role}
              </Text>
            </View>
          </View>
        )}

        {!!message && (
          <View style={styles.successBox}>
            <Ionicons
              name="checkmark-circle"
              size={21}
              color={colors.eco}
            />
            <Text style={styles.successText}>{message}</Text>
          </View>
        )}

        {!!error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {!selectedShop && !error && (
          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>
              Không có cửa hàng được quản lý
            </Text>
          </View>
        )}

        {selectedShop && (
          <>
            <View style={styles.listHeading}>
              <View style={styles.flex}>
                <Text style={styles.sectionTitle}>
                  Danh sách sản phẩm
                </Text>
                <Text style={styles.muted}>
                  Trang {page}
                  {totalPages !== null
                    ? ` / ${Math.max(1, totalPages)}`
                    : ''}
                  {' · '}{products.length} sản phẩm đang hiển thị
                </Text>
              </View>

              <AppButton
                title="Làm mới"
                variant="outline"
                disabled={loadingProducts}
                onPress={() => void loadProducts()}
              />
            </View>

            {loadingProducts ? (
              <View style={styles.centerSmall}>
                <ActivityIndicator
                  size="large"
                  color={colors.primary}
                />
                <Text style={styles.muted}>
                  Đang tải sản phẩm...
                </Text>
              </View>
            ) : formatError ? (
              <View style={styles.panel}>
                <Text style={styles.muted}>
                  Chưa nhận diện được dữ liệu sản phẩm từ Backend.
                </Text>
              </View>
            ) : products.length === 0 ? (
              <View style={styles.centerSmall}>
                <Ionicons
                  name="cube-outline"
                  size={42}
                  color={colors.textMuted}
                />
                <Text style={styles.sectionTitle}>
                  Chưa có sản phẩm
                </Text>
                <AppButton
                  title="Thêm sản phẩm"
                  onPress={openCreate}
                />
              </View>
            ) : (
              <View style={styles.grid}>
                {products.map((product) => {
                  const category = categories.find(
                    (item) => item.id === product.categoryId
                  );

                  return (
                    <View
                      key={product.id}
                      style={[
                        styles.productCard,
                        desktop && styles.productCardDesktop,
                      ]}
                    >
                      <View style={styles.photoArea}>
                        {product.imageUrl ? (
                          <Image
                            source={{ uri: product.imageUrl }}
                            style={styles.productImage}
                            resizeMode="cover"
                          />
                        ) : (
                          <Ionicons
                            name="fast-food-outline"
                            size={40}
                            color={colors.primary}
                          />
                        )}
                      </View>

                      <View style={styles.productContent}>
                        <View style={styles.productTop}>
                          <Text style={styles.productName}>
                            {product.name}
                          </Text>

                          <View
                            style={[
                              styles.statusBadge,
                              product.status === 'ACTIVE' &&
                                styles.activeBadge,
                            ]}
                          >
                            <Text style={styles.statusText}>
                              {product.status === 'ACTIVE'
                                ? 'Đang hoạt động'
                                : 'Ngừng hoạt động'}
                            </Text>
                          </View>
                        </View>

                        {category && (
                          <Text style={styles.muted}>
                            Danh mục: {category.name}
                          </Text>
                        )}

                        {!!product.description && (
                          <Text
                            numberOfLines={2}
                            style={styles.muted}
                          >
                            {product.description}
                          </Text>
                        )}

                        <Text style={styles.price}>
                          {money(product.originalPrice)}
                        </Text>

                        <View style={styles.cardActions}>
                          <AppButton
                            title={
                              product.imageUrl
                                ? 'Thay ảnh'
                                : 'Thêm ảnh'
                            }
                            variant="secondary"
                            onPress={() => openImageModal(product)}
                          />

                          <AppButton
                            title="Chỉnh sửa"
                            variant="outline"
                            onPress={() => void openEdit(product)}
                          />

                          <AppButton
                            title="Xóa"
                            variant="danger"
                            onPress={() => setDeleteTarget(product)}
                          />
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            <View style={styles.pagination}>
              <AppButton
                title="Trang trước"
                variant="outline"
                disabled={loadingProducts || page <= 1}
                onPress={() => setPage((old) => Math.max(1, old - 1))}
              />

              <Text style={styles.muted}>Trang {page}</Text>

              <AppButton
                title="Trang sau"
                variant="outline"
                disabled={
                  loadingProducts ||
                  (totalPages !== null
                    ? page >= totalPages
                    : products.length < 20)
                }
                onPress={() => setPage((old) => old + 1)}
              />
            </View>
          </>
        )}
      </ScreenContainer>

      {/* Thêm / sửa sản phẩm */}
      <Modal
        visible={formOpen}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!saving) setFormOpen(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalPanel}>
            <View style={styles.modalHeading}>
              <Text style={styles.sectionTitle}>
                {editingId
                  ? 'Chỉnh sửa sản phẩm'
                  : 'Thêm sản phẩm'}
              </Text>
              <Pressable
                disabled={saving}
                onPress={() => setFormOpen(false)}
              >
                <Ionicons
                  name="close"
                  size={24}
                  color={colors.text}
                />
              </Pressable>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.formContent}
            >
              <FormField
                label="Tên sản phẩm *"
                value={form.name}
                maxLength={150}
                onChangeText={(name) => updateForm({ name })}
              />

              <FormField
                label="Giá gốc (VNĐ)"
                value={priceText}
                numeric
                placeholder="Ví dụ: 20000"
                onChangeText={(value) => {
                  setPriceText(value.replace(/[^0-9]/g, ''));
                  setFormError('');
                }}
              />

              <Text style={styles.label}>Trạng thái *</Text>
              <View style={styles.wrap}>
                {(['ACTIVE', 'INACTIVE'] as Status[]).map(
                  (value) => (
                    <Pressable
                      key={value}
                      onPress={() => updateForm({ status: value })}
                      style={[
                        styles.chip,
                        form.status === value && styles.selectedChip,
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          form.status === value &&
                            styles.selectedChipText,
                        ]}
                      >
                        {value === 'ACTIVE'
                          ? 'Đang hoạt động'
                          : 'Ngừng hoạt động'}
                      </Text>
                    </Pressable>
                  )
                )}
              </View>

              <Text style={styles.label}>Danh mục *</Text>
              <View style={styles.wrap}>
                {categories.map((category) => (
                  <Pressable
                    key={category.id}
                    onPress={() =>
                      updateForm({ categoryId: category.id })
                    }
                    style={[
                      styles.chip,
                      form.categoryId === category.id &&
                        styles.selectedChip,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        form.categoryId === category.id &&
                          styles.selectedChipText,
                      ]}
                    >
                      {category.name}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {categories.length === 0 && (
                <Text style={styles.errorText}>
                  Chưa tải được danh mục sản phẩm.
                </Text>
              )}

              <FormField
                label="Mô tả"
                value={form.description}
                multiline
                maxLength={2000}
                onChangeText={(description) =>
                  updateForm({ description })
                }
              />

              <FormField
                label="Thành phần"
                value={form.ingredients}
                multiline
                maxLength={2000}
                onChangeText={(ingredients) =>
                  updateForm({ ingredients })
                }
              />

              <FormField
                label="Thông tin dị ứng"
                value={form.allergyInfo}
                multiline
                maxLength={1000}
                onChangeText={(allergyInfo) =>
                  updateForm({ allergyInfo })
                }
              />

              <FormField
                label="Hướng dẫn bảo quản"
                value={form.storageInstruction}
                multiline
                maxLength={1000}
                onChangeText={(storageInstruction) =>
                  updateForm({ storageInstruction })
                }
              />

              {!!formError && (
                <Text style={styles.errorText}>{formError}</Text>
              )}

              <View style={styles.actions}>
                <AppButton
                  title="Hủy"
                  variant="outline"
                  disabled={saving}
                  onPress={() => setFormOpen(false)}
                />
                <AppButton
                  title={
                    saving
                      ? 'Đang lưu...'
                      : editingId
                        ? 'Lưu thay đổi'
                        : 'Thêm sản phẩm'
                  }
                  disabled={saving}
                  onPress={() => void saveProduct()}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Xác nhận xóa */}
      <Modal
        visible={deleteTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!deleting) setDeleteTarget(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmPanel}>
            <Ionicons
              name="trash-outline"
              size={31}
              color={colors.danger}
            />
            <Text style={styles.sectionTitle}>
              Xác nhận xóa sản phẩm
            </Text>
            <Text style={styles.muted}>
              Bạn muốn xóa sản phẩm {deleteTarget?.name}?
            </Text>

            <View style={styles.actions}>
              <AppButton
                title="Hủy"
                variant="outline"
                disabled={deleting}
                onPress={() => setDeleteTarget(null)}
              />
              <AppButton
                title={deleting ? 'Đang xóa...' : 'Xác nhận xóa'}
                variant="danger"
                disabled={deleting}
                onPress={() => void deleteProduct()}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Chọn và upload ảnh */}
      <Modal
        visible={imageTarget !== null}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!uploading) {
            setImageTarget(null);
            setSelectedImage(null);
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.imageModal}>
            <View style={styles.modalHeading}>
              <View style={styles.flex}>
                <Text style={styles.sectionTitle}>
                  Ảnh sản phẩm
                </Text>
                <Text style={styles.muted}>
                  {imageTarget?.name}
                </Text>
              </View>

              <Pressable
                disabled={uploading}
                onPress={() => {
                  setImageTarget(null);
                  setSelectedImage(null);
                }}
              >
                <Ionicons
                  name="close"
                  size={24}
                  color={colors.text}
                />
              </Pressable>
            </View>

            <View style={styles.preview}>
              {selectedImage?.uri || imageTarget?.imageUrl ? (
                <Image
                  source={{
                    uri: selectedImage?.uri ??
                      imageTarget?.imageUrl ??
                      '',
                  }}
                  style={styles.previewImage}
                  resizeMode="contain"
                />
              ) : (
                <>
                  <Ionicons
                    name="image-outline"
                    size={52}
                    color={colors.textMuted}
                  />
                  <Text style={styles.muted}>
                    Chưa có ảnh để xem trước
                  </Text>
                </>
              )}
            </View>

            {selectedImage && (
              <Text style={styles.muted}>
                {selectedImage.fileName}
                {selectedImage.fileSize !== null
                  ? ` · ${(selectedImage.fileSize / 1024 / 1024).toFixed(2)} MB`
                  : ''}
              </Text>
            )}

            <Text style={styles.muted}>
              Chọn JPG, PNG hoặc WebP. Giao diện giới hạn
              5 MB để thử nghiệm; Backend có thể áp dụng
              giới hạn riêng.
            </Text>

            {!!imageError && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>
                  {imageError}
                </Text>
              </View>
            )}

            <AppButton
              title="Chọn ảnh từ thiết bị"
              variant="outline"
              disabled={uploading}
              fullWidth
              onPress={() => void pickImage()}
            />

            <AppButton
              title={
                uploading
                  ? 'Đang upload ảnh...'
                  : 'Upload ảnh lên Backend'
              }
              disabled={!selectedImage || uploading}
              fullWidth
              onPress={() => void submitImage()}
            />
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
    gap: spacing.xxl,
  },
  center: {
    minHeight: 440,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.lg,
  },
  centerSmall: {
    minHeight: 260,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.sm,
  },
  linkText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.lg,
  },
  flex: {
    flex: 1,
    gap: spacing.xs,
  },
  eyebrow: {
    color: colors.eco,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.3,
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '800',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '800',
  },
  muted: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 21,
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  panel: {
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    gap: spacing.lg,
  },
  shopBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  shopName: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  listHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.lg,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
  },
  selectedChip: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  selectedChipText: {
    color: colors.white,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
  },
  productCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  productCardDesktop: {
    width: '48%',
  },
  photoArea: {
    height: 180,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  productContent: {
    padding: spacing.xl,
    gap: spacing.md,
  },
  productTop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  productName: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  statusBadge: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
  },
  activeBadge: {
    backgroundColor: '#EAF6E4',
  },
  statusText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
  },
  price: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.primary,
  },
  cardActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xl,
    flexWrap: 'wrap',
  },
  field: {
    gap: spacing.sm,
  },
  input: {
    minHeight: 49,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 14,
  },
  multilineInput: {
    minHeight: 88,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalPanel: {
    width: '100%',
    maxWidth: 720,
    maxHeight: '94%',
    backgroundColor: colors.surface,
    padding: spacing.xl,
    borderRadius: radius.md,
    gap: spacing.lg,
  },
  modalHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  formContent: {
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  confirmPanel: {
    width: '100%',
    maxWidth: 440,
    padding: spacing.xxl,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    gap: spacing.lg,
  },
  imageModal: {
    width: '100%',
    maxWidth: 530,
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    gap: spacing.lg,
  },
  preview: {
    height: 260,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: '#EAF6E4',
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  successText: {
    flex: 1,
    color: colors.eco,
    fontWeight: '700',
    fontSize: 13,
  },
  errorBox: {
    padding: spacing.lg,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 21,
  },
});
