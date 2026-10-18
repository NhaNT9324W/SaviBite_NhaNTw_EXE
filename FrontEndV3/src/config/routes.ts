
export const ROUTES = {
  customer: {
    home: '/',
    offers: '/offers',
    cart: '/cart',
    checkout: '/checkout',
    pickups: '/pickups',
    profile: '/profile',
    reviews: '/reviews',
    refunds: '/refunds',
  },

  auth: {
    login: '/login',
    register: '/register',
    forgotPassword: '/forgot-password',
  },

  shop: {
    dashboard: '/shop',
    products: '/shop/products',
    flashSales: '/shop/flash-sales',
    boxes: '/shop/savibite-boxes',
    orders: '/shop/orders',
    pickups: '/shop/pickups',
    members: '/shop/members',
  },

  admin: {
    dashboard: '/admin',
    users: '/admin/users',
    shops: '/admin/shops',
    offers: '/admin/offers',
    refunds: '/admin/refunds',
  },

  offerDetail: (id: string) =>
    `/offer/${encodeURIComponent(id)}`,

  orderDetail: (id: string) =>
    `/order/${encodeURIComponent(id)}`,
} as const;
