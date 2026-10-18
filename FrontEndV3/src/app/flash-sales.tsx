
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

import { ENV } from '../config/env';
import { useAuth } from '../features/auth/context/AuthProvider';
import CustomerLayout from '../shared/components/layout/CustomerLayout';
import ScreenContainer from '../shared/components/layout/ScreenContainer';
import AppButton from '../shared/components/ui/AppButton';
import { colors, radius, spacing } from '../shared/theme';

type Data = Record<string, unknown>;
type EndMode = 'duration' | 'specific';
type TimeKey =
  | 'saleStart'
  | 'saleEnd'
  | 'manualPickupStart'
  | 'manualPickupEnd';

type PickerRequest = {
  field: TimeKey;
  part: 'hour' | 'minute';
};

type Shop = {
  id: string;
  name: string;
  role: string;
};

type Product = {
  id: string;
  name: string;
  originalPrice: number;
};

type Offer = {
  id: string;
  title: string;
  type: string;
  status: string;
  price: number | null;
  quantity: number | null;
  saleEndAt: string;
};

type FormState = {
  productId: string;
  title: string;
  description: string;
  salePrice: string;
  quantity: string;
  saleStart: string;
  saleEnd: string;
  endMode: EndMode;
  durationDays: string;
  durationHours: string;
  autoPickup: boolean;
  pickupDelayMinutes: string;
  pickupDurationHours: string;
  manualPickupStart: string;
  manualPickupEnd: string;
  allergyInfo: string;
  storageInstruction: string;
};

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const HOURS = Array.from(
  { length: 24 },
  (_, index) => String(index).padStart(2, '0')
);

const MINUTES = Array.from(
  { length: 60 },
  (_, index) => String(index).padStart(2, '0')
);

function obj(value: unknown): Data | null {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    return null;
  }

  return value as Data;
}

function str(value: unknown, ...keys: string[]): string {
  const source = obj(value);

  for (const key of keys) {
    const field = source?.[key];

    if (typeof field === 'string' && field.trim()) {
      return field.trim();
    }
  }

  return '';
}

function num(value: unknown, ...keys: string[]): number | null {
  const source = obj(value);

  for (const key of keys) {
    const field = source?.[key];

    if (
      typeof field === 'number' &&
      Number.isFinite(field)
    ) {
      return field;
    }
  }

  return null;
}

function listOf(
  value: unknown,
  depth = 0
): unknown[] | null {
  if (Array.isArray(value)) return value;
  if (depth > 5) return null;

  const source = obj(value);
  if (!source) return null;

  for (const key of [
    'data',
    'items',
    'shops',
    'managedShops',
    'products',
    'offers',
    'results',
  ]) {
    if (!(key in source)) continue;

    const found = listOf(source[key], depth + 1);

    if (found !== null) return found;
  }

  return null;
}

function parseShop(value: unknown): Shop | null {
  const root = obj(value);
  const source = obj(root?.shop) ?? root;

  const id =
    str(source, 'id', 'shopId') ||
    str(root, 'shopId');

  if (!UUID.test(id)) return null;

  const role = (
    str(root, 'memberRole', 'shopRole', 'role') ||
    str(source, 'memberRole', 'shopRole', 'role')
  ).toUpperCase();

  const membershipStatus = str(
    root,
    'membershipStatus',
    'memberStatus'
  ).toUpperCase();

  if (
    role &&
    !['OWNER', 'STAFF', 'MANAGER'].includes(role)
  ) {
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
    name:
      str(source, 'name', 'shopName') ||
      str(root, 'shopName') ||
      'Cửa hàng',
    role: role || 'MEMBER',
  };
}

function parseProduct(value: unknown): Product | null {
  const root = obj(value);
  const source = obj(root?.product) ?? root;

  const id =
    str(source, 'id', 'productId') ||
    str(root, 'productId');

  if (!UUID.test(id)) return null;

  return {
    id,
    name:
      str(source, 'name', 'productName', 'title') ||
      str(root, 'name') ||
      id,
    originalPrice:
      num(source, 'originalPrice', 'price') ??
      num(root, 'originalPrice', 'price') ??
      0,
  };
}

function parseOffer(value: unknown): Offer | null {
  const id = str(value, 'id', 'offerId');

  if (!UUID.test(id)) return null;

  return {
    id,
    title: str(value, 'title', 'name') || id,
    type: str(value, 'type', 'offerType').toUpperCase(),
    status: str(value, 'status', 'offerStatus'),
    price: num(value, 'salePrice'),
    quantity: num(
      value,
      'availableQuantity',
      'remainingQuantity',
      'quantity'
    ),
    saleEndAt: str(value, 'saleEndAt'),
  };
}

function errorText(value: unknown, fallback: string): string {
  const source = obj(value);

  const message =
    str(source?.error, 'message') ||
    str(source, 'message');

  if (message) return message;

  const errors = obj(source?.errors);

  if (errors) {
    const messages: string[] = [];

    Object.values(errors).forEach((entry) => {
      if (Array.isArray(entry)) {
        entry.forEach((item) => {
          if (typeof item === 'string') messages.push(item);
        });
      }
    });

    if (messages.length) return messages.join('\n');
  }

  return fallback;
}

async function api(
  path: string,
  token: string,
  body?: unknown
): Promise<unknown> {
  const method = body === undefined ? 'GET' : 'POST';

  let response: Response;

  try {
    response = await fetch(
      `${ENV.apiUrl.replace(/\/+$/, '')}${path}`,
      {
        method,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
          ...(body === undefined
            ? {}
            : { 'Content-Type': 'application/json' }),
        },
        ...(body === undefined
          ? {}
          : { body: JSON.stringify(body) }),
      }
    );
  } catch {
    throw new Error(
      method === 'POST'
        ? 'Mất kết nối khi tạo Flash Sale. Hãy kiểm tra danh sách trước khi thử lại.'
        : 'Không thể kết nối Backend.'
    );
  }

  const text = await response.text();

  let result: unknown = null;

  if (text.trim()) {
    try {
      result = JSON.parse(text);
    } catch {
      throw new Error(
        'Không đọc được phản hồi Backend. Hãy làm mới danh sách để kiểm tra.'
      );
    }
  }

  if (
    !response.ok ||
    obj(result)?.success === false
  ) {
    throw new Error(
      errorText(
        result,
        `Backend trả về HTTP ${response.status}.`
      )
    );
  }

  const envelope = obj(result);

  return envelope && 'data' in envelope
    ? envelope.data
    : result;
}

const pad = (n: number) => String(n).padStart(2, '0');

function localDateText(date: Date): string {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-` +
    `${pad(date.getDate())} ${pad(date.getHours())}:` +
    pad(date.getMinutes())
  );
}

function parseLocal(value: string): Date | null {
  const match =
    /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/
      .exec(value);

  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);

  const date = new Date(
    year,
    month - 1,
    day,
    hour,
    minute
  );

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute
  ) {
    return null;
  }

  return date;
}

function displayDate(date: Date | null): string {
  if (!date || Number.isNaN(date.getTime())) {
    return 'Chưa hợp lệ';
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

function money(value: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
}

function initialForm(): FormState {
  const start = new Date(Date.now() + 5 * 60000);
  const end = new Date(start.getTime() + 2 * 3600000);
  const pickup = new Date(end.getTime() + 30 * 60000);
  const pickupEnd = new Date(pickup.getTime() + 2 * 3600000);

  return {
    productId: '',
    title: '',
    description: '',
    salePrice: '',
    quantity: '10',
    saleStart: localDateText(start),
    saleEnd: localDateText(end),
    endMode: 'duration',
    durationDays: '0',
    durationHours: '2',
    autoPickup: true,
    pickupDelayMinutes: '30',
    pickupDurationHours: '2',
    manualPickupStart: localDateText(pickup),
    manualPickupEnd: localDateText(pickupEnd),
    allergyInfo: '',
    storageInstruction: '',
  };
}

/**
 * Card nổi nằm trên toàn bộ ScrollView của form.
 * Mở bộ chọn không làm thay đổi chiều cao các thành phần.
 */
function FloatingTimePicker({
  request,
  selectedValue,
  onSelect,
  onClose,
}: {
  request: PickerRequest;
  selectedValue: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}) {
  const values = request.part === 'hour' ? HOURS : MINUTES;

  return (
    <View style={styles.pickerOverlay}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessibilityLabel="Đóng bộ chọn giờ"
      />

      <View style={styles.pickerCard}>
        <View style={styles.pickerHeader}>
          <View style={styles.flex}>
            <Text style={styles.pickerTitle}>
              {request.part === 'hour'
                ? 'Chọn giờ (24h)'
                : 'Chọn phút'}
            </Text>
            <Text style={styles.muted}>
              {request.part === 'hour'
                ? 'Từ 00 đến 23'
                : 'Từ 00 đến 59'}
            </Text>
          </View>

          <Pressable
            onPress={onClose}
            style={styles.pickerClose}
          >
            <Ionicons
              name="close"
              size={22}
              color={colors.text}
            />
          </Pressable>
        </View>

        <ScrollView
          nestedScrollEnabled
          keyboardShouldPersistTaps="always"
          style={styles.pickerScroll}
          contentContainerStyle={styles.pickerGrid}
        >
          {values.map((value) => {
            const selected = value === selectedValue;

            return (
              <Pressable
                key={value}
                style={[
                  styles.pickerCell,
                  selected && styles.pickerCellSelected,
                ]}
                onPress={() => onSelect(value)}
              >
                <Text
                  style={[
                    styles.pickerCellText,
                    selected && styles.pickerCellTextSelected,
                  ]}
                >
                  {value}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

function DateTimeField({
  label,
  fieldKey,
  value,
  onChange,
  onOpenTime,
}: {
  label: string;
  fieldKey: TimeKey;
  value: string;
  onChange: (value: string) => void;
  onOpenTime: (request: PickerRequest) => void;
}) {
  const [calendarOpen, setCalendarOpen] = useState(false);

  const date = parseLocal(value) ?? new Date();
  const datePart = value.slice(0, 10);
  const hour = value.slice(11, 13);
  const minute = value.slice(14, 16);

  const updateDate = (next: string) => {
    if (!next) return;
    onChange(`${next} ${hour}:${minute}`);
  };

  const webDateInput = React.createElement('input', {
    type: 'date',
    value: datePart,
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
      updateDate(event.target.value);
    },
    'aria-label': `${label}: chọn ngày`,
    style: {
      width: '100%',
      height: 46,
      padding: '0 12px',
      boxSizing: 'border-box',
      border: `1px solid ${colors.border}`,
      borderRadius: 9,
      backgroundColor: colors.surface,
      color: colors.text,
      fontSize: 14,
      fontFamily: 'inherit',
      colorScheme: 'light',
      cursor: 'pointer',
    },
  });

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>
        {label}
      </Text>

      <View style={styles.dateTimeRow}>
        <View style={styles.datePart}>
          <Text style={styles.smallLabel}>
            Ngày
          </Text>

          {Platform.OS === 'web' ? (
            webDateInput
          ) : (
            <Pressable
              onPress={() => setCalendarOpen(true)}
              style={styles.dateButton}
            >
              <Ionicons
                name="calendar-outline"
                size={19}
                color={colors.primary}
              />
              <Text style={styles.dateButtonText}>
                {datePart}
              </Text>
            </Pressable>
          )}
        </View>

        <View style={styles.timePart}>
          <Text style={styles.smallLabel}>
            Giờ (24h)
          </Text>

          <View style={styles.clockRow}>
            <Pressable
              onPress={() => onOpenTime({
                field: fieldKey,
                part: 'hour',
              })}
              style={styles.clockButton}
            >
              <Text style={styles.clockText}>
                {hour}
              </Text>
              <Ionicons
                name="chevron-down"
                size={14}
                color={colors.primary}
              />
            </Pressable>

            <Text style={styles.clockColon}>:</Text>

            <Pressable
              onPress={() => onOpenTime({
                field: fieldKey,
                part: 'minute',
              })}
              style={styles.clockButton}
            >
              <Text style={styles.clockText}>
                {minute}
              </Text>
              <Ionicons
                name="chevron-down"
                size={14}
                color={colors.primary}
              />
            </Pressable>
          </View>
        </View>
      </View>

      {Platform.OS !== 'web' && calendarOpen && (
        <View style={styles.nativeCalendar}>
          <DateTimePicker
            value={date}
            mode="date"
            display={
              Platform.OS === 'ios'
                ? 'spinner'
                : 'default'
            }
            onChange={(event, chosen) => {
              if (Platform.OS === 'android') {
                setCalendarOpen(false);
              }

              if (event.type !== 'set' || !chosen) {
                return;
              }

              updateDate(
                `${chosen.getFullYear()}-` +
                `${pad(chosen.getMonth() + 1)}-` +
                pad(chosen.getDate())
              );
            }}
          />

          {Platform.OS === 'ios' && (
            <Pressable onPress={() => setCalendarOpen(false)}>
              <Text style={styles.doneText}>
                Xong
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

function FormField({
  label,
  value,
  onChange,
  multiline,
  numeric,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  numeric?: boolean;
  placeholder?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>
        {label}
      </Text>

      <TextInput
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        keyboardType={numeric ? 'numeric' : 'default'}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={[
          styles.input,
          multiline && styles.multiline,
        ]}
      />
    </View>
  );
}

export default function FlashSalesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ shopId?: string }>();
  const { status, getAccessToken } = useAuth();

  const requestedShopId =
    typeof params.shopId === 'string' &&
    UUID.test(params.shopId)
      ? params.shopId
      : '';

  const [shops, setShops] = useState<Shop[]>([]);
  const [shopId, setShopId] = useState(requestedShopId);
  const [products, setProducts] = useState<Product[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] =
    useState<number | null>(null);
  const [rawOfferCount, setRawOfferCount] = useState(0);

  const [loadingShops, setLoadingShops] = useState(false);
  const [loadingOffers, setLoadingOffers] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(initialForm);

  const [timePicker, setTimePicker] =
    useState<PickerRequest | null>(null);

  const [error, setError] = useState('');
  const [productError, setProductError] = useState('');
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');
  const [unknownFormat, setUnknownFormat] = useState(false);

  const effectiveShopId = requestedShopId || shopId;

  const selectedShop = shops.find(
    (shop) => shop.id === effectiveShopId
  );

  const selectedProduct = products.find(
    (product) => product.id === form.productId
  );

  const saleStartDate = useMemo(
    () => parseLocal(form.saleStart),
    [form.saleStart]
  );

  const saleEndDate = useMemo(() => {
    if (form.endMode === 'specific') {
      return parseLocal(form.saleEnd);
    }

    if (!saleStartDate) return null;

    const days = Number(form.durationDays);
    const hours = Number(form.durationHours);

    if (
      !form.durationDays.trim() ||
      !form.durationHours.trim() ||
      !Number.isInteger(days) ||
      !Number.isInteger(hours) ||
      days < 0 ||
      days > 365 ||
      hours < 0 ||
      hours > 23 ||
      (days === 0 && hours === 0)
    ) {
      return null;
    }

    return new Date(
      saleStartDate.getTime() +
      (days * 24 + hours) * 3600000
    );
  }, [
    form.endMode,
    form.saleEnd,
    form.durationDays,
    form.durationHours,
    saleStartDate,
  ]);

  const autoPickupDates = useMemo(() => {
    if (!saleEndDate) {
      return { start: null, end: null };
    }

    const delay = Number(form.pickupDelayMinutes);
    const duration = Number(form.pickupDurationHours);

    if (
      !Number.isFinite(delay) ||
      !Number.isFinite(duration) ||
      delay < 0 ||
      duration <= 0
    ) {
      return { start: null, end: null };
    }

    const start = new Date(
      saleEndDate.getTime() + delay * 60000
    );

    return {
      start,
      end: new Date(
        start.getTime() + duration * 3600000
      ),
    };
  }, [
    saleEndDate,
    form.pickupDelayMinutes,
    form.pickupDurationHours,
  ]);

  const pickupStartDate = form.autoPickup
    ? autoPickupDates.start
    : parseLocal(form.manualPickupStart);

  const pickupEndDate = form.autoPickup
    ? autoPickupDates.end
    : parseLocal(form.manualPickupEnd);

  const loadShops = useCallback(async () => {
    if (status !== 'authenticated') return;

    setLoadingShops(true);

    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Phiên đăng nhập hết hạn.');

      const data = await api('/api/me/managed-shops', token);
      const parsed = (listOf(data) ?? [])
        .map(parseShop)
        .filter((shop): shop is Shop => shop !== null);

      setShops(parsed);

      setShopId((previous) => {
        if (requestedShopId) return requestedShopId;
        if (parsed.some((shop) => shop.id === previous)) {
          return previous;
        }
        return parsed[0]?.id ?? '';
      });
    } catch {
      // Giữ shopId đã được Dashboard truyền sang.
    } finally {
      setLoadingShops(false);
    }
  }, [getAccessToken, requestedShopId, status]);

  const loadOffers = useCallback(async () => {
    if (!effectiveShopId || status !== 'authenticated') return;

    setLoadingOffers(true);
    setError('');
    setUnknownFormat(false);

    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Phiên đăng nhập hết hạn.');

      const data = await api(
        `/api/shops/${encodeURIComponent(effectiveShopId)}` +
        `/offers?page=${page}&limit=20`,
        token
      );

      const list = listOf(data);

      if (!list) {
        setOffers([]);
        setRawOfferCount(0);
        setUnknownFormat(true);
        return;
      }

      const parsed = list
        .map(parseOffer)
        .filter((offer): offer is Offer => offer !== null);

      setOffers(
        parsed.filter(
          (offer) =>
            offer.type !== 'SAVIBITE_BOX' &&
            offer.type !== 'BOX'
        )
      );

      setRawOfferCount(list.length);
      setUnknownFormat(list.length > 0 && parsed.length === 0);

      const pages = obj(data)?.totalPages;

      setTotalPages(
        typeof pages === 'number' && Number.isFinite(pages)
          ? pages
          : null
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Không thể tải danh sách Flash Sale.'
      );
    } finally {
      setLoadingOffers(false);
    }
  }, [effectiveShopId, getAccessToken, page, status]);

  const loadProducts = useCallback(async () => {
    if (!effectiveShopId || status !== 'authenticated') return;

    setLoadingProducts(true);
    setProductError('');

    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Phiên đăng nhập hết hạn.');

      const data = await api(
        `/api/shops/${encodeURIComponent(effectiveShopId)}` +
        '/offers/flash-sale-products',
        token
      );

      const list = listOf(data);

      if (!list) {
        throw new Error('Không đọc được danh sách sản phẩm.');
      }

      const parsed = list
        .map(parseProduct)
        .filter((product): product is Product => product !== null);

      setProducts(parsed);

      if (list.length > 0 && parsed.length === 0) {
        setProductError(
          'Dữ liệu sản phẩm chưa đúng định dạng.'
        );
      }
    } catch (caught) {
      setProducts([]);
      setProductError(
        caught instanceof Error
          ? caught.message
          : 'Không thể tải sản phẩm.'
      );
    } finally {
      setLoadingProducts(false);
    }
  }, [effectiveShopId, getAccessToken, status]);

  useEffect(() => {
    if (status === 'authenticated') {
      void loadShops();
    } else if (status === 'guest') {
      setShops([]);
      setShopId('');
      setOffers([]);
      setProducts([]);
    }
  }, [loadShops, status]);

  useEffect(() => {
    setPage(1);
    setOffers([]);
    setProducts([]);
    setFormOpen(false);
    setTimePicker(null);
  }, [effectiveShopId]);

  useEffect(() => {
    if (effectiveShopId) void loadOffers();
  }, [effectiveShopId, loadOffers]);

  useEffect(() => {
    if (effectiveShopId) void loadProducts();
  }, [effectiveShopId, loadProducts]);

  const updateForm = (changes: Partial<FormState>) => {
    setForm((previous) => ({
      ...previous,
      ...changes,
    }));
    setFormError('');
  };

  const openCreate = () => {
    setForm(initialForm());
    setFormError('');
    setSuccess('');
    setTimePicker(null);
    setFormOpen(true);
  };

  const closeForm = () => {
    if (saving) return;
    setTimePicker(null);
    setFormOpen(false);
  };

  const selectTime = (selected: string) => {
    if (!timePicker) return;

    const field = timePicker.field;
    const current = form[field];

    const datePart = current.slice(0, 10);
    const hour = current.slice(11, 13);
    const minute = current.slice(14, 16);

    const updated =
      timePicker.part === 'hour'
        ? `${datePart} ${selected}:${minute}`
        : `${datePart} ${hour}:${selected}`;

    updateForm({ [field]: updated } as Partial<FormState>);
    setTimePicker(null);
  };

  const currentPickerValue = timePicker
    ? timePicker.part === 'hour'
      ? form[timePicker.field].slice(11, 13)
      : form[timePicker.field].slice(14, 16)
    : '';

  const setAutoPickup = (enabled: boolean) => {
    if (!enabled) {
      updateForm({
        autoPickup: false,
        manualPickupStart: pickupStartDate
          ? localDateText(pickupStartDate)
          : form.manualPickupStart,
        manualPickupEnd: pickupEndDate
          ? localDateText(pickupEndDate)
          : form.manualPickupEnd,
      });
    } else {
      updateForm({ autoPickup: true });
    }
  };

  const createFlashSale = async () => {
    if (saving || !effectiveShopId) return;

    if (!selectedProduct || !UUID.test(form.productId)) {
      setFormError('Vui lòng chọn sản phẩm hợp lệ.');
      return;
    }

    if (
      !form.title.trim() ||
      form.title.trim().length > 200
    ) {
      setFormError('Tiêu đề phải có từ 1 đến 200 ký tự.');
      return;
    }

    if (
      form.description.length > 2000 ||
      form.allergyInfo.length > 1000 ||
      form.storageInstruction.length > 1000
    ) {
      setFormError('Thông tin sản phẩm vượt giới hạn.');
      return;
    }

    const price = Number(form.salePrice);
    const quantity = Number(form.quantity);

    if (
      !form.salePrice.trim() ||
      !Number.isFinite(price) ||
      price <= 0
    ) {
      setFormError('Giá ưu đãi phải lớn hơn 0.');
      return;
    }

    if (
      selectedProduct.originalPrice > 0 &&
      price >= selectedProduct.originalPrice
    ) {
      setFormError('Giá ưu đãi phải thấp hơn giá gốc.');
      return;
    }

    if (
      !form.quantity.trim() ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 100000
    ) {
      setFormError('Số lượng phải từ 1 đến 100.000.');
      return;
    }

    if (
      !saleStartDate ||
      !saleEndDate ||
      !pickupStartDate ||
      !pickupEndDate
    ) {
      setFormError('Vui lòng chọn thời gian hợp lệ.');
      return;
    }

    if (
      saleStartDate.getTime() >= saleEndDate.getTime() ||
      saleEndDate.getTime() > pickupStartDate.getTime() ||
      pickupStartDate.getTime() >= pickupEndDate.getTime()
    ) {
      setFormError(
        'Thời gian cần đúng thứ tự: bắt đầu bán < kết thúc bán ≤ bắt đầu nhận < kết thúc nhận.'
      );
      return;
    }

    if (saleEndDate.getTime() <= Date.now()) {
      setFormError('Thời gian kết thúc bán phải ở tương lai.');
      return;
    }

    setSaving(true);
    setFormError('');
    setSuccess('');

    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Phiên đăng nhập hết hạn.');

      await api(
        `/api/shops/${encodeURIComponent(effectiveShopId)}/offers`,
        token,
        {
          productId: selectedProduct.id,
          title: form.title.trim(),
          description: form.description.trim() || null,
          salePrice: price,
          quantity,
          saleStartAt: saleStartDate.toISOString(),
          saleEndAt: saleEndDate.toISOString(),
          pickupStartAt: pickupStartDate.toISOString(),
          pickupEndAt: pickupEndDate.toISOString(),
          allergyInfo: form.allergyInfo.trim() || null,
          storageInstruction:
            form.storageInstruction.trim() || null,
        }
      );

      setFormOpen(false);
      setTimePicker(null);
      setSuccess('Đã tạo Flash Sale thành công.');

      if (page !== 1) {
        setPage(1);
      } else {
        await loadOffers();
      }
    } catch (caught) {
      setFormError(
        caught instanceof Error
          ? caught.message
          : 'Không thể tạo Flash Sale.'
      );
    } finally {
      setSaving(false);
    }
  };

  const dateField = (
    label: string,
    key: TimeKey
  ) => (
    <DateTimeField
      label={label}
      fieldKey={key}
      value={form[key]}
      onChange={(value) =>
        updateForm({ [key]: value } as Partial<FormState>)
      }
      onOpenTime={setTimePicker}
    />
  );

  if (status === 'loading' || loadingShops) {
    return (
      <CustomerLayout>
        <ScreenContainer style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.muted}>Đang tải cửa hàng...</Text>
        </ScreenContainer>
      </CustomerLayout>
    );
  }

  if (status !== 'authenticated') {
    return (
      <CustomerLayout>
        <ScreenContainer style={styles.center}>
          <Text style={styles.title}>
            Đăng nhập để quản lý Flash Sale
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
          style={styles.back}
          onPress={() => router.push('/shop-orders')}
        >
          <Ionicons name="arrow-back" size={18} color={colors.primary} />
          <Text style={styles.link}>Quay lại Dashboard</Text>
        </Pressable>

        <View style={styles.heading}>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>SAVIBITE · FLASH SALE</Text>
            <Text style={styles.title}>Quản lý Flash Sale</Text>
            <Text style={styles.muted}>
              Tạo ưu đãi cuối ngày từ sản phẩm cửa hàng.
            </Text>
          </View>
          {!!effectiveShopId && (
            <AppButton title="Tạo Flash Sale" onPress={openCreate} />
          )}
        </View>

        {!!effectiveShopId && (
          <View style={styles.shopBanner}>
            <Ionicons
              name="storefront-outline"
              size={23}
              color={colors.primary}
            />
            <View style={styles.flex}>
              <Text style={styles.shopName}>
                {selectedShop?.name ?? 'Cửa hàng đang quản lý'}
              </Text>
              <Text style={styles.muted}>
                {selectedShop
                  ? `Vai trò: ${selectedShop.role}`
                  : 'Cửa hàng được chọn từ Dashboard'}
              </Text>
            </View>
          </View>
        )}

        {shops.length > 1 && (
          <View style={styles.wrap}>
            {shops.map((shop) => (
              <Pressable
                key={shop.id}
                style={[
                  styles.chip,
                  shop.id === effectiveShopId && styles.selectedChip,
                ]}
                onPress={() => router.setParams({ shopId: shop.id })}
              >
                <Text style={[
                  styles.chipText,
                  shop.id === effectiveShopId && styles.selectedChipText,
                ]}>
                  {shop.name}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {!!success && (
          <View style={styles.successBox}>
            <Text style={styles.successText}>{success}</Text>
          </View>
        )}

        {!!error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {!effectiveShopId && (
          <View style={styles.panel}>
            <Text style={styles.muted}>
              Chưa chọn cửa hàng. Vui lòng mở Flash Sale từ Dashboard.
            </Text>
            <AppButton
              title="Về Dashboard"
              onPress={() => router.push('/shop-orders')}
            />
          </View>
        )}

        {!!effectiveShopId && (
          <View style={styles.panel}>
            <View style={styles.heading}>
              <View style={styles.flex}>
                <Text style={styles.sectionTitle}>
                  Danh sách Flash Sale
                </Text>
                <Text style={styles.muted}>
                  Trang {page}
                  {totalPages !== null
                    ? ` / ${Math.max(1, totalPages)}`
                    : ''}
                  {' · '}{offers.length} ưu đãi đang hiển thị
                </Text>
              </View>
              <AppButton
                title="Làm mới"
                variant="outline"
                disabled={loadingOffers}
                onPress={() => void loadOffers()}
              />
            </View>

            {loadingOffers ? (
              <ActivityIndicator color={colors.primary} size="large" />
            ) : unknownFormat ? (
              <Text style={styles.errorText}>
                Không đọc được dữ liệu danh sách.
              </Text>
            ) : offers.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons
                  name="flash-outline"
                  size={40}
                  color={colors.textMuted}
                />
                <Text style={styles.muted}>
                  Chưa có Flash Sale trên trang này.
                </Text>
              </View>
            ) : (
              offers.map((offer) => (
                <View key={offer.id} style={styles.offerCard}>
                  <View style={styles.heading}>
                    <View style={styles.flex}>
                      <Text style={styles.offerTitle}>
                        {offer.title}
                      </Text>
                      {!!offer.status && (
                        <Text style={styles.muted}>
                          Trạng thái: {offer.status}
                        </Text>
                      )}
                    </View>
                    <Text style={styles.price}>
                      {offer.price !== null
                        ? money(offer.price)
                        : '—'}
                    </Text>
                  </View>

                  {offer.quantity !== null && (
                    <Text style={styles.muted}>
                      Số lượng theo API: {offer.quantity}
                    </Text>
                  )}

                  {!!offer.saleEndAt && (
                    <Text style={styles.muted}>
                      Kết thúc bán:{' '}
                      {displayDate(new Date(offer.saleEndAt))}
                    </Text>
                  )}

                  <AppButton
                    title="Xem ưu đãi"
                    variant="outline"
                    onPress={() => router.push({
                      pathname: '/offer/[id]',
                      params: { id: offer.id },
                    })}
                  />
                </View>
              ))
            )}

            <View style={styles.pagination}>
              <AppButton
                title="Trang trước"
                variant="outline"
                disabled={loadingOffers || page <= 1}
                onPress={() => setPage((p) => Math.max(1, p - 1))}
              />
              <Text style={styles.muted}>Trang {page}</Text>
              <AppButton
                title="Trang sau"
                variant="outline"
                disabled={
                  loadingOffers ||
                  (totalPages !== null
                    ? page >= totalPages
                    : rawOfferCount < 20)
                }
                onPress={() => setPage((p) => p + 1)}
              />
            </View>
          </View>
        )}
      </ScreenContainer>

      <Modal
        visible={formOpen}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (timePicker) {
            setTimePicker(null);
          } else {
            closeForm();
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalPanel}>
            <View style={styles.modalHeader}>
              <Text style={styles.sectionTitle}>
                Tạo Flash Sale mới
              </Text>
              <Pressable onPress={closeForm} disabled={saving}>
                <Ionicons name="close" size={25} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView
              nestedScrollEnabled
              keyboardShouldPersistTaps="always"
              contentContainerStyle={styles.formContent}
            >
              <Text style={styles.fieldLabel}>Chọn sản phẩm *</Text>

              {loadingProducts && (
                <ActivityIndicator color={colors.primary} />
              )}

              {!!productError && (
                <Text style={styles.errorText}>{productError}</Text>
              )}

              <View style={styles.productChoices}>
                {products.map((product) => {
                  const selected = product.id === form.productId;

                  return (
                    <Pressable
                      key={product.id}
                      style={[
                        styles.productChoice,
                        selected && styles.productSelected,
                      ]}
                      onPress={() => updateForm({
                        productId: product.id,
                        title: `${product.name} ưu đãi cuối ngày`,
                        salePrice: product.originalPrice > 0
                          ? String(Math.round(product.originalPrice / 2))
                          : '',
                      })}
                    >
                      <Ionicons
                        name={
                          selected
                            ? 'radio-button-on'
                            : 'radio-button-off'
                        }
                        size={20}
                        color={colors.primary}
                      />
                      <View style={styles.flex}>
                        <Text style={styles.productName}>
                          {product.name}
                        </Text>
                        <Text style={styles.muted}>
                          Giá gốc: {money(product.originalPrice)}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              <FormField
                label="Tiêu đề Flash Sale *"
                value={form.title}
                onChange={(title) => updateForm({ title })}
              />
              <FormField
                label="Mô tả"
                value={form.description}
                multiline
                onChange={(description) => updateForm({ description })}
              />
              <FormField
                label="Giá ưu đãi (VNĐ) *"
                value={form.salePrice}
                numeric
                onChange={(value) => updateForm({
                  salePrice: value.replace(/[^0-9]/g, ''),
                })}
              />

              {selectedProduct && selectedProduct.originalPrice > 0 && (
                <Text style={styles.discount}>
                  Giá gốc: {money(selectedProduct.originalPrice)}
                  {Number(form.salePrice) > 0
                    ? ` · Giảm ${Math.round(
                        (1 - Number(form.salePrice) /
                          selectedProduct.originalPrice) * 100
                      )}%`
                    : ''}
                </Text>
              )}

              <FormField
                label="Số lượng *"
                value={form.quantity}
                numeric
                onChange={(value) => updateForm({
                  quantity: value.replace(/[^0-9]/g, ''),
                })}
              />

              <View style={styles.sectionHeader}>
                <Ionicons
                  name="calendar-outline"
                  size={22}
                  color={colors.primary}
                />
                <Text style={styles.sectionTitle}>
                  Thời gian bán Flash Sale
                </Text>
              </View>

              {dateField('Bắt đầu bán *', 'saleStart')}

              <Text style={styles.fieldLabel}>
                Cách xác định thời gian kết thúc
              </Text>

              <Pressable
                style={[
                  styles.modeChoice,
                  form.endMode === 'duration' && styles.modeSelected,
                ]}
                onPress={() => updateForm({ endMode: 'duration' })}
              >
                <Ionicons
                  name={form.endMode === 'duration'
                    ? 'radio-button-on'
                    : 'radio-button-off'}
                  size={21}
                  color={colors.primary}
                />
                <View style={styles.flex}>
                  <Text style={styles.productName}>Theo thời lượng</Text>
                  <Text style={styles.muted}>
                    Ví dụ: 2 ngày 6 giờ.
                  </Text>
                </View>
              </Pressable>

              <Pressable
                style={[
                  styles.modeChoice,
                  form.endMode === 'specific' && styles.modeSelected,
                ]}
                onPress={() => updateForm({
                  endMode: 'specific',
                  saleEnd: saleEndDate
                    ? localDateText(saleEndDate)
                    : form.saleEnd,
                })}
              >
                <Ionicons
                  name={form.endMode === 'specific'
                    ? 'radio-button-on'
                    : 'radio-button-off'}
                  size={21}
                  color={colors.primary}
                />
                <View style={styles.flex}>
                  <Text style={styles.productName}>
                    Chọn thời điểm cụ thể
                  </Text>
                  <Text style={styles.muted}>
                    Chọn ngày và giờ kết thúc bán.
                  </Text>
                </View>
              </Pressable>

              {form.endMode === 'duration' ? (
                <>
                  <View style={styles.columns}>
                    <View style={styles.column}>
                      <FormField
                        label="Số ngày"
                        value={form.durationDays}
                        numeric
                        onChange={(value) => updateForm({
                          durationDays: value.replace(/[^0-9]/g, ''),
                        })}
                      />
                    </View>
                    <View style={styles.column}>
                      <FormField
                        label="Số giờ (0–23)"
                        value={form.durationHours}
                        numeric
                        onChange={(value) => updateForm({
                          durationHours: value.replace(/[^0-9]/g, ''),
                        })}
                      />
                    </View>
                  </View>

                  <View style={styles.calculatedBox}>
                    <Ionicons
                      name="time-outline"
                      color={colors.eco}
                      size={23}
                    />
                    <View style={styles.flex}>
                      <Text style={styles.muted}>
                        Kết thúc bán dự kiến
                      </Text>
                      <Text style={styles.calculatedText}>
                        {displayDate(saleEndDate)}
                      </Text>
                    </View>
                  </View>
                </>
              ) : (
                dateField('Kết thúc bán *', 'saleEnd')
              )}

              <View style={styles.divider} />

              <View style={styles.sectionHeader}>
                <Ionicons
                  name="bag-check-outline"
                  size={23}
                  color={colors.primary}
                />
                <Text style={styles.sectionTitle}>
                  Thời gian nhận hàng
                </Text>
              </View>

              <Pressable
                style={styles.autoChoice}
                onPress={() => setAutoPickup(!form.autoPickup)}
              >
                <Ionicons
                  name={form.autoPickup ? 'checkbox' : 'square-outline'}
                  size={24}
                  color={colors.primary}
                />
                <View style={styles.flex}>
                  <Text style={styles.productName}>
                    Tự động cập nhật giờ nhận hàng
                  </Text>
                  <Text style={styles.muted}>
                    Đồng bộ khi thay đổi giờ kết thúc bán.
                  </Text>
                </View>
              </Pressable>

              {form.autoPickup ? (
                <>
                  <Text style={styles.fieldLabel}>
                    Nhận hàng sau khi kết thúc bán
                  </Text>
                  <View style={styles.wrap}>
                    {[
                      ['0', 'Ngay lập tức'],
                      ['15', 'Sau 15 phút'],
                      ['30', 'Sau 30 phút'],
                      ['60', 'Sau 1 giờ'],
                    ].map(([value, label]) => (
                      <Pressable
                        key={value}
                        style={[
                          styles.chip,
                          form.pickupDelayMinutes === value &&
                            styles.selectedChip,
                        ]}
                        onPress={() =>
                          updateForm({ pickupDelayMinutes: value })
                        }
                      >
                        <Text style={[
                          styles.chipText,
                          form.pickupDelayMinutes === value &&
                            styles.selectedChipText,
                        ]}>
                          {label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={styles.fieldLabel}>
                    Thời gian cho phép nhận
                  </Text>
                  <View style={styles.wrap}>
                    {['1', '2', '3', '4', '6'].map((hours) => (
                      <Pressable
                        key={hours}
                        style={[
                          styles.chip,
                          form.pickupDurationHours === hours &&
                            styles.selectedChip,
                        ]}
                        onPress={() =>
                          updateForm({ pickupDurationHours: hours })
                        }
                      >
                        <Text style={[
                          styles.chipText,
                          form.pickupDurationHours === hours &&
                            styles.selectedChipText,
                        ]}>
                          {hours} giờ
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <View style={styles.pickupSummary}>
                    <Text style={styles.muted}>Bắt đầu nhận</Text>
                    <Text style={styles.summaryValue}>
                      {displayDate(pickupStartDate)}
                    </Text>
                    <View style={styles.divider} />
                    <Text style={styles.muted}>Kết thúc nhận</Text>
                    <Text style={styles.summaryValue}>
                      {displayDate(pickupEndDate)}
                    </Text>
                  </View>
                </>
              ) : (
                <>
                  {dateField(
                    'Bắt đầu nhận hàng *',
                    'manualPickupStart'
                  )}
                  {dateField(
                    'Kết thúc nhận hàng *',
                    'manualPickupEnd'
                  )}
                </>
              )}

              <View style={styles.divider} />

              <FormField
                label="Thông tin dị ứng"
                value={form.allergyInfo}
                multiline
                onChange={(allergyInfo) => updateForm({ allergyInfo })}
              />

              <FormField
                label="Hướng dẫn bảo quản"
                value={form.storageInstruction}
                multiline
                onChange={(storageInstruction) =>
                  updateForm({ storageInstruction })
                }
              />

              {!!formError && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{formError}</Text>
                </View>
              )}

              <View style={styles.actions}>
                <AppButton
                  title="Hủy"
                  variant="outline"
                  disabled={saving}
                  onPress={closeForm}
                />
                <AppButton
                  title={saving ? 'Đang tạo...' : 'Tạo Flash Sale'}
                  disabled={saving || loadingProducts || !products.length}
                  onPress={() => void createFlashSale()}
                />
              </View>
            </ScrollView>

            {timePicker && (
              <FloatingTimePicker
                request={timePicker}
                selectedValue={currentPickerValue}
                onSelect={selectTime}
                onClose={() => setTimePicker(null)}
              />
            )}
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
    minHeight: 430,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'flex-start',
  },
  link: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.lg,
  },
  flex: { flex: 1, gap: spacing.xs },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.eco,
    letterSpacing: 1.2,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.text,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: colors.text,
  },
  shopName: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  muted: {
    fontSize: 13,
    lineHeight: 21,
    color: colors.textSecondary,
  },
  panel: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  shopBanner: {
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  offerCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.md,
  },
  offerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  price: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.primary,
  },
  empty: {
    minHeight: 170,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  selectedChip: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  chipText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  selectedChipText: { color: colors.white },
  successBox: {
    backgroundColor: '#EAF6E4',
    padding: spacing.lg,
    borderRadius: radius.md,
  },
  successText: {
    color: colors.eco,
    fontSize: 13,
    fontWeight: '700',
  },
  errorBox: {
    backgroundColor: colors.surfaceMuted,
    padding: spacing.lg,
    borderRadius: radius.md,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 21,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  modalPanel: {
    width: '100%',
    maxWidth: 760,
    maxHeight: '94%',
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: spacing.xl,
    gap: spacing.lg,
    position: 'relative',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  formContent: {
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  field: { gap: spacing.sm },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  smallLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 14,
  },
  multiline: { minHeight: 84 },
  dateTimeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  datePart: {
    flex: 2,
    minWidth: 165,
    gap: spacing.sm,
  },
  timePart: {
    flex: 1,
    minWidth: 170,
    gap: spacing.sm,
  },
  dateButton: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dateButtonText: {
    color: colors.text,
    fontSize: 14,
  },
  clockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  clockButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  clockText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  clockColon: {
    fontSize: 21,
    fontWeight: '800',
    color: colors.text,
  },
  nativeCalendar: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  doneText: {
    color: colors.primary,
    fontWeight: '800',
    textAlign: 'right',
    padding: spacing.md,
  },
  productChoices: { gap: spacing.sm },
  productChoice: {
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
  },
  productSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceMuted,
  },
  productName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  discount: {
    color: colors.eco,
    fontWeight: '700',
    fontSize: 13,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  modeChoice: {
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  modeSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceMuted,
  },
  columns: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  column: {
    flex: 1,
    minWidth: 130,
  },
  calculatedBox: {
    backgroundColor: '#EAF6E4',
    padding: spacing.lg,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  calculatedText: {
    color: colors.eco,
    fontSize: 17,
    fontWeight: '800',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  autoChoice: {
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  pickupSummary: {
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    gap: spacing.md,
  },
  summaryValue: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.primary,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: spacing.md,
  },

  // Popup giờ/phút - lớp nổi riêng.
  pickerOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 100,
    elevation: 30,
    backgroundColor: 'rgba(15,23,42,0.22)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: radius.md,
  },
  pickerCard: {
    width: '100%',
    maxWidth: 390,
    maxHeight: '85%',
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
    elevation: 32,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  pickerClose: { padding: spacing.sm },
  pickerScroll: {
    maxHeight: 320,
  },
  pickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  pickerCell: {
    width: '22%',
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pickerCellSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  pickerCellText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  pickerCellTextSelected: {
    color: colors.white,
  },
});
