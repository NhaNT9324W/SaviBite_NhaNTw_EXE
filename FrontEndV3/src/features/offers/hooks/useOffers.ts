
import { useCallback, useEffect, useState } from 'react';

import { offerApi } from '../api/offer.api';

import type {
    OfferFilters,
    OfferListResult,
} from '../types/offer.types';

type UseOffersResult = {
  data: OfferListResult | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
};

export function useOffers(
  filters: OfferFilters = {}
): UseOffersResult {
  const [data, setData] =
    useState<OfferListResult | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const filtersKey = JSON.stringify(filters);

  const reload = useCallback(() => {
    setReloadKey((current) => current + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const currentFilters =
      JSON.parse(filtersKey) as OfferFilters;

    async function loadOffers() {
      setLoading(true);
      setError(null);

      try {
        const result = await offerApi.getOffers(
          currentFilters,
          controller.signal
        );

        if (!controller.signal.aborted) {
          setData(result);
        }
      } catch (caught) {
        if (controller.signal.aborted) {
          return;
        }

        setError(
          caught instanceof Error
            ? caught.message
            : 'Không thể tải danh sách ưu đãi.'
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadOffers();

    return () => controller.abort();
  }, [filtersKey, reloadKey]);

  return {
    data,
    loading,
    error,
    reload,
  };
}
