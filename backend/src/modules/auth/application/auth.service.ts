import { Inject, Injectable } from '@nestjs/common';
import { USER_REPOSITORY } from '../../users/domain/user-repository.port';
import type { UserRepository } from '../../users/domain/user-repository.port';
import { User } from '../../users/domain/user.types';
import { PASSWORD_HASHER } from './password-hasher.port';
import type { PasswordHasher } from './password-hasher.port';

export interface SignupInput {
  name: string;
  email: string;
  password: string;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
  ) {}

  async signup(input: SignupInput): Promise<User> {
    const passwordHash = await this.passwordHasher.hash(input.password);
    return this.users.create({
      name: input.name,
      email: input.email,
      passwordHash,
    });
  }
}
