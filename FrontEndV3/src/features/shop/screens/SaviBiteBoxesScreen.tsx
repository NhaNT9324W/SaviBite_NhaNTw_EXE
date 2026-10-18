import { requireAccess } from '../../../features/auth/components/requireAccess';
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

import { ENV } from '../../../config/env';
import { useAuth } from '../../../features/auth/context/AuthProvider';
import CustomerLayout from '../../../shared/components/layout/CustomerLayout';
import ScreenContainer from '../../../shared/components/layout/ScreenContainer';
import AppButton from '../../../shared/components/ui/AppButton';
import { colors, radius, spacing } from '../../../shared/theme';

type Data = Record<string, unknown>;
type TimeField = 'saleStart' | 'saleEnd' | 'pickupStart' | 'pickupEnd';
type EndMode = 'duration' | 'specific';

type Shop = {
  id: string;
  name: string;
  role: string;
};

type BoxOffer = {
  id: string;
  title: string;
  description: string;
  salePrice: number | null;
  originalValue: number | null;
  quantity: number | null;
  status: string;
  saleEndAt: string;
  pickupStartAt: string;
  pickupEndAt: string;
};

type BoxForm = {
  title: string;
  description: string;
  originalValue: string;
  salePrice: string;
  quantity: string;
  saleStart: string;
  saleEnd: string;
  endMode: EndMode;
  durationDays: string;
  durationHours: string;
  autoPickup: boolean;
  pickupDelay: string;
  pickupHours: string;
  pickupStart: string;
  pickupEnd: string;
  allergyInfo: string;
  storageInstruction: string;
};

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const HOURS = Array.from(
  { length: 24 },
  (_, i) => String(i).padStart(2, '0')
);

const MINUTES = Array.from(
  { length: 60 },
  (_, i) => String(i).padStart(2, '0')
);

const pad = (value: number) => String(value).padStart(2, '0');

function objectOf(value: unknown): Data | null {
  return value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
    ? value as Data
    : null;
}

function textOf(value: unknown, ...keys: string[]): string {
  const source = objectOf(value);

  for (const key of keys) {
    const item = source?.[key];

    if (typeof item === 'string' && item.trim()) {
      return item.trim();
    }
  }

  return '';
}

function numberOf(value: unknown, ...keys: string[]): number | null {
  const source = objectOf(value);

  for (const key of keys) {
    const item = source?.[key];

    if (
      typeof item === 'number' &&
      Number.isFinite(item)
    ) {
      return item;
    }
  }

  return null;
}

function listOf(value: unknown, depth = 0): unknown[] | null {
  if (Array.isArray(value)) return value;
  if (depth > 6) return null;

  const source = objectOf(value);
  if (!source) return null;

  for (const key of [
    'data',
    'items',
    'boxes',
    'offers',
    'shops',
    'managedShops',
    'memberships',
    'results',
  ]) {
    if (!(key in source)) continue;

    const found = listOf(source[key], depth + 1);

    if (found !== null) return found;
  }

  return null;
}

function parseShop(value: unknown): Shop | null {
  const root = objectOf(value);
  const source = objectOf(root?.shop) ?? root;

  const id =
    textOf(source, 'id', 'shopId') ||
    textOf(root, 'shopId');

  if (!UUID.test(id)) return null;

  const role = (
    textOf(root, 'memberRole', 'shopRole', 'role') ||
    textOf(source, 'memberRole', 'shopRole', 'role')
  ).toUpperCase();

  const membershipStatus = textOf(
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
      textOf(source, 'name', 'shopName') ||
      textOf(root, 'shopName') ||
      'Cửa hàng',
    role: role || 'MEMBER',
  };
}

function parseBox(value: unknown): BoxOffer | null {
  const id = textOf(value, 'id', 'offerId');

  if (!UUID.test(id)) return null;

  return {
    id,
    title: textOf(value, 'title', 'name') || id,
    description: textOf(value, 'description'),
    salePrice: numberOf(value, 'salePrice'),
    originalValue: numberOf(
      value,
      'originalValue',
      'originalPrice'
    ),
    quantity: numberOf(
      value,
      'availableQuantity',
      'remainingQuantity',
      'quantity'
    ),
    status: textOf(value, 'status', 'offerStatus'),
    saleEndAt: textOf(value, 'saleEndAt'),
    pickupStartAt: textOf(value, 'pickupStartAt'),
    pickupEndAt: textOf(value, 'pickupEndAt'),
  };
}

function getApiError(value: unknown, fallback: string): string {
  const root = objectOf(value);

  const message =
    textOf(root?.error, 'message') ||
    textOf(root, 'message');

  if (message) return message;

  const errors = objectOf(root?.errors);

  if (errors) {
    const messages: string[] = [];

    for (const item of Object.values(errors)) {
      if (Array.isArray(item)) {
        for (const entry of item) {
          if (typeof entry === 'string') messages.push(entry);
        }
      }
    }

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
        ? 'Mất kết nối khi tạo SaviBite Box. Hãy làm mới danh sách trước khi gửi lại.'
        : 'Không thể kết nối Backend.'
    );
  }

  const raw = await response.text();

  let json: unknown = null;

  if (raw.trim()) {
    try {
      json = JSON.parse(raw);
    } catch {
      throw new Error(
        'Không đọc được phản hồi Backend. Hãy kiểm tra lại danh sách.'
      );
    }
  }

  if (!response.ok || objectOf(json)?.success === false) {
    throw new Error(
      getApiError(
        json,
        `Backend trả về HTTP ${response.status}.`
      )
    );
  }

  const envelope = objectOf(json);

  return envelope && 'data' in envelope
    ? envelope.data
    : json;
}

function money(value: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
}

function localDateText(date: Date): string {
  return (
    `${date.getFullYear()}-` +
    `${pad(date.getMonth() + 1)}-` +
    `${pad(date.getDate())} ` +
    `${pad(date.getHours())}:` +
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

  const date = new Date(year, month - 1, day, hour, minute);

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

function initialForm(): BoxForm {
  const start = new Date(Date.now() + 5 * 60000);
  const end = new Date(start.getTime() + 2 * 3600000);
  const pickupStart = new Date(end.getTime() + 30 * 60000);
  const pickupEnd = new Date(pickupStart.getTime() + 2 * 3600000);

  return {
    title: '',
    description: '',
    originalValue: '',
    salePrice: '',
    quantity: '10',

    saleStart: localDateText(start),
    saleEnd: localDateText(end),
    endMode: 'duration',
    durationDays: '0',
    durationHours: '2',

    autoPickup: true,
    pickupDelay: '30',
    pickupHours: '2',
    pickupStart: localDateText(pickupStart),
    pickupEnd: localDateText(pickupEnd),

    allergyInfo: '',
    storageInstruction: '',
  };
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  numeric,
  multiline,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  numeric?: boolean;
  multiline?: boolean;
  maxLength?: number;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>

      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={numeric ? 'numeric' : 'default'}
        multiline={multiline}
        maxLength={maxLength}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={[
          styles.input,
          multiline && styles.multiline,
        ]}
      />
    </View>
  );
}

function DateTimeField({
  label,
  value,
  onChange,
  onChooseTime,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onChooseTime: (
    part: 'hour' | 'minute',
    value: string,
    update: (newValue: string) => void
  ) => void;
}) {
  const [showCalendar, setShowCalendar] = useState(false);

  const parsed = parseLocal(value) ?? new Date();
  const day = value.slice(0, 10);
  const hour = value.slice(11, 13);
  const minute = value.slice(14, 16);

  const changeDay = (nextDay: string) => {
    if (nextDay) onChange(`${nextDay} ${hour}:${minute}`);
  };

  const changeHour = (nextHour: string) => {
    onChange(`${day} ${nextHour}:${minute}`);
  };

  const changeMinute = (nextMinute: string) => {
    onChange(`${day} ${hour}:${nextMinute}`);
  };

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>

      <View style={styles.dateRow}>
        <View style={styles.dateColumn}>
          <Text style={styles.miniLabel}>Ngày</Text>

          {Platform.OS === 'web' ? (
            React.createElement('input', {
              type: 'date',
              value: day,
              'aria-label': `${label} - Ngày`,
              onChange: (
                event: React.ChangeEvent<HTMLInputElement>
              ) => changeDay(event.target.value),
              style: {
                height: 46,
                width: '100%',
                padding: '0 12px',
                border: `1px solid ${colors.border}`,
                borderRadius: 9,
                backgroundColor: colors.surface,
                color: colors.text,
                fontSize: 14,
                boxSizing: 'border-box',
                colorScheme: 'light',
              },
            })
          ) : (
            <Pressable
              style={styles.dateButton}
              onPress={() => setShowCalendar(true)}
            >
              <Ionicons
                name="calendar-outline"
                size={19}
                color={colors.primary}
              />
              <Text style={styles.dateText}>{day}</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.clockColumn}>
          <Text style={styles.miniLabel}>Giờ (24h)</Text>

          <View style={styles.clockRow}>
            <Pressable
              style={styles.clockButton}
              onPress={() => onChooseTime(
                'hour',
                hour,
                changeHour
              )}
            >
              <Text style={styles.clockText}>{hour}</Text>
              <Ionicons
                name="chevron-down"
                size={14}
                color={colors.primary}
              />
            </Pressable>

            <Text style={styles.colon}>:</Text>

            <Pressable
              style={styles.clockButton}
              onPress={() => onChooseTime(
                'minute',
                minute,
                changeMinute
              )}
            >
              <Text style={styles.clockText}>{minute}</Text>
              <Ionicons
                name="chevron-down"
                size={14}
                color={colors.primary}
              />
            </Pressable>
          </View>
        </View>
      </View>

      {Platform.OS !== 'web' && showCalendar && (
        <View style={styles.nativeCalendar}>
          <DateTimePicker
            value={parsed}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(event, selected) => {
              if (Platform.OS === 'android') {
                setShowCalendar(false);
              }

              if (event.type !== 'set' || !selected) return;

              changeDay(
                `${selected.getFullYear()}-` +
                `${pad(selected.getMonth() + 1)}-` +
                pad(selected.getDate())
              );
            }}
          />

          {Platform.OS === 'ios' && (
            <Pressable
              style={styles.doneButton}
              onPress={() => setShowCalendar(false)}
            >
              <Text style={styles.doneText}>Xong</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

function SaviBiteBoxesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ shopId?: string }>();
  const { status, getAccessToken } = useAuth();

  const requestedShopId =
    typeof params.shopId === 'string' && UUID.test(params.shopId)
      ? params.shopId
      : '';

  const [shops, setShops] = useState<Shop[]>([]);
  const [shopId, setShopId] = useState(requestedShopId);
  const [boxes, setBoxes] = useState<BoxOffer[]>([]);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState<number | null>(null);

  const [loadingShops, setLoadingShops] = useState(false);
  const [loadingBoxes, setLoadingBoxes] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  const [form, setForm] = useState<BoxForm>(initialForm);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');
  const [formatError, setFormatError] = useState(false);

  const [timePicker, setTimePicker] = useState<{
    part: 'hour' | 'minute';
    selected: string;
    onSelect: (value: string) => void;
  } | null>(null);

  const effectiveShopId = requestedShopId || shopId;
  const selectedShop = shops.find(
    (shop) => shop.id === effectiveShopId
  );

  const saleStart = useMemo(
    () => parseLocal(form.saleStart),
    [form.saleStart]
  );

  const saleEnd = useMemo(() => {
    if (form.endMode === 'specific') {
      return parseLocal(form.saleEnd);
    }

    if (!saleStart) return null;

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
      saleStart.getTime() + (days * 24 + hours) * 3600000
    );
  }, [
    form.endMode,
    form.saleEnd,
    form.durationDays,
    form.durationHours,
    saleStart,
  ]);

  const autoPickup = useMemo(() => {
    const delay = Number(form.pickupDelay);
    const duration = Number(form.pickupHours);

    if (
      !saleEnd ||
      !Number.isFinite(delay) ||
      !Number.isFinite(duration) ||
      delay < 0 ||
      duration <= 0
    ) {
      return { start: null, end: null };
    }

    const start = new Date(
      saleEnd.getTime() + delay * 60000
    );

    return {
      start,
      end: new Date(
        start.getTime() + duration * 3600000
      ),
    };
  }, [
    saleEnd,
    form.pickupDelay,
    form.pickupHours,
  ]);

  const pickupStart = form.autoPickup
    ? autoPickup.start
    : parseLocal(form.pickupStart);

  const pickupEnd = form.autoPickup
    ? autoPickup.end
    : parseLocal(form.pickupEnd);

  const discount = useMemo(() => {
    const original = Number(form.originalValue);
    const sale = Number(form.salePrice);

    if (
      !form.originalValue ||
      !form.salePrice ||
      original <= 0 ||
      sale <= 0
    ) {
      return null;
    }

    return Math.round(
      (1 - sale / original) * 100
    );
  }, [form.originalValue, form.salePrice]);

  const loadShops = useCallback(async () => {
    if (status !== 'authenticated') return;

    setLoadingShops(true);

    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Phiên đăng nhập hết hạn.');

      const data = await api('/api/me/managed-shops', token);
      const parsed = (listOf(data) ?? [])
        .map(parseShop)
        .filter((item): item is Shop => item !== null);

      setShops(parsed);
      setShopId((previous) => {
        if (requestedShopId) return requestedShopId;
        if (parsed.some((shop) => shop.id === previous)) {
          return previous;
        }
        return parsed[0]?.id ?? '';
      });
    } catch {
      // Nếu có shopId từ Dashboard, tiếp tục sử dụng.
      // Backend vẫn kiểm tra quyền thật khi gọi API.
    } finally {
      setLoadingShops(false);
    }
  }, [getAccessToken, requestedShopId, status]);

  const loadBoxes = useCallback(async () => {
    if (!effectiveShopId || status !== 'authenticated') return;

    setLoadingBoxes(true);
    setError('');
    setFormatError(false);

    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Phiên đăng nhập hết hạn.');

      const data = await api(
        `/api/shops/${encodeURIComponent(effectiveShopId)}` +
        `/offers/boxes?page=${page}&limit=10`,
        token
      );

      const list = listOf(data);

      if (!list) {
        setBoxes([]);
        setFormatError(true);
        return;
      }

      const parsed = list
        .map(parseBox)
        .filter((item): item is BoxOffer => item !== null);

      setBoxes(parsed);
      setFormatError(list.length > 0 && parsed.length === 0);

      const total = objectOf(data)?.totalPages;

      setTotalPages(
        typeof total === 'number' && Number.isFinite(total)
          ? total
          : null
      );
    } catch (caught) {
      setBoxes([]);
      setError(
        caught instanceof Error
          ? caught.message
          : 'Không thể tải danh sách SaviBite Box.'
      );
    } finally {
      setLoadingBoxes(false);
    }
  }, [effectiveShopId, getAccessToken, page, status]);

  useEffect(() => {
    if (status === 'authenticated') {
      void loadShops();
    } else if (status === 'guest') {
      setShops([]);
      setShopId('');
      setBoxes([]);
    }
  }, [loadShops, status]);

  useEffect(() => {
    setPage(1);
    setBoxes([]);
    setFormOpen(false);
  }, [effectiveShopId]);

  useEffect(() => {
    if (effectiveShopId) void loadBoxes();
  }, [effectiveShopId, loadBoxes]);

  const updateForm = (changes: Partial<BoxForm>) => {
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

  const chooseTime = (
    part: 'hour' | 'minute',
    selected: string,
    onSelect: (value: string) => void
  ) => {
    setTimePicker({ part, selected, onSelect });
  };

  const changePickupMode = (enabled: boolean) => {
    if (!enabled) {
      updateForm({
        autoPickup: false,
        pickupStart: pickupStart
          ? localDateText(pickupStart)
          : form.pickupStart,
        pickupEnd: pickupEnd
          ? localDateText(pickupEnd)
          : form.pickupEnd,
      });
    } else {
      updateForm({ autoPickup: true });
    }
  };

  const createBox = async () => {
    if (saving || !effectiveShopId) return;

    const title = form.title.trim();
    const originalValue = Number(form.originalValue);
    const salePrice = Number(form.salePrice);
    const quantity = Number(form.quantity);

    if (!title || title.length > 200) {
      setFormError('Tên Box phải có từ 1 đến 200 ký tự.');
      return;
    }

    if (form.description.length > 2000) {
      setFormError('Mô tả tối đa 2.000 ký tự.');
      return;
    }

    if (
      !form.originalValue.trim() ||
      !Number.isFinite(originalValue) ||
      originalValue <= 0
    ) {
      setFormError('Giá trị gốc phải lớn hơn 0.');
      return;
    }

    if (
      !form.salePrice.trim() ||
      !Number.isFinite(salePrice) ||
      salePrice <= 0 ||
      salePrice >= originalValue
    ) {
      setFormError(
        'Giá Box phải lớn hơn 0 và thấp hơn giá trị gốc.'
      );
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
      form.allergyInfo.length > 1000 ||
      form.storageInstruction.length > 1000
    ) {
      setFormError(
        'Thông tin dị ứng và bảo quản tối đa 1.000 ký tự.'
      );
      return;
    }

    // DTO yêu cầu hai trường này phải là chuỗi.
    if (
      !form.allergyInfo.trim() ||
      !form.storageInstruction.trim()
    ) {
      setFormError(
        'Vui lòng nhập thông tin dị ứng và hướng dẫn bảo quản.'
      );
      return;
    }

    if (!saleStart || !saleEnd || !pickupStart || !pickupEnd) {
      setFormError('Vui lòng chọn thời gian hợp lệ.');
      return;
    }

    if (
      saleStart.getTime() >= saleEnd.getTime() ||
      saleEnd.getTime() > pickupStart.getTime() ||
      pickupStart.getTime() >= pickupEnd.getTime()
    ) {
      setFormError(
        'Cần có: bắt đầu bán < kết thúc bán ≤ bắt đầu nhận < kết thúc nhận.'
      );
      return;
    }

    if (saleEnd.getTime() <= Date.now()) {
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
        `/api/shops/${encodeURIComponent(effectiveShopId)}` +
        '/offers/boxes',
        token,
        {
          title,
          description: form.description.trim() || null,
          originalValue,
          salePrice,
          quantity,
          saleStartAt: saleStart.toISOString(),
          saleEndAt: saleEnd.toISOString(),
          pickupStartAt: pickupStart.toISOString(),
          pickupEndAt: pickupEnd.toISOString(),
          allergyInfo: form.allergyInfo.trim(),
          storageInstruction: form.storageInstruction.trim(),
        }
      );

      setFormOpen(false);
      setTimePicker(null);
      setSuccess('Backend đã ghi nhận tạo SaviBite Box.');

      if (page !== 1) {
        setPage(1);
      } else {
        await loadBoxes();
      }
    } catch (caught) {
      setFormError(
        caught instanceof Error
          ? caught.message
          : 'Không thể tạo SaviBite Box.'
      );
    } finally {
      setSaving(false);
    }
  };

  if (status === 'loading' || loadingShops) {
    return (
      <CustomerLayout>
        <ScreenContainer style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
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
            Đăng nhập để quản lý SaviBite Box
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
          <Ionicons
            name="arrow-back"
            size={18}
            color={colors.primary}
          />
          <Text style={styles.link}>Quay lại Dashboard</Text>
        </Pressable>

        <View style={styles.heading}>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>
              SAVIBITE · SURPRISE BOX
            </Text>

            <Text style={styles.title}>
              Quản lý SaviBite Box
            </Text>

            <Text style={styles.muted}>
              Tạo hộp thực phẩm bất ngờ, tiết kiệm và giảm lãng phí.
            </Text>
          </View>

          {!!effectiveShopId && (
            <AppButton
              title="Tạo SaviBite Box"
              onPress={openCreate}
            />
          )}
        </View>

        {!!effectiveShopId && (
          <View style={styles.shopBanner}>
            <Ionicons
              name="storefront-outline"
              size={24}
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
                  shop.id === effectiveShopId &&
                    styles.chipSelected,
                ]}
                onPress={() =>
                  router.setParams({ shopId: shop.id })
                }
              >
                <Text
                  style={[
                    styles.chipText,
                    shop.id === effectiveShopId &&
                      styles.chipSelectedText,
                  ]}
                >
                  {shop.name}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {!!success && (
          <View style={styles.successBox}>
            <Ionicons
              name="checkmark-circle-outline"
              size={20}
              color={colors.eco}
            />
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
              Chưa xác định cửa hàng. Hãy mở SaviBite Box
              từ Dashboard.
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
                  Danh sách SaviBite Box
                </Text>
                <Text style={styles.muted}>
                  Trang {page}
                  {totalPages !== null
                    ? ` / ${Math.max(1, totalPages)}`
                    : ''}
                  {' · '}
                  {boxes.length} hộp đang hiển thị
                </Text>
              </View>

              <AppButton
                title="Làm mới"
                variant="outline"
                disabled={loadingBoxes}
                onPress={() => void loadBoxes()}
              />
            </View>

            {loadingBoxes ? (
              <ActivityIndicator
                color={colors.primary}
                size="large"
              />
            ) : formatError ? (
              <Text style={styles.errorText}>
                Không nhận diện được dữ liệu Box từ Backend.
              </Text>
            ) : boxes.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons
                  name="gift-outline"
                  size={44}
                  color={colors.textMuted}
                />
                <Text style={styles.muted}>
                  Chưa có SaviBite Box trên trang này.
                </Text>
              </View>
            ) : (
              <View style={styles.boxGrid}>
                {boxes.map((box) => {
                  const discountPercent =
                    box.originalValue !== null &&
                    box.originalValue > 0 &&
                    box.salePrice !== null
                      ? Math.round(
                          (1 - box.salePrice / box.originalValue) * 100
                        )
                      : null;

                  return (
                    <View key={box.id} style={styles.boxCard}>
                      <View style={styles.boxIcon}>
                        <Ionicons
                          name="gift"
                          color={colors.primary}
                          size={30}
                        />
                      </View>

                      <View style={styles.heading}>
                        <Text style={styles.boxTitle}>
                          {box.title}
                        </Text>
                        {discountPercent !== null && (
                          <View style={styles.discountBadge}>
                            <Text style={styles.discountBadgeText}>
                              -{discountPercent}%
                            </Text>
                          </View>
                        )}
                      </View>

                      {!!box.description && (
                        <Text style={styles.muted}>
                          {box.description}
                        </Text>
                      )}

                      {!!box.status && (
                        <Text style={styles.muted}>
                          Trạng thái: {box.status}
                        </Text>
                      )}

                      {box.originalValue !== null && (
                        <Text style={styles.oldPrice}>
                          {money(box.originalValue)}
                        </Text>
                      )}

                      <Text style={styles.price}>
                        {box.salePrice !== null
                          ? money(box.salePrice)
                          : 'Chưa có giá'}
                      </Text>

                      {box.quantity !== null && (
                        <Text style={styles.muted}>
                          Số lượng theo API: {box.quantity}
                        </Text>
                      )}

                      {!!box.pickupStartAt && (
                        <Text style={styles.muted}>
                          Nhận hàng:{' '}
                          {displayDate(new Date(box.pickupStartAt))}
                        </Text>
                      )}

                      <AppButton
                        title="Xem chi tiết"
                        variant="outline"
                        onPress={() =>
                          router.push({
                            pathname: '/offer/[id]',
                            params: { id: box.id },
                          })
                        }
                      />
                    </View>
                  );
                })}
              </View>
            )}

            <View style={styles.pagination}>
              <AppButton
                title="Trang trước"
                variant="outline"
                disabled={loadingBoxes || page <= 1}
                onPress={() =>
                  setPage((current) => Math.max(1, current - 1))
                }
              />

              <Text style={styles.muted}>Trang {page}</Text>

              <AppButton
                title="Trang sau"
                variant="outline"
                disabled={
                  loadingBoxes ||
                  (totalPages !== null
                    ? page >= totalPages
                    : boxes.length < 10)
                }
                onPress={() => setPage((current) => current + 1)}
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
              <View style={styles.flex}>
                <Text style={styles.sectionTitle}>
                  Tạo SaviBite Box
                </Text>
                <Text style={styles.muted}>
                  Hộp thực phẩm bất ngờ với giá tiết kiệm.
                </Text>
              </View>

              <Pressable
                disabled={saving}
                onPress={closeForm}
              >
                <Ionicons
                  name="close"
                  size={25}
                  color={colors.text}
                />
              </Pressable>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="always"
              nestedScrollEnabled
              contentContainerStyle={styles.formContent}
            >
              <InputField
                label="Tên SaviBite Box *"
                value={form.title}
                onChange={(title) => updateForm({ title })}
                placeholder="Ví dụ: Hộp bánh bất ngờ cuối ngày"
                maxLength={200}
              />

              <InputField
                label="Mô tả"
                value={form.description}
                onChange={(description) =>
                  updateForm({ description })
                }
                placeholder="Những món bánh được cửa hàng chuẩn bị..."
                maxLength={2000}
                multiline
              />

              <View style={styles.columns}>
                <View style={styles.column}>
                  <InputField
                    label="Giá trị gốc (VNĐ) *"
                    value={form.originalValue}
                    onChange={(value) =>
                      updateForm({
                        originalValue:
                          value.replace(/[^0-9]/g, ''),
                      })
                    }
                    placeholder="100000"
                    numeric
                  />
                </View>

                <View style={styles.column}>
                  <InputField
                    label="Giá bán Box (VNĐ) *"
                    value={form.salePrice}
                    onChange={(value) =>
                      updateForm({
                        salePrice: value.replace(/[^0-9]/g, ''),
                      })
                    }
                    placeholder="50000"
                    numeric
                  />
                </View>
              </View>

              {discount !== null && (
                <View style={styles.discountSummary}>
                  <Ionicons
                    name="pricetag-outline"
                    size={20}
                    color={colors.eco}
                  />
                  <Text style={styles.discountSummaryText}>
                    Giảm {discount}% so với giá trị gốc
                  </Text>
                </View>
              )}

              <InputField
                label="Số lượng hộp *"
                value={form.quantity}
                onChange={(value) =>
                  updateForm({
                    quantity: value.replace(/[^0-9]/g, ''),
                  })
                }
                numeric
              />

              <View style={styles.sectionHeader}>
                <Ionicons
                  name="calendar-outline"
                  size={23}
                  color={colors.primary}
                />
                <Text style={styles.sectionTitle}>
                  Thời gian bán
                </Text>
              </View>

              <DateTimeField
                label="Bắt đầu bán *"
                value={form.saleStart}
                onChange={(saleStart) =>
                  updateForm({ saleStart })
                }
                onChooseTime={chooseTime}
              />

              <Text style={styles.label}>
                Cách xác định thời gian kết thúc
              </Text>

              <Pressable
                style={[
                  styles.modeChoice,
                  form.endMode === 'duration' &&
                    styles.modeSelected,
                ]}
                onPress={() =>
                  updateForm({ endMode: 'duration' })
                }
              >
                <Ionicons
                  name={
                    form.endMode === 'duration'
                      ? 'radio-button-on'
                      : 'radio-button-off'
                  }
                  color={colors.primary}
                  size={21}
                />
                <View style={styles.flex}>
                  <Text style={styles.choiceTitle}>
                    Theo thời lượng
                  </Text>
                  <Text style={styles.muted}>
                    Ví dụ: 1 ngày 3 giờ
                  </Text>
                </View>
              </Pressable>

              <Pressable
                style={[
                  styles.modeChoice,
                  form.endMode === 'specific' &&
                    styles.modeSelected,
                ]}
                onPress={() =>
                  updateForm({
                    endMode: 'specific',
                    saleEnd: saleEnd
                      ? localDateText(saleEnd)
                      : form.saleEnd,
                  })
                }
              >
                <Ionicons
                  name={
                    form.endMode === 'specific'
                      ? 'radio-button-on'
                      : 'radio-button-off'
                  }
                  color={colors.primary}
                  size={21}
                />
                <View style={styles.flex}>
                  <Text style={styles.choiceTitle}>
                    Chọn thời điểm cụ thể
                  </Text>
                  <Text style={styles.muted}>
                    Chọn chính xác ngày giờ kết thúc
                  </Text>
                </View>
              </Pressable>

              {form.endMode === 'duration' ? (
                <>
                  <View style={styles.columns}>
                    <View style={styles.column}>
                      <InputField
                        label="Số ngày"
                        value={form.durationDays}
                        numeric
                        onChange={(value) =>
                          updateForm({
                            durationDays:
                              value.replace(/[^0-9]/g, ''),
                          })
                        }
                      />
                    </View>

                    <View style={styles.column}>
                      <InputField
                        label="Số giờ (0–23)"
                        value={form.durationHours}
                        numeric
                        onChange={(value) =>
                          updateForm({
                            durationHours:
                              value.replace(/[^0-9]/g, ''),
                          })
                        }
                      />
                    </View>
                  </View>

                  <View style={styles.timeSummary}>
                    <Ionicons
                      name="time-outline"
                      color={colors.eco}
                      size={22}
                    />
                    <View style={styles.flex}>
                      <Text style={styles.muted}>
                        Kết thúc bán dự kiến
                      </Text>
                      <Text style={styles.timeSummaryValue}>
                        {displayDate(saleEnd)}
                      </Text>
                    </View>
                  </View>
                </>
              ) : (
                <DateTimeField
                  label="Kết thúc bán *"
                  value={form.saleEnd}
                  onChange={(saleEndText) =>
                    updateForm({ saleEnd: saleEndText })
                  }
                  onChooseTime={chooseTime}
                />
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
                style={styles.modeChoice}
                onPress={() =>
                  changePickupMode(!form.autoPickup)
                }
              >
                <Ionicons
                  name={
                    form.autoPickup
                      ? 'checkbox'
                      : 'square-outline'
                  }
                  size={23}
                  color={colors.primary}
                />
                <View style={styles.flex}>
                  <Text style={styles.choiceTitle}>
                    Tự động cập nhật thời gian nhận
                  </Text>
                  <Text style={styles.muted}>
                    Tính theo thời điểm kết thúc bán
                  </Text>
                </View>
              </Pressable>

              {form.autoPickup ? (
                <>
                  <Text style={styles.label}>
                    Bắt đầu nhận sau khi kết thúc bán
                  </Text>
                  <View style={styles.wrap}>
                    {[
                      ['0', 'Ngay lập tức'],
                      ['15', '15 phút'],
                      ['30', '30 phút'],
                      ['60', '1 giờ'],
                    ].map(([value, label]) => (
                      <Pressable
                        key={value}
                        style={[
                          styles.chip,
                          form.pickupDelay === value &&
                            styles.chipSelected,
                        ]}
                        onPress={() =>
                          updateForm({ pickupDelay: value })
                        }
                      >
                        <Text
                          style={[
                            styles.chipText,
                            form.pickupDelay === value &&
                              styles.chipSelectedText,
                          ]}
                        >
                          {label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={styles.label}>
                    Khoảng thời gian nhận
                  </Text>
                  <View style={styles.wrap}>
                    {['1', '2', '3', '4', '6'].map((hours) => (
                      <Pressable
                        key={hours}
                        style={[
                          styles.chip,
                          form.pickupHours === hours &&
                            styles.chipSelected,
                        ]}
                        onPress={() =>
                          updateForm({ pickupHours: hours })
                        }
                      >
                        <Text
                          style={[
                            styles.chipText,
                            form.pickupHours === hours &&
                              styles.chipSelectedText,
                          ]}
                        >
                          {hours} giờ
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <View style={styles.pickupSummary}>
                    <Text style={styles.muted}>Bắt đầu nhận</Text>
                    <Text style={styles.summaryValue}>
                      {displayDate(pickupStart)}
                    </Text>
                    <View style={styles.divider} />
                    <Text style={styles.muted}>Kết thúc nhận</Text>
                    <Text style={styles.summaryValue}>
                      {displayDate(pickupEnd)}
                    </Text>
                  </View>
                </>
              ) : (
                <>
                  <DateTimeField
                    label="Bắt đầu nhận *"
                    value={form.pickupStart}
                    onChange={(pickupStartText) =>
                      updateForm({ pickupStart: pickupStartText })
                    }
                    onChooseTime={chooseTime}
                  />

                  <DateTimeField
                    label="Kết thúc nhận *"
                    value={form.pickupEnd}
                    onChange={(pickupEndText) =>
                      updateForm({ pickupEnd: pickupEndText })
                    }
                    onChooseTime={chooseTime}
                  />
                </>
              )}

              <View style={styles.divider} />

              <InputField
                label="Thông tin dị ứng *"
                value={form.allergyInfo}
                onChange={(allergyInfo) =>
                  updateForm({ allergyInfo })
                }
                placeholder="Ví dụ: Có thể chứa sữa, trứng, gluten"
                maxLength={1000}
                multiline
              />

              <InputField
                label="Hướng dẫn bảo quản *"
                value={form.storageInstruction}
                onChange={(storageInstruction) =>
                  updateForm({ storageInstruction })
                }
                placeholder="Ví dụ: Bảo quản mát, sử dụng trong ngày"
                maxLength={1000}
                multiline
              />

              {!!formError && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>
                    {formError}
                  </Text>
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
                  title={
                    saving
                      ? 'Đang tạo...'
                      : 'Tạo SaviBite Box'
                  }
                  disabled={saving}
                  onPress={() => void createBox()}
                />
              </View>
            </ScrollView>

            {/* Popup giờ/phút dạng card nổi, không đẩy form xuống */}
            {timePicker && (
              <View style={styles.timeOverlay}>
                <Pressable
                  style={StyleSheet.absoluteFill}
                  onPress={() => setTimePicker(null)}
                />

                <View style={styles.timeCard}>
                  <View style={styles.heading}>
                    <View style={styles.flex}>
                      <Text style={styles.sectionTitle}>
                        {timePicker.part === 'hour'
                          ? 'Chọn giờ (24h)'
                          : 'Chọn phút'}
                      </Text>
                      <Text style={styles.muted}>
                        {timePicker.part === 'hour'
                          ? '00 – 23'
                          : '00 – 59'}
                      </Text>
                    </View>

                    <Pressable
                      onPress={() => setTimePicker(null)}
                    >
                      <Ionicons
                        name="close"
                        size={23}
                        color={colors.text}
                      />
                    </Pressable>
                  </View>

                  <ScrollView
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="always"
                    style={styles.timeScroll}
                    contentContainerStyle={styles.timeGrid}
                  >
                    {(timePicker.part === 'hour'
                      ? HOURS
                      : MINUTES
                    ).map((value) => {
                      const selected =
                        timePicker.selected === value;

                      return (
                        <Pressable
                          key={value}
                          style={[
                            styles.timeCell,
                            selected && styles.timeCellSelected,
                          ]}
                          onPress={() => {
                            timePicker.onSelect(value);
                            setTimePicker(null);
                          }}
                        >
                          <Text
                            style={[
                              styles.timeCellText,
                              selected && styles.timeCellSelectedText,
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
    fontWeight: '700',
    fontSize: 14,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  flex: {
    flex: 1,
    gap: spacing.xs,
  },
  eyebrow: {
    color: colors.eco,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
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
  shopBanner: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  shopName: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  panel: {
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    gap: spacing.lg,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  chipSelectedText: {
    color: colors.white,
  },
  successBox: {
    backgroundColor: '#EAF6E4',
    padding: spacing.lg,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  successText: {
    color: colors.eco,
    fontWeight: '700',
    fontSize: 13,
    flex: 1,
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
  empty: {
    minHeight: 200,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  boxGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  boxCard: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.md,
  },
  boxIcon: {
    width: 58,
    height: 58,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  discountBadge: {
    backgroundColor: '#EAF6E4',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  discountBadgeText: {
    color: colors.eco,
    fontWeight: '800',
    fontSize: 12,
  },
  oldPrice: {
    color: colors.textMuted,
    fontSize: 13,
    textDecorationLine: 'line-through',
  },
  price: {
    color: colors.primary,
    fontSize: 23,
    fontWeight: '800',
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: spacing.lg,
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
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
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
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  field: {
    gap: spacing.sm,
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  miniLabel: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    minHeight: 48,
    fontSize: 14,
    color: colors.text,
  },
  multiline: {
    minHeight: 84,
  },
  columns: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  column: {
    flex: 1,
    minWidth: 160,
  },
  discountSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: '#EAF6E4',
  },
  discountSummaryText: {
    color: colors.eco,
    fontWeight: '800',
    fontSize: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  modeChoice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  modeSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceMuted,
  },
  choiceTitle: {
    fontWeight: '800',
    color: colors.text,
    fontSize: 14,
  },
  dateRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  dateColumn: {
    flex: 2,
    minWidth: 160,
    gap: spacing.sm,
  },
  clockColumn: {
    flex: 1,
    minWidth: 170,
    gap: spacing.sm,
  },
  dateButton: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
  },
  dateText: {
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
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  clockText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  colon: {
    fontSize: 21,
    color: colors.text,
    fontWeight: '800',
  },
  nativeCalendar: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  doneButton: {
    padding: spacing.md,
    alignSelf: 'flex-end',
  },
  doneText: {
    color: colors.primary,
    fontWeight: '800',
  },
  timeSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: '#EAF6E4',
  },
  timeSummaryValue: {
    color: colors.eco,
    fontWeight: '800',
    fontSize: 17,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  pickupSummary: {
    padding: spacing.lg,
    borderRadius: radius.md,
    gap: spacing.md,
    backgroundColor: colors.surfaceMuted,
  },
  summaryValue: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 17,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: spacing.md,
  },
  timeOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 100,
    elevation: 30,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(15,23,42,0.24)',
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  timeCard: {
    width: '100%',
    maxWidth: 390,
    maxHeight: '85%',
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    gap: spacing.md,
    elevation: 32,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
  },
  timeScroll: {
    maxHeight: 320,
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  timeCell: {
    width: '22%',
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  timeCellSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  timeCellText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  timeCellSelectedText: {
    color: colors.white,
  },
});

export default requireAccess(SaviBiteBoxesScreen, 'login');
