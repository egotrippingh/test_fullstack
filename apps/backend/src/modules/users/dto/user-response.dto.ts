export class UserResponseDto {
  _id!: string;
  id!: string;
  email!: string;
  name!: string;
  phone!: string;
  role!: 'admin' | 'user';
  isActive!: boolean;
  createdAt!: Date;
  updatedAt!: Date;
}
