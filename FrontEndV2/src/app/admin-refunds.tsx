
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
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
} from 'react-native';

import { ENV } from '../config/env';
import { useAuth } from '../features/auth/context/AuthProvider';
import CustomerLayout from '../shared/components/layout/CustomerLayout';
import ScreenContainer from '../shared/components/layout/ScreenContainer';
import AppButton from '../shared/components/ui/AppButton';
import { colors, radius, spacing } from '../shared/theme';

type Dict = Record<string, unknown>;
type Filter = 'PENDING' | 'APPROVED' | 'REJECTED';
type Decision = 'approve' | 'reject';

type Evidence = {
  id: string;
  fileName: string;
  mimeType: string | null;
};

type EvidenceImage = {
  id: string;
  uri: string | null;
  loading: boolean;
  error: string;
};

type Refund = {
  id: string;
  orderId: string;
  orderCode: string;
  customerName: string;
  customerEmail: string;
  shopName: string;
  status: string;
  orderStatus: string;
  paymentStatus: string;
  reason: string;
  requestedAmount: number | null;
  approvedAmount: number | null;
  orderTotal: number | null;
  resolutionNote: string;
  createdAt: string | null;
  deadlineAt: string | null;
  resolvedAt: string | null;
  evidences: Evidence[];
  evidenceCount: number | null;
  historyCount: number | null;
};

const PAGE_SIZE = 10;

function obj(value: unknown): Dict | null {
  return value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
    ? (value as Dict)
    : null;
}

function str(value: unknown, ...keys: string[]): string | null {
  const source = obj(value);
  if (!source) return null;

  for (const key of keys) {
    const field = source[key];

    if (typeof field === 'string' && field.trim()) {
      return field.trim();
    }
  }

  return null;
}

function num(value: unknown, ...keys: string[]): number | null {
  const source = obj(value);
  if (!source) return null;

  for (const key of keys) {
    const field = source[key];

    if (typeof field === 'number' && Number.isFinite(field)) {
      return field;
    }

    if (
      typeof field === 'string' &&
      /^\d+(\.\d+)?$/.test(field.trim())
    ) {
      const parsed = Number(field);
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return null;
}

function unwrap(value: unknown): unknown {
  const source = obj(value);
  return source && 'data' in source ? source.data : value;
}

function itemsOf(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;

  const source = obj(value);
  if (!source) return [];

  for (const key of [
    'items',
    'refundRequests',
    'refunds',
    'results',
    'records',
  ]) {
    if (Array.isArray(source[key])) {
      return source[key] as unknown[];
    }
  }

  return 'data' in source ? itemsOf(source.data) : [];
}

function normalizeEvidence(value: unknown): Evidence | null {
  const source = obj(value);
  if (!source) return null;

  const id = str(source, 'id', 'evidenceId');
  if (!id) return null;

  return {
    id,
    fileName:
      str(
        source,
        'fileName',
        'originalFileName',
        'name'
      ) ?? 'Ảnh bằng chứng',
    mimeType:
      str(source, 'contentType', 'mimeType'),
  };
}

function normalizeRefund(value: unknown): Refund | null {
  const root = obj(value);
  if (!root) return null;

  const source =
    obj(root.refund) ??
    obj(root.refundRequest) ??
    root;

  const id = str(
    source,
    'id',
    'refundId',
    'refundRequestId'
  );

  if (!id) return null;

  const customer = obj(source.customer);
  const shop = obj(source.shop);
  const order = obj(source.order);

  const rawEvidences = Array.isArray(source.evidences)
    ? source.evidences
    : null;

  const evidences = (rawEvidences ?? [])
    .map(normalizeEvidence)
    .filter((item): item is Evidence => item !== null);

  return {
    id,

    orderId:
      str(source, 'orderId') ??
      str(order, 'id') ??
      '',

    orderCode:
      str(source, 'orderNumber', 'orderCode') ??
      str(root, 'orderNumber', 'orderCode') ??
      str(order, 'orderNumber', 'orderCode', 'code') ??
      'Chưa có mã đơn',

    customerName:
      str(root, 'customerName') ??
      str(source, 'customerName', 'userName') ??
      str(customer, 'fullName', 'name') ??
      'Chưa có tên khách hàng',

    customerEmail:
      str(root, 'customerEmail') ??
      str(source, 'customerEmail') ??
      str(customer, 'email') ??
      '',

    shopName:
      str(source, 'shopName') ??
      str(root, 'shopName') ??
      str(shop, 'name') ??
      'Chưa có cửa hàng',

    status:
      str(source, 'status') ?? 'PENDING',

    orderStatus:
      str(root, 'orderStatus') ??
      str(source, 'orderStatus') ??
      '',

    paymentStatus:
      str(root, 'paymentStatus') ??
      str(source, 'paymentStatus') ??
      '',

    reason:
      str(source, 'reason') ?? '',

    requestedAmount:
      num(source, 'requestedAmount'),

    approvedAmount:
      num(source, 'approvedAmount'),

    orderTotal:
      num(root, 'orderTotal') ??
      num(source, 'orderTotal'),

    resolutionNote:
      str(
        source,
        'resolutionNote',
        'reviewNote',
        'adminNote'
      ) ?? '',

    createdAt:
      str(source, 'createdAt', 'requestedAt'),

    deadlineAt:
      str(source, 'deadlineAt'),

    resolvedAt:
      str(source, 'resolvedAt'),

    evidences,

    evidenceCount:
      rawEvidences !== null
        ? rawEvidences.length
        : num(source, 'evidenceCount'),

    historyCount:
      Array.isArray(root.history)
        ? root.history.length
        : null,
  };
}

function mergeRefund(summary: Refund, detail: Refund): Refund {
  return {
    ...detail,
    orderId: detail.orderId || summary.orderId,

    orderCode:
      detail.orderCode !== 'Chưa có mã đơn'
        ? detail.orderCode
        : summary.orderCode,

    customerName:
      detail.customerName !== 'Chưa có tên khách hàng'
        ? detail.customerName
        : summary.customerName,

    customerEmail:
      detail.customerEmail || summary.customerEmail,

    shopName:
      detail.shopName !== 'Chưa có cửa hàng'
        ? detail.shopName
        : summary.shopName,

    reason:
      detail.reason || summary.reason,

    requestedAmount:
      detail.requestedAmount ?? summary.requestedAmount,

    approvedAmount:
      detail.approvedAmount ?? summary.approvedAmount,

    orderTotal:
      detail.orderTotal ?? summary.orderTotal,

    createdAt:
      detail.createdAt ?? summary.createdAt,

    evidenceCount:
      detail.evidenceCount ?? summary.evidenceCount,
  };
}

function getPagination(
  value: unknown,
  page: number,
  count: number
) {
  const source = obj(value);
  const info = obj(source?.pagination) ?? obj(source?.meta);

  const pages =
    num(source, 'totalPages', 'pageCount') ??
    num(info, 'totalPages', 'pageCount');

  const total =
    num(source, 'total', 'totalCount', 'totalItems') ??
    num(info, 'total', 'totalCount', 'totalItems');

  const next =
    typeof source?.hasNextPage === 'boolean'
      ? source.hasNextPage
      : typeof info?.hasNextPage === 'boolean'
        ? info.hasNextPage
        : null;

  return {
    pages:
      pages ??
      (total !== null
        ? Math.max(1, Math.ceil(total / PAGE_SIZE))
        : null),

    next:
      next ??
      (pages !== null
        ? page < pages
        : total !== null
          ? page * PAGE_SIZE < total
          : count === PAGE_SIZE),
  };
}

async function parseResponse(response: Response): Promise<unknown> {
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

  const root = obj(json);

  if (!response.ok || root?.success === false) {
    const error = obj(root?.error);

    throw new Error(
      str(error, 'message', 'detail') ??
      str(root, 'message', 'detail') ??
      `Backend trả về HTTP ${response.status}.`
    );
  }

  return unwrap(json);
}

function money(value: number | null): string {
  if (value === null) return 'Chưa có thông tin';

  return new Intl.NumberFormat('vi-VN', {
    currency: 'VND',
    style: 'currency',
    maximumFractionDigits: 0,
  }).format(value);
}

function dateText(value: string | null): string {
  if (!value) return 'Chưa có thông tin';

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('vi-VN', {
        hour12: false,
      });
}

function statusLabel(value: string): string {
  switch (value.toUpperCase()) {
    case 'PENDING':
      return 'Chờ xử lý';
    case 'APPROVED':
      return 'Đã duyệt';
    case 'REJECTED':
      return 'Đã từ chối';
    case 'REFUND_REQUESTED':
      return 'Đã yêu cầu hoàn tiền';
    case 'PAID':
      return 'Đã thanh toán';
    case 'COMPLETED':
      return 'Hoàn thành';
    default:
      return value || 'Chưa xác định';
  }
}

function DetailLine({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailLine}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

/**
 * Đọc ảnh có Authorization.
 * Web: tạo blob URL cục bộ, không đưa token vào URL.
 * Native: dùng FileReader để chuyển blob sang data URI.
 */
async function createImageUri(response: Response): Promise<string> {
  if (!response.ok) {
    const text = await response.text();
    let message = `Không thể tải ảnh (HTTP ${response.status}).`;

    try {
      const json = JSON.parse(text);
      const root = obj(json);
      const error = obj(root?.error);

      message =
        str(error, 'message') ??
        str(root, 'message') ??
        message;
    } catch {
      // Có thể Backend trả về văn bản thay vì JSON.
    }

    throw new Error(message);
  }

  const contentType =
    response.headers.get('content-type') ?? '';

  // Swagger chưa công bố media type.
  // Chỉ chấp nhận nội dung ảnh; không tạo URI từ JSON lỗi.
  if (
    contentType &&
    !contentType.toLowerCase().startsWith('image/') &&
    !contentType.toLowerCase().startsWith('application/octet-stream')
  ) {
    throw new Error(
      `API trả về ${contentType}, không phải dữ liệu ảnh.`
    );
  }

  const blob = await response.blob();

  if (blob.size === 0) {
    throw new Error('Backend trả về ảnh rỗng.');
  }

  if (Platform.OS === 'web') {
    return URL.createObjectURL(blob);
  }

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Không chuyển được dữ liệu ảnh.'));
      }
    };

    reader.onerror = () => {
      reject(new Error('Không đọc được dữ liệu ảnh.'));
    };

    reader.readAsDataURL(blob);
  });
}

export default function AdminRefundsScreen() {
  const router = useRouter();
  const { status, user, getAccessToken } = useAuth();

  const isAdmin =
    status === 'authenticated' &&
    user?.systemRole?.toUpperCase() === 'ADMIN';

  const [filter, setFilter] = useState<Filter>('PENDING');
  const [keyword, setKeyword] = useState('');
  const [appliedKeyword, setAppliedKeyword] = useState('');

  const [requests, setRequests] = useState<Refund[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState<number | null>(null);
  const [hasNext, setHasNext] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailReady, setDetailReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [modalError, setModalError] = useState('');

  const [selected, setSelected] = useState<Refund | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [note, setNote] = useState('');
  const [approvedAmount, setApprovedAmount] = useState('');

  const [evidenceImages, setEvidenceImages] =
    useState<EvidenceImage[]>([]);

  const [previewImage, setPreviewImage] =
    useState<string | null>(null);

  const detailVersionRef = useRef(0);
  const imageUrlsRef = useRef<string[]>([]);

  /**
   * Thu hồi các blob URL cũ khi đổi yêu cầu.
   */
  const clearImageUrls = useCallback(() => {
    if (Platform.OS === 'web') {
      for (const uri of imageUrlsRef.current) {
        URL.revokeObjectURL(uri);
      }
    }

    imageUrlsRef.current = [];
    setEvidenceImages([]);
    setPreviewImage(null);
  }, []);

  useEffect(() => {
    return () => {
      detailVersionRef.current += 1;

      if (Platform.OS === 'web') {
        for (const uri of imageUrlsRef.current) {
          URL.revokeObjectURL(uri);
        }
      }

      imageUrlsRef.current = [];
    };
  }, []);

  const api = useCallback(
    async (
      path: string,
      method: 'GET' | 'POST' = 'GET',
      body?: Dict
    ): Promise<unknown> => {
      const token = await getAccessToken();

      if (!token) {
        throw new Error('Phiên đăng nhập đã hết hạn.');
      }

      const response = await fetch(
        `${ENV.apiUrl.replace(/\/+$/, '')}${path}`,
        {
          method,
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
            ...(body
              ? { 'Content-Type': 'application/json' }
              : {}),
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        }
      );

      return parseResponse(response);
    },
    [getAccessToken]
  );

  const loadRequests = useCallback(
    async (
      targetPage: number,
      targetFilter: Filter,
      targetKeyword: string
    ) => {
      if (!isAdmin) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const query = new URLSearchParams({
          status: targetFilter,
          page: String(targetPage),
          limit: String(PAGE_SIZE),
        });

        if (targetKeyword.trim()) {
          query.set('keyword', targetKeyword.trim());
        }

        const data = await api(
          `/api/admin/refund-requests?${query.toString()}`
        );

        const rawItems = itemsOf(data);

        const normalized = rawItems
          .map(normalizeRefund)
          .filter(
            (item): item is Refund => item !== null
          );

        const pagination = getPagination(
          data,
          targetPage,
          rawItems.length
        );

        setRequests(normalized);
        setPage(targetPage);
        setPages(pagination.pages);
        setHasNext(pagination.next);

        if (
          rawItems.length > 0 &&
          normalized.length === 0
        ) {
          setError(
            'Không nhận diện được danh sách hoàn tiền từ Backend.'
          );
        }
      } catch (caught: unknown) {
        setRequests([]);

        setError(
          caught instanceof Error
            ? caught.message
            : 'Không thể tải danh sách hoàn tiền.'
        );
      } finally {
        setLoading(false);
      }
    },
    [api, isAdmin]
  );

  useEffect(() => {
    void loadRequests(1, filter, appliedKeyword);
  }, [filter, appliedKeyword, loadRequests]);

  /**
   * Lấy ảnh theo refundId và evidenceId.
   * Không truyền URL ảnh trực tiếp vào Image
   * vì endpoint cần Authorization Bearer.
   */
  const loadEvidenceImages = useCallback(
    async (
      refund: Refund,
      version: number
    ) => {
      if (refund.evidences.length === 0) {
        setEvidenceImages([]);
        return;
      }

      setEvidenceImages(
        refund.evidences.map((evidence) => ({
          id: evidence.id,
          uri: null,
          loading: true,
          error: '',
        }))
      );

      const token = await getAccessToken();

      if (!token) {
        if (detailVersionRef.current === version) {
          setEvidenceImages(
            refund.evidences.map((evidence) => ({
              id: evidence.id,
              uri: null,
              loading: false,
              error: 'Phiên đăng nhập đã hết hạn.',
            }))
          );
        }
        return;
      }

      await Promise.all(
        refund.evidences.map(async (evidence) => {
          let uri: string | null = null;

          try {
            const path =
              `/api/refund-requests/${encodeURIComponent(refund.id)}` +
              `/evidences/${encodeURIComponent(evidence.id)}/image`;

            const response = await fetch(
              `${ENV.apiUrl.replace(/\/+$/, '')}${path}`,
              {
                headers: {
                  Accept: 'image/*,application/octet-stream',
                  Authorization: `Bearer ${token}`,
                },
              }
            );

            uri = await createImageUri(response);

            if (detailVersionRef.current !== version) {
              if (Platform.OS === 'web') {
                URL.revokeObjectURL(uri);
              }
              return;
            }

            if (Platform.OS === 'web') {
              imageUrlsRef.current.push(uri);
            }

            setEvidenceImages((current) =>
              current.map((item) =>
                item.id === evidence.id
                  ? {
                      ...item,
                      uri,
                      loading: false,
                      error: '',
                    }
                  : item
              )
            );
          } catch (caught: unknown) {
            if (detailVersionRef.current !== version) return;

            setEvidenceImages((current) =>
              current.map((item) =>
                item.id === evidence.id
                  ? {
                      ...item,
                      loading: false,
                      error:
                        caught instanceof Error
                          ? caught.message
                          : 'Không thể tải ảnh bằng chứng.',
                    }
                  : item
              )
            );
          }
        })
      );
    },
    [getAccessToken]
  );

  const openDetail = async (summary: Refund) => {
    const version = ++detailVersionRef.current;

    clearImageUrls();

    setSelected(summary);
    setDecision(null);
    setNote('');
    setApprovedAmount('');
    setModalError('');
    setDetailReady(false);
    setLoadingDetail(true);

    try {
      const data = await api(
        `/api/admin/refund-requests/${encodeURIComponent(summary.id)}`
      );

      if (detailVersionRef.current !== version) return;

      const detail = normalizeRefund(data);

      if (!detail) {
        throw new Error(
          'Backend trả về chi tiết hoàn tiền không hợp lệ.'
        );
      }

      if (detail.id !== summary.id) {
        throw new Error(
          'Mã yêu cầu hoàn tiền không khớp với danh sách.'
        );
      }

      const merged = mergeRefund(summary, detail);

      setSelected(merged);
      setDetailReady(true);

      // Tải ảnh ở bước riêng; lỗi tải ảnh
      // không làm mất thông tin yêu cầu.
      void loadEvidenceImages(merged, version);
    } catch (caught: unknown) {
      if (detailVersionRef.current !== version) return;

      setModalError(
        caught instanceof Error
          ? caught.message
          : 'Không thể tải chi tiết hoàn tiền.'
      );
    } finally {
      if (detailVersionRef.current === version) {
        setLoadingDetail(false);
      }
    }
  };

  const closeDetail = () => {
    if (submitting) return;

    detailVersionRef.current += 1;
    clearImageUrls();

    setSelected(null);
    setDecision(null);
    setDetailReady(false);
    setModalError('');
  };

  const startDecision = (nextDecision: Decision) => {
    if (
      !selected ||
      !detailReady ||
      selected.status.toUpperCase() !== 'PENDING'
    ) {
      return;
    }

    setDecision(nextDecision);
    setNote('');
    setModalError('');

    setApprovedAmount(
      nextDecision === 'approve' &&
      selected.requestedAmount !== null
        ? String(selected.requestedAmount)
        : ''
    );
  };

  const cleanAmount = approvedAmount.trim();

  const amountValid =
    decision !== 'approve' ||
    cleanAmount === '' ||
    (
      /^\d+(\.\d{1,2})?$/.test(cleanAmount) &&
      Number(cleanAmount) > 0 &&
      (
        selected?.requestedAmount == null ||
        Number(cleanAmount) <= selected.requestedAmount
      )
    );

  const decisionValid =
    !!selected &&
    detailReady &&
    !loadingDetail &&
    !submitting &&
    !!decision &&
    selected.status.toUpperCase() === 'PENDING' &&
    note.trim().length >= 10 &&
    note.trim().length <= 2000 &&
    amountValid;

  const submitDecision = async () => {
    if (
      !selected ||
      !decision ||
      !decisionValid ||
      submitting
    ) {
      return;
    }

    const refundId = selected.id;
    const action = decision;

    setSubmitting(true);
    setModalError('');

    try {
      await api(
        `/api/admin/refund-requests/${encodeURIComponent(refundId)}/${action}`,
        'POST',
        {
          note: note.trim(),
          approvedAmount:
            action === 'approve' && cleanAmount
              ? Number(cleanAmount)
              : null,
        }
      );

      detailVersionRef.current += 1;
      clearImageUrls();

      setSelected(null);
      setDecision(null);
      setDetailReady(false);

      setNotice(
        action === 'approve'
          ? 'Backend đã phê duyệt yêu cầu hoàn tiền.'
          : 'Backend đã từ chối yêu cầu hoàn tiền.'
      );

      await loadRequests(page, filter, appliedKeyword);
    } catch (caught: unknown) {
      setModalError(
        caught instanceof Error
          ? caught.message
          : 'Không thể xử lý yêu cầu hoàn tiền.'
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
            color={colors.primary}
            size="large"
          />
        </ScreenContainer>
      </CustomerLayout>
    );
  }

  if (!isAdmin) {
    return (
      <CustomerLayout>
        <ScreenContainer style={styles.center}>
          <Ionicons
            name="shield-outline"
            size={40}
            color={colors.primary}
          />
          <Text style={styles.title}>Chỉ dành cho ADMIN</Text>
          <Text style={styles.muted}>
            Bạn cần tài khoản quản trị để xử lý hoàn tiền.
          </Text>
          <AppButton
            title="Về trang chủ"
            onPress={() => router.push('/')}
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
          onPress={() => router.push('/')}
        >
          <Ionicons
            name="arrow-back"
            size={18}
            color={colors.primary}
          />
          <Text style={styles.link}>
            Quay lại trang chủ
          </Text>
        </Pressable>

        <View style={styles.heading}>
          <Ionicons
            name="shield-checkmark-outline"
            size={35}
            color={colors.primary}
          />
          <Text style={styles.eyebrow}>
            SAVIBITE · ADMIN REFUNDS
          </Text>
          <Text style={styles.title}>
            Quản lý yêu cầu hoàn tiền
          </Text>
          <Text style={styles.muted}>
            Kiểm tra lý do, số tiền, thanh toán
            và ảnh bằng chứng trước khi đưa ra quyết định.
          </Text>
        </View>

        {!!notice && (
          <View style={styles.successBox}>
            <Text style={styles.successText}>{notice}</Text>
          </View>
        )}

        {!!error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>
            Danh sách yêu cầu
          </Text>

          <View style={styles.filterRow}>
            {([
              ['PENDING', 'Chờ xử lý'],
              ['APPROVED', 'Đã duyệt'],
              ['REJECTED', 'Đã từ chối'],
            ] as [Filter, string][]).map(([value, label]) => (
              <Pressable
                key={value}
                style={[
                  styles.filterChip,
                  filter === value && styles.filterActive,
                ]}
                onPress={() => {
                  setFilter(value);
                  setNotice('');
                }}
              >
                <Text
                  style={[
                    styles.filterText,
                    filter === value && styles.filterTextActive,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.searchRow}>
            <View style={styles.searchBox}>
              <Ionicons
                name="search-outline"
                size={19}
                color={colors.textMuted}
              />
              <TextInput
                style={styles.searchInput}
                value={keyword}
                onChangeText={setKeyword}
                placeholder="Tìm mã đơn, khách hàng..."
                placeholderTextColor={colors.textMuted}
                onSubmitEditing={() =>
                  setAppliedKeyword(keyword.trim())
                }
              />
            </View>

            <AppButton
              title="Tìm kiếm"
              onPress={() =>
                setAppliedKeyword(keyword.trim())
              }
            />

            <AppButton
              title="Làm mới"
              variant="outline"
              disabled={loading}
              onPress={() =>
                void loadRequests(page, filter, appliedKeyword)
              }
            />
          </View>

          {loading ? (
            <View style={styles.empty}>
              <ActivityIndicator
                size="large"
                color={colors.primary}
              />
              <Text style={styles.muted}>
                Đang tải yêu cầu hoàn tiền...
              </Text>
            </View>
          ) : requests.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons
                name="documents-outline"
                size={38}
                color={colors.textMuted}
              />
              <Text style={styles.sectionTitle}>
                Không có yêu cầu
              </Text>
              <Text style={styles.muted}>
                Chưa có dữ liệu phù hợp với bộ lọc.
              </Text>
            </View>
          ) : (
            <View style={styles.list}>
              {requests.map((refund) => (
                <View
                  key={refund.id}
                  style={styles.refundCard}
                >
                  <View style={styles.toolbar}>
                    <View style={styles.flex}>
                      <Text style={styles.smallLabel}>
                        MÃ ĐƠN
                      </Text>
                      <Text style={styles.orderCode}>
                        {refund.orderCode}
                      </Text>
                    </View>

                    <Text style={styles.status}>
                      {statusLabel(refund.status)}
                    </Text>
                  </View>

                  <DetailLine
                    label="Khách hàng"
                    value={refund.customerName}
                  />
                  <DetailLine
                    label="Cửa hàng"
                    value={refund.shopName}
                  />
                  <DetailLine
                    label="Số tiền yêu cầu"
                    value={money(refund.requestedAmount)}
                  />

                  {!!refund.createdAt && (
                    <Text style={styles.muted}>
                      {dateText(refund.createdAt)}
                    </Text>
                  )}

                  <AppButton
                    title="Xem và xử lý"
                    variant="outline"
                    onPress={() => void openDetail(refund)}
                  />
                </View>
              ))}
            </View>
          )}

          <View style={styles.toolbar}>
            <Text style={styles.muted}>
              Trang {page}
              {pages !== null ? ` / ${pages}` : ''}
            </Text>

            <View style={styles.actions}>
              <AppButton
                title="Trước"
                variant="outline"
                disabled={loading || page <= 1}
                onPress={() =>
                  void loadRequests(page - 1, filter, appliedKeyword)
                }
              />
              <AppButton
                title="Tiếp"
                variant="outline"
                disabled={loading || !hasNext}
                onPress={() =>
                  void loadRequests(page + 1, filter, appliedKeyword)
                }
              />
            </View>
          </View>
        </View>
      </ScreenContainer>

      <Modal
        visible={selected !== null}
        transparent
        animationType="fade"
        onRequestClose={closeDetail}
      >
        <View style={styles.backdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={closeDetail}
          />

          <View style={styles.modal}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.modalBody}
            >
              <View style={styles.toolbar}>
                <View style={styles.flex}>
                  <Text style={styles.sectionTitle}>
                    Chi tiết hoàn tiền
                  </Text>
                  <Text style={styles.muted}>
                    {selected?.orderCode}
                  </Text>
                </View>

                <Pressable
                  disabled={submitting}
                  onPress={closeDetail}
                >
                  <Ionicons
                    name="close"
                    size={23}
                    color={colors.textSecondary}
                  />
                </Pressable>
              </View>

              {loadingDetail ? (
                <ActivityIndicator color={colors.primary} />
              ) : selected && (
                <>
                  <Text style={styles.status}>
                    {statusLabel(selected.status)}
                  </Text>

                  <View style={styles.detailPanel}>
                    <DetailLine
                      label="Mã yêu cầu hoàn tiền"
                      value={selected.id}
                    />
                    <DetailLine
                      label="Khách hàng"
                      value={selected.customerName}
                    />

                    {!!selected.customerEmail && (
                      <DetailLine
                        label="Email"
                        value={selected.customerEmail}
                      />
                    )}

                    <DetailLine
                      label="Cửa hàng"
                      value={selected.shopName}
                    />
                    <DetailLine
                      label="Số tiền yêu cầu"
                      value={money(selected.requestedAmount)}
                    />

                    {selected.orderTotal !== null && (
                      <DetailLine
                        label="Tổng giá trị đơn"
                        value={money(selected.orderTotal)}
                      />
                    )}

                    {selected.approvedAmount !== null && (
                      <DetailLine
                        label="Số tiền phê duyệt"
                        value={money(selected.approvedAmount)}
                      />
                    )}

                    {!!selected.orderStatus && (
                      <DetailLine
                        label="Trạng thái đơn"
                        value={statusLabel(selected.orderStatus)}
                      />
                    )}

                    {!!selected.paymentStatus && (
                      <DetailLine
                        label="Thanh toán"
                        value={statusLabel(selected.paymentStatus)}
                      />
                    )}

                    <DetailLine
                      label="Ngày yêu cầu"
                      value={dateText(selected.createdAt)}
                    />
                    <DetailLine
                      label="Thời hạn ghi nhận"
                      value={dateText(selected.deadlineAt)}
                    />

                    {selected.resolvedAt && (
                      <DetailLine
                        label="Ngày xử lý"
                        value={dateText(selected.resolvedAt)}
                      />
                    )}

                    <Text style={styles.label}>
                      Lý do hoàn tiền
                    </Text>
                    <Text style={styles.detailText}>
                      {selected.reason || 'Backend chưa cung cấp.'}
                    </Text>

                    {!!selected.resolutionNote && (
                      <>
                        <Text style={styles.label}>
                          Ghi chú giải quyết
                        </Text>
                        <Text style={styles.detailText}>
                          {selected.resolutionNote}
                        </Text>
                      </>
                    )}

                    <View style={styles.evidenceSection}>
                      <View style={styles.toolbar}>
                        <Text style={styles.label}>
                          Ảnh bằng chứng
                        </Text>
                        <Text style={styles.detailValue}>
                          {selected.evidenceCount !== null
                            ? selected.evidenceCount
                            : 'Chưa rõ'}
                        </Text>
                      </View>

                      {selected.evidences.length === 0 ? (
                        <View style={styles.noEvidence}>
                          <Ionicons
                            name="images-outline"
                            size={25}
                            color={colors.textMuted}
                          />
                          <Text style={styles.muted}>
                            Backend hiện trả về danh sách
                            bằng chứng rỗng.
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.evidenceGrid}>
                          {selected.evidences.map((evidence) => {
                            const imageState = evidenceImages.find(
                              (item) => item.id === evidence.id
                            );

                            return (
                              <View
                                key={evidence.id}
                                style={styles.evidenceTile}
                              >
                                {imageState?.loading ? (
                                  <View style={styles.imagePlaceholder}>
                                    <ActivityIndicator
                                      color={colors.primary}
                                    />
                                  </View>
                                ) : imageState?.uri ? (
                                  <Pressable
                                    onPress={() =>
                                      setPreviewImage(
                                        imageState.uri
                                      )
                                    }
                                  >
                                    <Image
                                      source={{
                                        uri: imageState.uri,
                                      }}
                                      style={styles.evidencePreview}
                                      resizeMode="cover"
                                    />
                                    <Text style={styles.previewHint}>
                                      Nhấn để phóng to
                                    </Text>
                                  </Pressable>
                                ) : (
                                  <View style={styles.imagePlaceholder}>
                                    <Ionicons
                                      name="image-outline"
                                      size={27}
                                      color={colors.textMuted}
                                    />
                                  </View>
                                )}

                                <Text
                                  style={styles.fileName}
                                  numberOfLines={2}
                                >
                                  {evidence.fileName}
                                </Text>

                                {!!imageState?.error && (
                                  <Text style={styles.imageError}>
                                    {imageState.error}
                                  </Text>
                                )}
                              </View>
                            );
                          })}
                        </View>
                      )}
                    </View>

                    {selected.historyCount !== null && (
                      <DetailLine
                        label="Số sự kiện lịch sử"
                        value={String(selected.historyCount)}
                      />
                    )}
                  </View>

                  {detailReady &&
                    selected.status.toUpperCase() === 'PENDING' &&
                    !decision && (
                      <View style={styles.actions}>
                        <AppButton
                          title="Từ chối"
                          variant="outline"
                          onPress={() => startDecision('reject')}
                        />
                        <AppButton
                          title="Phê duyệt"
                          onPress={() => startDecision('approve')}
                        />
                      </View>
                    )}

                  {decision && (
                    <View style={styles.decisionPanel}>
                      <Text style={styles.sectionTitle}>
                        {decision === 'approve'
                          ? 'Xác nhận phê duyệt'
                          : 'Xác nhận từ chối'}
                      </Text>

                      {selected.evidenceCount === 0 && (
                        <View style={styles.warningBox}>
                          <Ionicons
                            name="alert-circle-outline"
                            size={19}
                            color="#895A00"
                          />
                          <Text style={styles.warningText}>
                            Yêu cầu này không có ảnh bằng chứng.
                            Hãy xác minh thông tin trước khi xử lý.
                          </Text>
                        </View>
                      )}

                      <Text style={styles.muted}>
                        Quyết định sẽ được gửi tới Backend
                        và làm thay đổi trạng thái yêu cầu.
                      </Text>

                      {decision === 'approve' && (
                        <View style={styles.field}>
                          <Text style={styles.label}>
                            Số tiền phê duyệt (VNĐ)
                          </Text>

                          <TextInput
                            value={approvedAmount}
                            onChangeText={setApprovedAmount}
                            style={styles.input}
                            keyboardType="decimal-pad"
                            editable={!submitting}
                            placeholder="Để trống nếu không chỉ định"
                            placeholderTextColor={colors.textMuted}
                          />

                          <Text style={styles.muted}>
                            Không vượt số tiền yêu cầu.
                            Nếu để trống, gửi approvedAmount = null.
                          </Text>
                        </View>
                      )}

                      <View style={styles.field}>
                        <Text style={styles.label}>
                          Ghi chú xử lý *
                        </Text>

                        <TextInput
                          style={styles.textarea}
                          multiline
                          maxLength={2000}
                          textAlignVertical="top"
                          value={note}
                          onChangeText={setNote}
                          editable={!submitting}
                          placeholder="Nêu rõ căn cứ phê duyệt hoặc từ chối..."
                          placeholderTextColor={colors.textMuted}
                        />

                        <Text style={styles.muted}>
                          {note.trim().length}/2000 ký tự
                          {' '}· Tối thiểu 10 ký tự
                        </Text>
                      </View>

                      <View style={styles.actions}>
                        <AppButton
                          title="Quay lại"
                          variant="outline"
                          disabled={submitting}
                          onPress={() => {
                            setDecision(null);
                            setModalError('');
                          }}
                        />

                        <AppButton
                          title={
                            submitting
                              ? 'Đang xử lý...'
                              : decision === 'approve'
                                ? 'Xác nhận phê duyệt'
                                : 'Xác nhận từ chối'
                          }
                          disabled={!decisionValid}
                          onPress={() => void submitDecision()}
                        />
                      </View>
                    </View>
                  )}

                  {!!modalError && (
                    <View style={styles.errorBox}>
                      <Text style={styles.errorText}>
                        {modalError}
                      </Text>
                    </View>
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={previewImage !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewImage(null)}
      >
        <View style={styles.previewBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setPreviewImage(null)}
          />

          <View style={styles.previewModal}>
            <View style={styles.toolbar}>
              <Text style={styles.sectionTitle}>
                Xem ảnh bằng chứng
              </Text>
              <Pressable onPress={() => setPreviewImage(null)}>
                <Ionicons
                  name="close"
                  size={25}
                  color={colors.text}
                />
              </Pressable>
            </View>

            {previewImage && (
              <Image
                source={{ uri: previewImage }}
                style={styles.largeImage}
                resizeMode="contain"
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
    paddingTop: spacing.xxl,
    paddingBottom: spacing.section,
    gap: spacing.xl,
  },
  center: {
    minHeight: 420,
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
  link: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  heading: {
    gap: spacing.sm,
  },
  eyebrow: {
    color: colors.eco,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  title: {
    color: colors.text,
    fontSize: 29,
    fontWeight: '800',
  },
  muted: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 21,
  },
  panel: {
    backgroundColor: colors.surface,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    gap: spacing.lg,
  },
  toolbar: {
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
  sectionTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '800',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  filterChip: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  filterActive: {
    backgroundColor: colors.primary,
  },
  filterText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  filterTextActive: {
    color: colors.white,
  },
  searchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchBox: {
    flexGrow: 1,
    flexBasis: 200,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
  },
  searchInput: {
    flex: 1,
    minHeight: 46,
    fontSize: 14,
    color: colors.text,
  },
  list: {
    gap: spacing.md,
  },
  refundCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.md,
  },
  smallLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  orderCode: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  status: {
    color: colors.eco,
    fontSize: 13,
    fontWeight: '800',
  },
  detailLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  detailLabel: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  detailValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  empty: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  successBox: {
    padding: spacing.md,
    backgroundColor: '#EAF6E4',
    borderRadius: radius.sm,
  },
  successText: {
    color: colors.eco,
    fontSize: 13,
    fontWeight: '700',
  },
  errorBox: {
    padding: spacing.md,
    backgroundColor: '#FFF0EF',
    borderRadius: radius.sm,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 21,
  },
  warningBox: {
    backgroundColor: '#FFF5DB',
    borderRadius: radius.sm,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  warningText: {
    flex: 1,
    color: '#895A00',
    fontSize: 13,
    lineHeight: 20,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(15,23,42,0.5)',
    padding: spacing.lg,
  },
  modal: {
    width: '100%',
    maxWidth: 590,
    maxHeight: '90%',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  modalBody: {
    padding: spacing.xl,
    gap: spacing.xl,
  },
  detailPanel: {
    backgroundColor: colors.surfaceMuted,
    padding: spacing.lg,
    borderRadius: radius.md,
    gap: spacing.md,
  },
  evidenceSection: {
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.lg,
  },
  noEvidence: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  evidenceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  evidenceTile: {
    width: 145,
    gap: spacing.sm,
  },
  imagePlaceholder: {
    height: 125,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  evidencePreview: {
    width: 145,
    height: 125,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  previewHint: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  fileName: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  imageError: {
    color: colors.danger,
    fontSize: 11,
    lineHeight: 17,
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  detailText: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 22,
  },
  decisionPanel: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.lg,
    gap: spacing.lg,
  },
  field: {
    gap: spacing.sm,
  },
  input: {
    minHeight: 47,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: 14,
  },
  textarea: {
    minHeight: 110,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    fontSize: 14,
    color: colors.text,
    lineHeight: 21,
  },
  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  previewModal: {
    width: '100%',
    maxWidth: 850,
    maxHeight: '90%',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  largeImage: {
    width: '100%',
    height: 490,
    maxHeight: 490,
  },
});
