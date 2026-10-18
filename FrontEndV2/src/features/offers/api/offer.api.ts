
import { apiGet } from '../../../shared/api/api-client';

import type {
    OfferDetail,
    OfferFilterOptions,
    OfferFilters,
    OfferListResult,
} from '../types/offer.types';

function createQueryString(filters: OfferFilters): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (
      value === undefined ||
      value === null ||
      value === ''
    ) {
      continue;
    }

    params.set(key, String(value));
  }

  const query = params.toString();

  return query ? `?${query}` : '';
}

export const offerApi = {
  // GET /api/offers
  getOffers(
    filters: OfferFilters = {},
    signal?: AbortSignal
  ): Promise<OfferListResult> {
    return apiGet<OfferListResult>(
      `/api/offers${createQueryString(filters)}`,
      signal
    );
  },

  // GET /api/offers/{id}
  getDetail(
    id: string,
    signal?: AbortSignal
  ): Promise<OfferDetail> {
    return apiGet<OfferDetail>(
      `/api/offers/${encodeURIComponent(id)}`,
      signal
    );
  },

  // GET /api/offers/filter-options
  getFilterOptions(
    signal?: AbortSignal
  ): Promise<OfferFilterOptions> {
    return apiGet<OfferFilterOptions>(
      '/api/offers/filter-options',
      signal
    );
  },
};
