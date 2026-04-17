import api from './client';
import type {
  PaginatedResponse,
  PromocodesAnalyticsRow,
  PromoUsageRow,
  UsersAnalyticsRow
} from './types';

export type AnalyticsQuery = {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  email?: string;
  name?: string;
  phone?: string;
  code?: string;
  status?: 'active' | 'inactive';
  promoCode?: string;
  userEmail?: string;
  userName?: string;
};

export async function fetchUsersAnalytics(
  params: AnalyticsQuery
): Promise<PaginatedResponse<UsersAnalyticsRow>> {
  const { data } = await api.get<PaginatedResponse<UsersAnalyticsRow>>('/analytics/users', {
    params
  });
  return data;
}

export async function fetchPromocodesAnalytics(
  params: AnalyticsQuery
): Promise<PaginatedResponse<PromocodesAnalyticsRow>> {
  const { data } = await api.get<PaginatedResponse<PromocodesAnalyticsRow>>('/analytics/promocodes', {
    params
  });
  return data;
}

export async function fetchPromoUsages(
  params: AnalyticsQuery
): Promise<PaginatedResponse<PromoUsageRow>> {
  const { data } = await api.get<PaginatedResponse<PromoUsageRow>>('/analytics/promo-usages', {
    params
  });
  return data;
}
