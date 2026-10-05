import { randomBytes } from 'node:crypto';
import { normalizeEmail } from '../../src/modules/users/domain/normalize-email';
import { toPublicUser } from '../../src/modules/users/domain/public-user';
import type { UserRepository } from '../../src/modules/users/domain/user-repository.port';
import { DuplicateEmailError } from '../../src/modules/users/domain/user.errors';
import type {
  CreateUserInput,
  User,
  UserCredentials,
} from '../../src/modules/users/domain/user.types';

export class InMemoryUserRepository implements UserRepository {
  failFindById = false;
  failFindCredentials = false;
  private readonly users = new Map<string, UserCredentials>();

  create(input: CreateUserInput): Promise<User> {
    const email = normalizeEmail(input.email);
    for (const user of this.users.values()) {
      if (user.email === email)
        return Promise.reject(new DuplicateEmailError());
    }
    const now = new Date();
    const user: UserCredentials = {
      id: randomBytes(12).toString('hex'),
      name: input.name,
      email,
      passwordHash: input.passwordHash,
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(user.id, user);
    return Promise.resolve(toPublicUser(user));
  }

  findById(id: string): Promise<User | null> {
    if (this.failFindById) return Promise.reject(new Error('database down'));
    const user = this.users.get(id);
    return Promise.resolve(user ? toPublicUser(user) : null);
  }

  findCredentialsByEmail(email: string): Promise<UserCredentials | null> {
    if (this.failFindCredentials) {
      return Promise.reject(new Error('database down'));
    }
    const normalized = normalizeEmail(email);
    for (const user of this.users.values()) {
      if (user.email === normalized) return Promise.resolve({ ...user });
    }
    return Promise.resolve(null);
  }

  remove(id: string): void {
    this.users.delete(id);
  }
}
