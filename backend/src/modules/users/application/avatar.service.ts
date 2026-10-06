import { Inject, Injectable } from '@nestjs/common';
import { AvatarImage } from '../domain/avatar';
import { AVATAR_PROCESSOR } from '../domain/avatar-processor.port';
import type { AvatarProcessor } from '../domain/avatar-processor.port';
import { USER_REPOSITORY } from '../domain/user-repository.port';
import type { UserRepository } from '../domain/user-repository.port';
import { UserNotFoundError } from '../domain/user.errors';
import { User } from '../domain/user.types';

@Injectable()
export class AvatarService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(AVATAR_PROCESSOR) private readonly processor: AvatarProcessor,
  ) {}

  async replace(userId: string, input: Buffer): Promise<User> {
    const image = await this.processor.process(input);
    const user = await this.users.replaceAvatar(userId, image);
    if (!user) throw new UserNotFoundError();
    return user;
  }

  find(userId: string): Promise<AvatarImage | null> {
    return this.users.findAvatar(userId);
  }
}
