
import React, {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useState,
} from 'react';

import type {
    CartAddInput,
    CartAddResult,
    CartContextValue,
    CartItem,
} from '../types/cart.types';

const CartContext = createContext<CartContextValue | null>(
  null
);

function isCurrentlyAvailable(item: CartAddInput) {
  const endTime = new Date(item.saleEndAt).getTime();

  return (
    item.availableQuantity > 0 &&
    Number.isFinite(endTime) &&
    endTime > Date.now()
  );
}

function normalizeQuantity(
  quantity: number,
  availableQuantity: number
) {
  if (
    !Number.isFinite(quantity) ||
    !Number.isFinite(availableQuantity) ||
    availableQuantity < 1
  ) {
    return 0;
  }

  return Math.min(
    Math.max(1, Math.floor(quantity)),
    availableQuantity
  );
}

function createCartItem(
  item: CartAddInput,
  quantity: number
): CartItem {
  return {
    ...item,
    quantity,
  };
}

export function CartProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = useCallback(
    (
      item: CartAddInput,
      requestedQuantity: number
    ): CartAddResult => {
      const quantity = normalizeQuantity(
        requestedQuantity,
        item.availableQuantity
      );

      if (!isCurrentlyAvailable(item) || quantity === 0) {
        return 'UNAVAILABLE';
      }

      if (
        items.length > 0 &&
        items[0].shopId !== item.shopId
      ) {
        return 'SHOP_CONFLICT';
      }

      const existing = items.find(
        (current) => current.offerId === item.offerId
      );

      const nextQuantity = normalizeQuantity(
        (existing?.quantity ?? 0) + quantity,
        item.availableQuantity
      );

      setItems((current) => {
        const found = current.some(
          (entry) => entry.offerId === item.offerId
        );

        if (!found) {
          return [
            ...current,
            createCartItem(item, quantity),
          ];
        }

        return current.map((entry) =>
          entry.offerId === item.offerId
            ? createCartItem(item, nextQuantity)
            : entry
        );
      });

      return 'ADDED';
    },
    [items]
  );

  const replaceCart = useCallback(
    (
      item: CartAddInput,
      requestedQuantity: number
    ): CartAddResult => {
      const quantity = normalizeQuantity(
        requestedQuantity,
        item.availableQuantity
      );

      if (!isCurrentlyAvailable(item) || quantity === 0) {
        return 'UNAVAILABLE';
      }

      setItems([createCartItem(item, quantity)]);
      return 'ADDED';
    },
    []
  );

  const updateQuantity = useCallback(
    (offerId: string, requestedQuantity: number) => {
      setItems((current) =>
        current.map((item) => {
          if (item.offerId !== offerId) {
            return item;
          }

          return {
            ...item,
            quantity: normalizeQuantity(
              requestedQuantity,
              item.availableQuantity
            ),
          };
        })
      );
    },
    []
  );

  const removeItem = useCallback((offerId: string) => {
    setItems((current) =>
      current.filter(
        (item) => item.offerId !== offerId
      )
    );
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const value = useMemo<CartContextValue>(() => {
    const itemCount = items.reduce(
      (total, item) => total + item.quantity,
      0
    );

    const subtotal = items.reduce(
      (total, item) =>
        total + item.unitPrice * item.quantity,
      0
    );

    return {
      items,
      itemCount,
      subtotal,
      shopId: items[0]?.shopId ?? null,
      shopName: items[0]?.shopName ?? null,
      addItem,
      replaceCart,
      updateQuantity,
      removeItem,
      clearCart,
    };
  }, [
    items,
    addItem,
    replaceCart,
    updateQuantity,
    removeItem,
    clearCart,
  ]);

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error(
      'useCart phải được sử dụng bên trong CartProvider.'
    );
  }

  return context;
}
