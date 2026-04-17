export type UserRole = 'admin' | 'user';

export interface AuthenticatedUser {
  sub: string;
  email: string;
  role: UserRole;
}

