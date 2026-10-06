export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserCredentials extends User {
  passwordHash: string;
}

export interface CreateUserInput {
  name: string;
  email: string;
  passwordHash: string;
}
