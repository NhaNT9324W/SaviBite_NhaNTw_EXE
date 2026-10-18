
export const SYSTEM_ROLE = {
  USER: 'USER',
  ADMIN: 'ADMIN',
} as const;

export const SHOP_ROLE = {
  OWNER: 'OWNER',
  STAFF: 'STAFF',
} as const;

export type SystemRole =
  (typeof SYSTEM_ROLE)[keyof typeof SYSTEM_ROLE];

export type ShopRole =
  (typeof SHOP_ROLE)[keyof typeof SHOP_ROLE];

export type AppMode = 'customer' | 'shop' | 'admin';

export type ShopMembership = {
  shopId: string;
  shopName: string;
  role: ShopRole;
  status: string;
};

export function canAccessAdmin(
  systemRole: SystemRole,
): boolean {
  return systemRole === SYSTEM_ROLE.ADMIN;
}

export function canAccessShop(
  memberships: ShopMembership[],
): boolean {
  return memberships.some(
    (membership) => membership.status === 'ACTIVE',
  );
}

export function canManageMembers(
  memberships: ShopMembership[],
  shopId: string,
): boolean {
  return memberships.some(
    (membership) =>
      membership.shopId === shopId &&
      membership.role === SHOP_ROLE.OWNER &&
      membership.status === 'ACTIVE',
  );
}
