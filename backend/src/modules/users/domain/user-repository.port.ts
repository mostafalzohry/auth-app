import { CreateUserInput, User, UserCredentials } from './user.types';

export interface UserRepository {
  create(input: CreateUserInput): Promise<User>;
  findById(id: string): Promise<User | null>;
  findCredentialsByEmail(email: string): Promise<UserCredentials | null>;
}

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
