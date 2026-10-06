import { AvatarImage } from './avatar';
import { CreateUserInput, User, UserCredentials } from './user.types';

export interface UserRepository {
  create(input: CreateUserInput): Promise<User>;
  findById(id: string): Promise<User | null>;
  findCredentialsByEmail(email: string): Promise<UserCredentials | null>;
  replaceAvatar(userId: string, image: AvatarImage): Promise<User | null>;
  findAvatar(userId: string): Promise<AvatarImage | null>;
}

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
