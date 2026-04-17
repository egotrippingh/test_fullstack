export type PaginatedMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type PaginatedResponse<T> = {
  data: T[];
  meta: PaginatedMeta;
};

export type User = {
  _id?: string;
  id?: string;
  email: string;
  name: string;
  phone: string;
  role: 'admin' | 'user';
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type PromoCode = {
  _id: string;
  code: string;
  discountPercent: number;
  totalUsageLimit: number;
  perUserUsageLimit: number;
  usedCount: number;
  dateFrom?: string | null;
  dateTo?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type Order = {
  _id: string;
  amount: number;
  finalAmount: number;
  discountAmount: number;
  promoCodeId?: string | null;
  promoCodeCode?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type UsersAnalyticsRow = {
  user_id: string;
  email: string;
  name: string;
  phone: string;
  is_active: number;
  orders_count: number;
  total_spent: number | null;
  total_discount: number | null;
  promo_usages: number;
};

export type PromocodesAnalyticsRow = {
  promocode_id: string;
  code: string;
  discount_percent: number;
  is_active: number;
  usages: number;
  revenue: number | null;
  total_discount: number | null;
  unique_users: number;
};

export type PromoUsageRow = {
  usage_id: string;
  promocode_id: string;
  promo_code: string;
  user_id: string;
  user_email: string;
  user_name: string;
  order_id: string;
  order_amount: number;
  discount_amount: number;
  created_at: string;
};
