import api from './client';
import type { Order, PaginatedResponse } from './types';

export type CreateOrderPayload = {
  amount: number;
};

export type ApplyPromoPayload = {
  promoCode: string;
};

export async function createOrder(payload: CreateOrderPayload): Promise<Order> {
  const { data } = await api.post<Order>('/orders', payload);
  return data;
}

export async function listMyOrders(params: {
  page: number;
  pageSize: number;
}): Promise<PaginatedResponse<Order>> {
  const { data } = await api.get<PaginatedResponse<Order>>('/orders/my', { params });
  return data;
}

export async function applyPromoCode(orderId: string, payload: ApplyPromoPayload): Promise<Order> {
  const { data } = await api.post<Order>(`/orders/${orderId}/apply-promocode`, payload);
  return data;
}
