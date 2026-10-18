
export type OfferType = 'FLASH_SALE' | 'SAVIBITE_BOX';

export type OfferSortBy =
  | 'endingSoon'
  | 'price'
  | 'createdAt'
  | 'distance';

export type OfferListItem = {
  id: string;
  offerType: OfferType;
  title: string;
  description: string;
  originalValue: number;
  salePrice: number;
  availableQuantity: number;
  saleEndAt: string;
  pickupStartAt: string;
  pickupEndAt: string;
  allergyInfo: string;
  storageInstruction: string;
  shopId: string;
  shopName: string;
  shopAddress: string;
  distanceKm: number | null;
};

export type OfferListResult = {
  items: OfferListItem[];
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
};

export type OfferFilters = {
  page?: number;
  limit?: number;
  q?: string;
  type?: OfferType;
  categoryId?: string;
  shopId?: string;
  minPrice?: number;
  maxPrice?: number;
  pickupDate?: string;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  sortBy?: OfferSortBy;
  sortOrder?: 'asc' | 'desc';
};

export type OfferFilterOptions = {
  categories: { id: string; name: string }[];
  shops: { id: string; name: string }[];
};



export type OfferShop = {
  id: string;
  name: string;
  description: string;
  phone: string;
  address: string;
  averageRating: number;
};

export type OfferProduct = {
  id: string;
  name: string;
  description: string;
  ingredients: string;
  allergyInfo: string;
  storageInstruction: string;
  imageUrl: string | null;
  originalPrice: number;
  categoryName: string;
};

export type OfferDetail = {
  id: string;
  offerType: OfferType;
  title: string;
  description: string;
  imageUrl: string | null;
  originalValue: number;
  salePrice: number;
  availableQuantity: number;
  saleStartAt: string;
  saleEndAt: string;
  pickupStartAt: string;
  pickupEndAt: string;
  allergyInfo: string;
  storageInstruction: string;
  isAvailable: boolean;
  availabilityMessage: string;
  shop: OfferShop;
  product: OfferProduct | null;
};
