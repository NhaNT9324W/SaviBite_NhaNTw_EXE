
import { useCallback, useEffect, useState } from 'react';

import { offerApi } from '../api/offer.api';
import type { OfferDetail } from '../types/offer.types';

type UseOfferDetailResult = {
  data: OfferDetail | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
};

export function useOfferDetail(
  id?: string
): UseOfferDetailResult {
  const [data, setData] = useState<OfferDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const reload = useCallback(() => {
    setRetryKey((current) => current + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    if (!id) {
      setData(null);
      setError('Không tìm thấy mã ưu đãi.');
      setLoading(false);

      return () => controller.abort();
    }

    setData(null);
    setError(null);
    setLoading(true);

    async function loadDetail() {
      try {
        const result: OfferDetail = await offerApi.getDetail(
          id as string,
          controller.signal
        );

        if (!controller.signal.aborted) {
          setData(result);
        }
      } catch (caught: unknown) {
        if (controller.signal.aborted) {
          return;
        }

        setError(
          caught instanceof Error
            ? caught.message
            : 'Không thể tải chi tiết ưu đãi.'
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadDetail();

    return () => {
      controller.abort();
    };
  }, [id, retryKey]);

  return {
    data,
    loading,
    error,
    reload,
  };
}
