
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import { ROUTES } from './routes';

export type NavIcon = ComponentProps<typeof Ionicons>['name'];

export type NavigationItem = {
  key: string;
  label: string;
  href: string;
  icon: NavIcon;
};

export const CUSTOMER_NAV: NavigationItem[] = [
  {
    key: 'home',
    label: 'Trang chủ',
    href: ROUTES.customer.home,
    icon: 'home-outline',
  },
  {
    key: 'offers',
    label: 'Khám phá',
    href: ROUTES.customer.offers,
    icon: 'compass-outline',
  },
  {
    key: 'cart',
    label: 'Giỏ hàng',
    href: ROUTES.customer.cart,
    icon: 'bag-handle-outline',
  },
  {
    key: 'pickups',
    label: 'Đơn nhận',
    href: ROUTES.customer.pickups,
    icon: 'receipt-outline',
  },
  {
    key: 'profile',
    label: 'Tài khoản',
    href: ROUTES.customer.profile,
    icon: 'person-outline',
  },
];

export const SHOP_NAV: NavigationItem[] = [
  {
    key: 'dashboard',
    label: 'Tổng quan',
    href: ROUTES.shop.dashboard,
    icon: 'grid-outline',
  },
  {
    key: 'products',
    label: 'Sản phẩm',
    href: ROUTES.shop.products,
    icon: 'cube-outline',
  },
  {
    key: 'flashSales',
    label: 'Flash Sale',
    href: ROUTES.shop.flashSales,
    icon: 'flash-outline',
  },
  {
    key: 'boxes',
    label: 'SaviBite Box',
    href: ROUTES.shop.boxes,
    icon: 'gift-outline',
  },
  {
    key: 'orders',
    label: 'Đơn hàng',
    href: ROUTES.shop.orders,
    icon: 'receipt-outline',
  },
  {
    key: 'pickups',
    label: 'Xác nhận nhận',
    href: ROUTES.shop.pickups,
    icon: 'checkmark-circle-outline',
  },
  {
    key: 'members',
    label: 'Nhân viên',
    href: ROUTES.shop.members,
    icon: 'people-outline',
  },
];

export const ADMIN_NAV: NavigationItem[] = [
  {
    key: 'dashboard',
    label: 'Tổng quan',
    href: ROUTES.admin.dashboard,
    icon: 'grid-outline',
  },
  {
    key: 'users',
    label: 'Người dùng',
    href: ROUTES.admin.users,
    icon: 'people-outline',
  },
  {
    key: 'shops',
    label: 'Cửa hàng',
    href: ROUTES.admin.shops,
    icon: 'storefront-outline',
  },
  {
    key: 'offers',
    label: 'Ưu đãi',
    href: ROUTES.admin.offers,
    icon: 'pricetag-outline',
  },
  {
    key: 'refunds',
    label: 'Hoàn tiền',
    href: ROUTES.admin.refunds,
    icon: 'wallet-outline',
  },
];
