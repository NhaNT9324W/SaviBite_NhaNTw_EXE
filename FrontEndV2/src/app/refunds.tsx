
import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
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

type RefundOrder = {
  id: string;
  code: string;
  shopName: string;
  status: string;
  total: number | null;
};

type Evidence = {
  id: string;
  fileName: string;
};

type EvidenceImage = {
  id: string;
  uri: string | null;
  loading: boolean;
  error: string;
};

type RefundRequest = {
  id: string;
  orderId: string | null;
  status: string;
  reason: string | null;
  requestedAmount: number | null;
  approvedAmount: number | null;
  resolutionNote: string | null;
  createdAt: string | null;
  deadlineAt: string | null;
  resolvedAt: string | null;
  evidences: Evidence[];
  evidenceCount: number | null;
};

type SelectedImage = {
  uri: string;
  fileName: string;
  mimeType: string;
  file?: File;
};

const PAGE_SIZE = 10;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  let current = value;

  for (let i = 0; i < 3; i += 1) {
    const source = obj(current);
    if (!source || !('data' in source)) break;
    current = source.data;
  }

  return current;
}

function itemsOf(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;

  const source = obj(value);
  if (!source) return [];

  for (const key of [
    'items',
    'orders',
    'refundOrders',
    'results',
    'records',
  ]) {
    if (Array.isArray(source[key])) {
      return source[key] as unknown[];
    }
  }

  return 'data' in source ? itemsOf(source.data) : [];
}

function paginationOf(
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

  const hasNext =
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
      hasNext ??
      (pages !== null
        ? page < pages
        : total !== null
          ? page * PAGE_SIZE < total
          : count === PAGE_SIZE),
  };
}

function normalizeOrder(value: unknown): RefundOrder | null {
  const root = obj(value);
  if (!root) return null;

  const source = obj(root.order) ?? root;
  const shop = obj(source.shop);
  const id =
    str(source, 'orderId', 'id') ??
    str(root, 'orderId');

  if (!id || !UUID_REGEX.test(id)) return null;

  return {
    id,
    code:
      str(source, 'orderCode', 'code', 'orderNumber') ??
      str(root, 'orderCode') ??
      id,
    shopName:
      str(source, 'shopName') ??
      str(root, 'shopName') ??
      str(shop, 'name') ??
      'Cửa hàng',
    status:
      str(source, 'status', 'orderStatus') ??
      'COMPLETED',
    total:
      num(source, 'totalAmount', 'totalPrice', 'total') ??
      num(root, 'totalAmount', 'totalPrice', 'total'),
  };
}

function normalizeEvidence(value: unknown): Evidence | null {
  const source = obj(value);
  if (!source) return null;

  const id = str(source, 'id', 'evidenceId');
  if (!id || !UUID_REGEX.test(id)) return null;

  return {
    id,
    fileName:
      str(source, 'fileName', 'originalFileName', 'name') ??
      'Ảnh bằng chứng',
  };
}

/**
 * Chỉ dùng với đối tượng refund hoặc latestRequest.
 * Không dùng data.id của API theo đơn hàng.
 */
function normalizeRefundRequest(
  value: unknown
): RefundRequest | null {
  const root = obj(value);
  if (!root) return null;

  const source =
    obj(root.refund) ??
    obj(root.refundRequest) ??
    root;

  const id = str(
    source,
    'refundRequestId',
    'refundId',
    'id'
  );

  if (!id || !UUID_REGEX.test(id)) return null;

  const rawEvidences = Array.isArray(source.evidences)
    ? source.evidences
    : null;

  const evidences = (rawEvidences ?? [])
    .map(normalizeEvidence)
    .filter((item): item is Evidence => item !== null);

  return {
    id,
    orderId: str(source, 'orderId'),
    status: str(source, 'status', 'refundStatus') ?? 'PENDING',
    reason: str(source, 'reason', 'refundReason'),
    requestedAmount: num(source, 'requestedAmount'),
    approvedAmount: num(source, 'approvedAmount'),
    resolutionNote: str(
      source,
      'resolutionNote',
      'reviewNote',
      'adminNote',
      'decisionNote',
      'note'
    ),
    createdAt: str(source, 'createdAt', 'requestedAt'),
    deadlineAt: str(source, 'deadlineAt'),
    resolvedAt: str(source, 'resolvedAt'),
    evidences,
    evidenceCount:
      rawEvidences !== null
        ? rawEvidences.length
        : num(source, 'evidenceCount'),
  };
}

function mergeRefund(
  summary: RefundRequest,
  detail: RefundRequest
): RefundRequest {
  return {
    ...detail,
    orderId: detail.orderId ?? summary.orderId,
    status: detail.status || summary.status,
    reason: detail.reason ?? summary.reason,
    requestedAmount:
      detail.requestedAmount ?? summary.requestedAmount,
    approvedAmount:
      detail.approvedAmount ?? summary.approvedAmount,
    resolutionNote:
      detail.resolutionNote ?? summary.resolutionNote,
    createdAt: detail.createdAt ?? summary.createdAt,
    deadlineAt: detail.deadlineAt ?? summary.deadlineAt,
    resolvedAt: detail.resolvedAt ?? summary.resolvedAt,
    evidences:
      detail.evidenceCount !== null
        ? detail.evidences
        : summary.evidences,
    evidenceCount:
      detail.evidenceCount ?? summary.evidenceCount,
  };
}

class ApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function parseResponse(response: Response): Promise<unknown> {
  const raw = await response.text();
  let json: unknown = null;

  if (raw.trim()) {
    try {
      json = JSON.parse(raw);
    } catch {
      throw new ApiError(
        `Backend trả về dữ liệu không hợp lệ (HTTP ${response.status}).`,
        response.status
      );
    }
  }

  const source = obj(json);
  const apiError = obj(source?.error);

  if (!response.ok || source?.success === false) {
    throw new ApiError(
      str(apiError, 'message', 'detail') ??
      str(source, 'message', 'detail') ??
      `Backend trả về HTTP ${response.status}.`,
      response.status
    );
  }

  return unwrap(json);
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function money(value: number | null): string {
  if (value === null) return 'Chưa có thông tin';

  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
}

function dateText(value: string | null): string {
  if (!value) return '';

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('vi-VN', { hour12: false });
}

function statusLabel(value: string): string {
  switch (value.toUpperCase()) {
    case 'PENDING': return 'Chờ xem xét';
    case 'APPROVED': return 'Đã phê duyệt';
    case 'REJECTED': return 'Đã từ chối';
    case 'COMPLETED': return 'Đã hoàn thành';
    case 'PAID': return 'Đã thanh toán';
    case 'REFUND_REQUESTED': return 'Đã yêu cầu hoàn tiền';
    case 'REFUNDED': return 'Đã hoàn tiền';
    default: return value || 'Chưa xác định';
  }
}

function DetailField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.detailLabel}>{label}</Text>
      {children}
    </View>
  );
}

/**
 * Ảnh được lấy qua fetch kèm Bearer token.
 * Không gắn token vào URL.
 */
async function imageUriFromResponse(
  response: Response
): Promise<string> {
  if (!response.ok) {
    const raw = await response.text();
    let message = `Không thể tải ảnh (HTTP ${response.status}).`;

    try {
      const root = obj(JSON.parse(raw));
      message =
        str(root?.error, 'message', 'detail') ??
        str(root, 'message', 'detail') ??
        message;
    } catch {
      // Giữ thông báo HTTP nếu phản hồi không phải JSON.
    }

    throw new Error(message);
  }

  const contentType =
    response.headers.get('content-type')?.toLowerCase() ?? '';

  if (
    contentType &&
    !contentType.startsWith('image/') &&
    !contentType.startsWith('application/octet-stream')
  ) {
    throw new Error(
      `API trả về ${contentType}, không phải dữ liệu ảnh.`
    );
  }

  const blob = await response.blob();

  if (blob.size === 0) {
    throw new Error('Backend trả về tệp ảnh rỗng.');
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
        reject(new Error('Không thể chuyển dữ liệu ảnh.'));
      }
    };

    reader.onerror = () => {
      reject(new Error('Không thể đọc dữ liệu ảnh.'));
    };

    reader.readAsDataURL(blob);
  });
}

export default function RefundsScreen() {
  const router = useRouter();
  const { status, getAccessToken } = useAuth();

  const [orders, setOrders] = useState<RefundOrder[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState<number | null>(null);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [selected, setSelected] =
    useState<RefundOrder | null>(null);
  const [existing, setExisting] =
    useState<RefundRequest | null>(null);
  const [checking, setChecking] = useState(false);
  const [canRequest, setCanRequest] = useState(false);
  const [detailWarning, setDetailWarning] = useState('');
  const [modalError, setModalError] = useState('');

  const [reason, setReason] = useState('');
  const [requestedAmount, setRequestedAmount] = useState('');
  const [images, setImages] = useState<SelectedImage[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);

  const [evidenceImages, setEvidenceImages] =
    useState<EvidenceImage[]>([]);
  const [previewImage, setPreviewImage] =
    useState<string | null>(null);

  const modalVersionRef = useRef(0);
  const submittingRef = useRef(false);
  const imageUrlsRef = useRef<string[]>([]);

  const clearImageUrls = useCallback(() => {
    if (Platform.OS === 'web') {
      for (const url of imageUrlsRef.current) {
        URL.revokeObjectURL(url);
      }
    }

    imageUrlsRef.current = [];
    setEvidenceImages([]);
    setPreviewImage(null);
  }, []);

  useEffect(() => {
    return () => {
      modalVersionRef.current += 1;

      if (Platform.OS === 'web') {
        for (const url of imageUrlsRef.current) {
          URL.revokeObjectURL(url);
        }
      }

      imageUrlsRef.current = [];
    };
  }, []);

  const apiGet = useCallback(
    async (path: string): Promise<unknown> => {
      const token = await getAccessToken();

      if (!token) {
        throw new Error(
          'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
        );
      }

      const response = await fetch(
        `${ENV.apiUrl.replace(/\/+$/, '')}${path}`,
        {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return parseResponse(response);
    },
    [getAccessToken]
  );

  const loadOrders = useCallback(
    async (targetPage: number) => {
      if (status !== 'authenticated') {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const data = await apiGet(
          `/api/me/refund-orders?page=${targetPage}&limit=${PAGE_SIZE}`
        );

        const rawItems = itemsOf(data);
        const normalized = rawItems
          .map(normalizeOrder)
          .filter(
            (item): item is RefundOrder => item !== null
          );

        const pagination = paginationOf(
          data,
          targetPage,
          rawItems.length
        );

        setOrders(normalized);
        setPage(targetPage);
        setPages(pagination.pages);
        setHasNext(pagination.next);

        if (rawItems.length > 0 && normalized.length === 0) {
          setError(
            'Không nhận diện được danh sách đơn hàng từ Backend.'
          );
        }
      } catch (caught: unknown) {
        setOrders([]);
        setError(
          errorMessage(
            caught,
            'Không thể tải danh sách đơn hàng.'
          )
        );
      } finally {
        setLoading(false);
      }
    },
    [apiGet, status]
  );

  useEffect(() => {
    void loadOrders(1);
  }, [loadOrders]);

  /**
   * Tải ảnh của một yêu cầu cụ thể.
   * Có kiểm tra phiên popup để không trộn ảnh hai đơn.
   */
  const loadEvidenceImages = useCallback(
    async (refund: RefundRequest, version: number) => {
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

      let token: string | null = null;

      try {
        token = await getAccessToken();
      } catch {
        token = null;
      }

      if (modalVersionRef.current !== version) return;

      if (!token) {
        setEvidenceImages(
          refund.evidences.map((evidence) => ({
            id: evidence.id,
            uri: null,
            loading: false,
            error: 'Phiên đăng nhập đã hết hạn.',
          }))
        );
        return;
      }

      await Promise.all(
        refund.evidences.map(async (evidence) => {
          try {
            const path =
              `/api/refund-requests/${encodeURIComponent(refund.id)}` +
              `/evidences/${encodeURIComponent(evidence.id)}/image`;

            const response = await fetch(
              `${ENV.apiUrl.replace(/\/+$/, '')}${path}`,
              {
                method: 'GET',
                headers: {
                  Accept: 'image/*,application/octet-stream',
                  Authorization: `Bearer ${token}`,
                },
              }
            );

            const uri = await imageUriFromResponse(response);

            if (modalVersionRef.current !== version) {
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
                  ? { ...item, uri, loading: false, error: '' }
                  : item
              )
            );
          } catch (caught: unknown) {
            if (modalVersionRef.current !== version) return;

            setEvidenceImages((current) =>
              current.map((item) =>
                item.id === evidence.id
                  ? {
                      ...item,
                      uri: null,
                      loading: false,
                      error: errorMessage(
                        caught,
                        'Không thể tải ảnh bằng chứng.'
                      ),
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

  const closeModal = () => {
    if (submittingRef.current) return;

    modalVersionRef.current += 1;
    clearImageUrls();

    setSelected(null);
    setExisting(null);
    setChecking(false);
    setCanRequest(false);
    setConfirmVisible(false);
    setModalError('');
    setDetailWarning('');
  };

  const openOrder = async (order: RefundOrder) => {
    if (submittingRef.current) return;

    const version = ++modalVersionRef.current;
    const isCurrent = () => modalVersionRef.current === version;

    clearImageUrls();

    setSelected(order);
    setExisting(null);
    setChecking(true);
    setCanRequest(false);
    setModalError('');
    setDetailWarning('');
    setNotice('');

    setReason('');
    setRequestedAmount(
      order.total !== null ? String(order.total) : ''
    );
    setImages([]);
    setRequestId(null);

    try {
      const response = await apiGet(
        `/api/orders/${encodeURIComponent(order.id)}/refund-request`
      );

      if (!isCurrent()) return;

      const data = obj(response);

      if (!data) {
        setModalError(
          'Backend chưa trả về dữ liệu kiểm tra hoàn tiền hợp lệ.'
        );
        return;
      }

      const returnedOrderId = str(data, 'id', 'orderId');

      if (
        returnedOrderId &&
        returnedOrderId.toLowerCase() !== order.id.toLowerCase()
      ) {
        setModalError(
          'Backend trả về thông tin của đơn hàng khác.'
        );
        return;
      }

      const latestRequest = obj(data.latestRequest);

      if (latestRequest) {
        const refund = normalizeRefundRequest(latestRequest);

        if (!refund) {
          setModalError(
            'Backend không trả về mã yêu cầu hoàn tiền hợp lệ.'
          );
          return;
        }

        if (
          refund.orderId &&
          refund.orderId.toLowerCase() !== order.id.toLowerCase()
        ) {
          setModalError(
            'Yêu cầu hoàn tiền không thuộc đơn hàng đang xem.'
          );
          return;
        }

        setExisting(refund);
        setCanRequest(false);

        if (
          refund.reason !== null &&
          refund.requestedAmount !== null &&
          refund.evidenceCount !== null
        ) {
          void loadEvidenceImages(refund, version);
          return;
        }

        try {
          const detailData = await apiGet(
            `/api/refund-requests/${encodeURIComponent(refund.id)}`
          );

          if (!isCurrent()) return;

          const root = obj(detailData);

          const detail = normalizeRefundRequest(
            root?.refund ?? detailData
          );

          if (
            !detail ||
            detail.id.toLowerCase() !== refund.id.toLowerCase()
          ) {
            setDetailWarning(
              'API chi tiết không trả về đúng yêu cầu hoàn tiền.'
            );
            void loadEvidenceImages(refund, version);
            return;
          }

          if (
            detail.orderId &&
            detail.orderId.toLowerCase() !== order.id.toLowerCase()
          ) {
            setDetailWarning(
              'API chi tiết trả về dữ liệu thuộc đơn hàng khác.'
            );
            void loadEvidenceImages(refund, version);
            return;
          }

          const merged = mergeRefund(refund, detail);

          setExisting(merged);
          void loadEvidenceImages(merged, version);
        } catch (caught: unknown) {
          if (!isCurrent()) return;

          setDetailWarning(
            'Không thể tải thêm thông tin chi tiết: ' +
            errorMessage(caught, 'Lỗi không xác định.')
          );
          void loadEvidenceImages(refund, version);
        }

        return;
      }

      // Chỉ Backend mới quyết định đơn có đủ điều kiện
      // gửi yêu cầu mới hay không.
      if (data.canRequest === true) {
        if (
          order.status.toUpperCase() === 'REFUND_REQUESTED'
        ) {
          setModalError(
            'Trạng thái đơn hàng không khớp với quyền tạo yêu cầu. Vui lòng làm mới.'
          );
          return;
        }

        setCanRequest(true);
        return;
      }

      setModalError(
        str(data, 'message') ??
        'Đơn hàng hiện không đủ điều kiện yêu cầu hoàn tiền.'
      );
    } catch (caught: unknown) {
      if (!isCurrent()) return;

      setCanRequest(false);
      setModalError(
        errorMessage(
          caught,
          'Không thể kiểm tra yêu cầu hoàn tiền.'
        )
      );
    } finally {
      if (isCurrent()) {
        setChecking(false);
      }
    }
  };

  const chooseImages = async () => {
    if (images.length >= 3 || submitting || !canRequest) return;

    setModalError('');

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: 3 - images.length,
        quality: 0.8,
      });

      if (result.canceled) return;

      const chosen: SelectedImage[] = result.assets.map(
        (asset, index) => ({
          uri: asset.uri,
          fileName:
            asset.fileName ??
            `refund-${Date.now()}-${index}.jpg`,
          mimeType: asset.mimeType ?? 'image/jpeg',
          file: asset.file ?? undefined,
        })
      );

      setImages((current) =>
        [...current, ...chosen].slice(0, 3)
      );

      setRequestId(null);
    } catch (caught: unknown) {
      setModalError(
        errorMessage(
          caught,
          'Không thể chọn ảnh bằng chứng.'
        )
      );
    }
  };

  const cleanAmount = requestedAmount.trim();

  const amountValid =
    /^\d+(\.\d{1,2})?$/.test(cleanAmount) &&
    Number(cleanAmount) > 0 &&
    (
      selected?.total == null ||
      Number(cleanAmount) <= selected.total
    );

  const validForm =
    selected !== null &&
    existing === null &&
    canRequest &&
    !checking &&
    !submitting &&
    !modalError &&
    reason.trim().length >= 10 &&
    reason.trim().length <= 2000 &&
    amountValid &&
    images.length >= 1 &&
    images.length <= 3;

  const submitRefund = async () => {
    if (!selected || !validForm || submittingRef.current) return;

    submittingRef.current = true;

    const order = selected;
    const version = modalVersionRef.current;

    setConfirmVisible(false);
    setSubmitting(true);
    setModalError('');

    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error('Phiên đăng nhập đã hết hạn.');
      }

      const id = requestId ?? Crypto.randomUUID();
      setRequestId(id);

      const form = new FormData();

      form.append('RequestId', id);
      form.append('Reason', reason.trim());
      form.append('RequestedAmount', cleanAmount);

      for (const image of images) {
        if (Platform.OS === 'web') {
          let blob: Blob;

          if (image.file) {
            blob = image.file;
          } else {
            const imageResponse = await fetch(image.uri);
            if (!imageResponse.ok) {
              throw new Error('Không thể đọc ảnh bằng chứng.');
            }
            blob = await imageResponse.blob();
          }

          form.append('Files', blob, image.fileName);
        } else {
          form.append(
            'Files',
            {
              uri: image.uri,
              name: image.fileName,
              type: image.mimeType,
            } as unknown as Blob
          );
        }
      }

      const response = await fetch(
        `${ENV.apiUrl.replace(/\/+$/, '')}` +
        `/api/orders/${encodeURIComponent(order.id)}/refund-request`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
          // Không thêm Content-Type thủ công.
          body: form,
        }
      );

      await parseResponse(response);

      if (modalVersionRef.current === version) {
        setNotice('Đã gửi yêu cầu hoàn tiền thành công.');

        modalVersionRef.current += 1;
        clearImageUrls();
        setSelected(null);
        setExisting(null);
        setCanRequest(false);
        setImages([]);
        setRequestId(null);
      }

      await loadOrders(page);
    } catch (caught: unknown) {
      setModalError(
        errorMessage(
          caught,
          'Không thể gửi yêu cầu hoàn tiền.'
        )
      );
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  if (status === 'loading') {
    return (
      <CustomerLayout>
        <ScreenContainer style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </ScreenContainer>
      </CustomerLayout>
    );
  }

  if (status !== 'authenticated') {
    return (
      <CustomerLayout>
        <ScreenContainer style={styles.center}>
          <Text style={styles.title}>
            Đăng nhập để yêu cầu hoàn tiền
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
          onPress={() => router.push('/orders')}
        >
          <Ionicons
            name="arrow-back"
            size={18}
            color={colors.primary}
          />
          <Text style={styles.link}>Quay lại đơn hàng</Text>
        </Pressable>

        <View style={styles.heading}>
          <Ionicons
            name="wallet-outline"
            size={34}
            color={colors.primary}
          />
          <Text style={styles.eyebrow}>
            SAVIBITE · REFUNDS
          </Text>
          <Text style={styles.title}>Yêu cầu hoàn tiền</Text>
          <Text style={styles.muted}>
            Chọn đơn hàng, mô tả vấn đề và cung cấp từ
            1 đến 3 ảnh bằng chứng.
          </Text>
        </View>

        {!!notice && (
          <View style={styles.successBox}>
            <Ionicons
              name="checkmark-circle-outline"
              size={20}
              color={colors.eco}
            />
            <Text style={styles.successText}>{notice}</Text>
          </View>
        )}

        {!!error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.panel}>
          <View style={styles.toolbar}>
            <View style={styles.flex}>
              <Text style={styles.sectionTitle}>
                Đơn hàng có thể yêu cầu
              </Text>
              <Text style={styles.muted}>
                Backend quyết định điều kiện hoàn tiền cuối cùng.
              </Text>
            </View>

            <AppButton
              title="Làm mới"
              variant="outline"
              disabled={loading}
              onPress={() => void loadOrders(page)}
            />
          </View>

          {loading ? (
            <View style={styles.empty}>
              <ActivityIndicator
                size="large"
                color={colors.primary}
              />
              <Text style={styles.muted}>Đang tải đơn hàng...</Text>
            </View>
          ) : orders.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons
                name="receipt-outline"
                size={38}
                color={colors.textMuted}
              />
              <Text style={styles.sectionTitle}>
                Chưa có đơn phù hợp
              </Text>
            </View>
          ) : (
            <View style={styles.list}>
              {orders.map((order) => (
                <View key={order.id} style={styles.orderCard}>
                  <View style={styles.toolbar}>
                    <View style={styles.flex}>
                      <Text style={styles.smallLabel}>
                        MÃ ĐƠN HÀNG
                      </Text>
                      <Text style={styles.orderCode}>{order.code}</Text>
                    </View>

                    <Text style={styles.statusLabel}>
                      {statusLabel(order.status)}
                    </Text>
                  </View>

                  <View style={styles.divider} />

                  <View style={styles.detailRow}>
                    <Ionicons
                      name="storefront-outline"
                      size={18}
                      color={colors.primary}
                    />
                    <Text style={styles.shopName}>{order.shopName}</Text>
                  </View>

                  <Text style={styles.money}>{money(order.total)}</Text>

                  <AppButton
                    title="Yêu cầu / Xem hoàn tiền"
                    variant="outline"
                    onPress={() => void openOrder(order)}
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
                onPress={() => void loadOrders(page - 1)}
              />
              <AppButton
                title="Tiếp"
                variant="outline"
                disabled={loading || !hasNext}
                onPress={() => void loadOrders(page + 1)}
              />
            </View>
          </View>
        </View>
      </ScreenContainer>

      <Modal
        visible={selected !== null}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <View style={styles.backdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={closeModal}
          />

          <View style={styles.modal}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.modalBody}
            >
              <View style={styles.toolbar}>
                <View style={styles.flex}>
                  <Text style={styles.sectionTitle}>
                    Hoàn tiền đơn hàng
                  </Text>
                  <Text style={styles.muted}>{selected?.code}</Text>
                </View>

                <Pressable disabled={submitting} onPress={closeModal}>
                  <Ionicons
                    name="close"
                    size={23}
                    color={colors.textSecondary}
                  />
                </Pressable>
              </View>

              {checking ? (
                <View style={styles.empty}>
                  <ActivityIndicator color={colors.primary} />
                  <Text style={styles.muted}>
                    Đang kiểm tra yêu cầu hoàn tiền...
                  </Text>
                </View>
              ) : existing ? (
                <View style={styles.detailPanel}>
                  <View style={styles.statusPill}>
                    <Ionicons
                      name="time-outline"
                      size={17}
                      color={colors.primary}
                    />
                    <Text style={styles.statusLabel}>
                      {statusLabel(existing.status)}
                    </Text>
                  </View>

                  <DetailField label="Mã yêu cầu hoàn tiền">
                    <Text style={styles.requestId}>{existing.id}</Text>
                  </DetailField>

                  <View style={styles.divider} />

                  <DetailField label="Lý do hoàn tiền">
                    <Text style={styles.detailText}>
                      {existing.reason ??
                        'Backend chưa cung cấp lý do.'}
                    </Text>
                  </DetailField>

                  <DetailField label="Số tiền yêu cầu">
                    <Text style={styles.money}>
                      {money(existing.requestedAmount)}
                    </Text>
                  </DetailField>

                  {existing.approvedAmount !== null && (
                    <DetailField label="Số tiền được duyệt">
                      <Text style={styles.money}>
                        {money(existing.approvedAmount)}
                      </Text>
                    </DetailField>
                  )}

                  {!!existing.resolutionNote && (
                    <DetailField label="Ghi chú xử lý">
                      <Text style={styles.detailText}>
                        {existing.resolutionNote}
                      </Text>
                    </DetailField>
                  )}

                  {!!existing.createdAt && (
                    <DetailField label="Ngày gửi yêu cầu">
                      <Text style={styles.detailText}>
                        {dateText(existing.createdAt)}
                      </Text>
                    </DetailField>
                  )}

                  {!!existing.deadlineAt && (
                    <DetailField label="Thời hạn xử lý">
                      <Text style={styles.detailText}>
                        {dateText(existing.deadlineAt)}
                      </Text>
                    </DetailField>
                  )}

                  {!!existing.resolvedAt && (
                    <DetailField label="Ngày xử lý">
                      <Text style={styles.detailText}>
                        {dateText(existing.resolvedAt)}
                      </Text>
                    </DetailField>
                  )}

                  <View style={styles.evidenceSection}>
                    <View style={styles.toolbar}>
                      <View style={styles.evidenceHeading}>
                        <Ionicons
                          name="images-outline"
                          size={19}
                          color={colors.primary}
                        />
                        <Text style={styles.label}>
                          Ảnh bằng chứng
                        </Text>
                      </View>
                      <Text style={styles.detailLabel}>
                        {existing.evidenceCount !== null
                          ? `${existing.evidenceCount} ảnh`
                          : 'Chưa rõ số lượng'}
                      </Text>
                    </View>

                    {existing.evidences.length === 0 ? (
                      <View style={styles.emptyEvidence}>
                        <Ionicons
                          name="image-outline"
                          size={28}
                          color={colors.textMuted}
                        />
                        <Text style={styles.muted}>
                          Yêu cầu này chưa có ảnh bằng chứng
                          trong dữ liệu Backend.
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.evidenceGrid}>
                        {existing.evidences.map((evidence) => {
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
                                    source={{ uri: imageState.uri }}
                                    style={styles.evidencePreview}
                                    resizeMode="cover"
                                  />
                                  <Text style={styles.previewHint}>
                                    Nhấn để xem ảnh lớn
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

                  {!!detailWarning && (
                    <View style={styles.warningBox}>
                      <Ionicons
                        name="alert-circle-outline"
                        size={19}
                        color="#895A00"
                      />
                      <Text style={styles.warningText}>
                        {detailWarning}
                      </Text>
                    </View>
                  )}

                  <AppButton
                    title="Đóng"
                    variant="outline"
                    onPress={closeModal}
                  />
                </View>
              ) : (
                <>
                  {!!modalError && (
                    <View style={styles.errorBox}>
                      <Text style={styles.errorText}>{modalError}</Text>
                    </View>
                  )}

                  {canRequest && !modalError && (
                    <>
                      <View style={styles.field}>
                        <Text style={styles.label}>
                          Lý do hoàn tiền *
                        </Text>
                        <TextInput
                          multiline
                          value={reason}
                          onChangeText={(value) => {
                            setReason(value);
                            setRequestId(null);
                          }}
                          maxLength={2000}
                          editable={!submitting && !confirmVisible}
                          placeholder="Mô tả rõ vấn đề gặp phải với đơn hàng..."
                          placeholderTextColor={colors.textMuted}
                          textAlignVertical="top"
                          style={styles.textarea}
                        />
                        <Text style={styles.hint}>
                          {reason.trim().length}/2000 ký tự · Tối thiểu 10 ký tự
                        </Text>
                      </View>

                      <View style={styles.field}>
                        <Text style={styles.label}>
                          Số tiền yêu cầu hoàn (VNĐ) *
                        </Text>
                        <TextInput
                          value={requestedAmount}
                          onChangeText={(value) => {
                            setRequestedAmount(value);
                            setRequestId(null);
                          }}
                          keyboardType="decimal-pad"
                          editable={!submitting && !confirmVisible}
                          placeholder="15000"
                          placeholderTextColor={colors.textMuted}
                          style={styles.input}
                        />
                        <Text style={styles.hint}>
                          Nhập số không dùng dấu phân cách hàng nghìn.
                        </Text>
                        {selected?.total != null && (
                          <Text style={styles.hint}>
                            Giá trị đơn: {money(selected.total)}
                          </Text>
                        )}
                      </View>

                      <View style={styles.field}>
                        <Text style={styles.label}>
                          Ảnh bằng chứng * ({images.length}/3)
                        </Text>

                        <AppButton
                          title="Chọn ảnh từ thiết bị"
                          variant="outline"
                          disabled={
                            images.length >= 3 ||
                            submitting ||
                            confirmVisible
                          }
                          onPress={() => void chooseImages()}
                        />

                        <View style={styles.imageRow}>
                          {images.map((image, index) => (
                            <View
                              key={`${image.uri}-${index}`}
                              style={styles.imageTile}
                            >
                              <Image
                                source={{ uri: image.uri }}
                                style={styles.preview}
                              />
                              <Pressable
                                disabled={submitting || confirmVisible}
                                style={styles.removeImage}
                                onPress={() => {
                                  setImages((current) =>
                                    current.filter(
                                      (_, i) => i !== index
                                    )
                                  );
                                  setRequestId(null);
                                }}
                              >
                                <Ionicons
                                  name="close"
                                  size={17}
                                  color={colors.white}
                                />
                              </Pressable>
                            </View>
                          ))}
                        </View>

                        <Text style={styles.hint}>
                          Bắt buộc từ 1 đến 3 ảnh.
                        </Text>
                      </View>

                      <View style={styles.actions}>
                        <AppButton
                          title="Hủy"
                          variant="outline"
                          disabled={submitting}
                          onPress={closeModal}
                        />
                        <AppButton
                          title={
                            submitting
                              ? 'Đang gửi...'
                              : 'Gửi yêu cầu hoàn tiền'
                          }
                          disabled={!validForm}
                          onPress={() => setConfirmVisible(true)}
                        />
                      </View>
                    </>
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={confirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmVisible(false)}
      >
        <View style={styles.backdrop}>
          <View style={styles.confirmPanel}>
            <Text style={styles.sectionTitle}>
              Xác nhận gửi yêu cầu?
            </Text>
            <Text style={styles.muted}>
              Bạn đang yêu cầu hoàn{' '}
              {money(amountValid ? Number(cleanAmount) : null)}{' '}
              cho đơn {selected?.code}.
            </Text>
            <Text style={styles.muted}>
              Vui lòng kiểm tra lý do và ảnh bằng chứng trước khi gửi.
            </Text>
            <View style={styles.actions}>
              <AppButton
                title="Quay lại"
                variant="outline"
                onPress={() => setConfirmVisible(false)}
              />
              <AppButton
                title="Xác nhận gửi"
                disabled={!validForm || submitting}
                onPress={() => void submitRefund()}
              />
            </View>
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
          <View style={styles.previewPanel}>
            <View style={styles.toolbar}>
              <Text style={styles.sectionTitle}>
                Xem ảnh bằng chứng
              </Text>
              <Pressable onPress={() => setPreviewImage(null)}>
                <Ionicons
                  name="close"
                  size={24}
                  color={colors.text}
                />
              </Pressable>
            </View>

            {previewImage !== null && (
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
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  link: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  heading: { gap: spacing.sm },
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
    padding: spacing.xl,
    gap: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  toolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  flex: {
    flex: 1,
    gap: spacing.xs,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: colors.text,
  },
  list: { gap: spacing.md },
  orderCard: {
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
  statusLabel: {
    color: colors.eco,
    fontSize: 13,
    fontWeight: '800',
  },
  shopName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  divider: {
    backgroundColor: colors.border,
    height: 1,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  money: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 20,
  },
  empty: {
    minHeight: 160,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'flex-end',
  },
  successBox: {
    backgroundColor: '#EAF6E4',
    borderRadius: radius.sm,
    padding: spacing.md,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  successText: {
    color: colors.eco,
    fontWeight: '700',
    fontSize: 13,
    flex: 1,
  },
  errorBox: {
    backgroundColor: '#FFF0EF',
    borderRadius: radius.sm,
    padding: spacing.md,
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
    color: '#895A00',
    fontSize: 13,
    lineHeight: 20,
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modal: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '90%',
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  modalBody: {
    gap: spacing.lg,
    padding: spacing.xl,
  },
  confirmPanel: {
    backgroundColor: colors.surface,
    width: '100%',
    maxWidth: 440,
    borderRadius: radius.md,
    padding: spacing.xl,
    gap: spacing.xl,
  },
  detailPanel: { gap: spacing.lg },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  field: { gap: spacing.sm },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  detailLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  requestId: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  detailText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 22,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: 15,
  },
  textarea: {
    minHeight: 110,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    color: colors.text,
    fontSize: 14,
    lineHeight: 21,
  },
  hint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 19,
  },
  imageRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  imageTile: {
    width: 90,
    height: 90,
    position: 'relative',
  },
  preview: {
    width: 90,
    height: 90,
    borderRadius: radius.sm,
  },
  removeImage: {
    position: 'absolute',
    top: 3,
    right: 3,
    backgroundColor: colors.danger,
    borderRadius: 14,
    width: 25,
    height: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  evidenceSection: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  evidenceHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyEvidence: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
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
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  evidencePreview: {
    width: 145,
    height: 125,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
  },
  previewHint: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  fileName: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '700',
  },
  imageError: {
    color: colors.danger,
    fontSize: 11,
    lineHeight: 17,
  },
  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  previewPanel: {
    width: '100%',
    maxWidth: 800,
    maxHeight: '90%',
    padding: spacing.lg,
    gap: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  largeImage: {
    width: '100%',
    height: 460,
    maxHeight: 460,
  },
});
