
export type CartItem = {
  offerId: string;
  offerType: 'FLASH_SALE' | 'SAVIBITE_BOX';
  title: string;
  shopId: string;
  shopName: string;
  shopAddress: string;
  unitPrice: number;
  originalValue: number;
  availableQuantity: number;
  saleEndAt: string;
  pickupStartAt: string;
  pickupEndAt: string;
  imageUrl: string | null;
  quantity: number;
};

export type CartAddInput = Omit<CartItem, 'quantity'>;

export type CartAddResult =
  | 'ADDED'
  | 'SHOP_CONFLICT'
  | 'UNAVAILABLE';

export type CartContextValue = {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  shopId: string | null;
  shopName: string | null;
  addItem: (
    item: CartAddInput,
    quantity: number
  ) => CartAddResult;
  replaceCart: (
    item: CartAddInput,
    quantity: number
  ) => CartAddResult;
  updateQuantity: (
    offerId: string,
    quantity: number
  ) => void;
  removeItem: (offerId: string) => void;
  clearCart: () => void;
};
