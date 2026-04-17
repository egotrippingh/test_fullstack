import axios from 'axios';

import { apiBaseUrl } from '../config';

export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type RegisterPayload = {
  email: string;
  password: string;
  name: string;
  phone: string;
};

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const { data } = await axios.post<AuthResponse>(`${apiBaseUrl}/auth/login`, payload);
  return data;
}

export async function register(payload: RegisterPayload): Promise<AuthResponse> {
  const { data } = await axios.post<AuthResponse>(`${apiBaseUrl}/auth/register`, payload);
  return data;
}

export async function refreshSession(refreshToken: string): Promise<AuthResponse> {
  const { data } = await axios.post<AuthResponse>(`${apiBaseUrl}/auth/refresh`, { refreshToken });
  return data;
}

export async function logout(refreshToken: string): Promise<void> {
  await axios.post(`${apiBaseUrl}/auth/logout`, { refreshToken });
}
