import api from './client';
import type { PaginatedResponse, PromoCode } from './types';

export type PromoCodePayload = {
  code: string;
  discountPercent: number;
  totalUsageLimit: number;
  perUserUsageLimit: number;
  dateFrom?: string | null;
  dateTo?: string | null;
  isActive?: boolean;
};

export async function listPromocodes(params: {
  page: number;
  pageSize: number;
}): Promise<PaginatedResponse<PromoCode>> {
  const { data } = await api.get<PaginatedResponse<PromoCode>>('/promocodes', { params });
  return data;
}

export async function createPromocode(payload: PromoCodePayload): Promise<PromoCode> {
  const { data } = await api.post<PromoCode>('/promocodes', payload);
  return data;
}

export async function updatePromocode(
  id: string,
  payload: Partial<PromoCodePayload>
): Promise<PromoCode> {
  const { data } = await api.patch<PromoCode>(`/promocodes/${id}`, payload);
  return data;
}

export async function deactivatePromocode(id: string): Promise<PromoCode> {
  const { data } = await api.patch<PromoCode>(`/promocodes/${id}/deactivate`);
  return data;
}
