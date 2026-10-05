import { INestApplication, Type } from '@nestjs/common';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { USER_REPOSITORY } from '../../src/modules/users/domain/user-repository.port';
import type { UserRepository } from '../../src/modules/users/domain/user-repository.port';
import type {
  CreateUserInput,
  User,
  UserCredentials,
} from '../../src/modules/users/domain/user.types';
import { USER_MODEL } from '../../src/modules/users/infrastructure/user.schema';

export function snapshotEnv() {
  return { ...process.env };
}

export function restoreEnv(original: NodeJS.ProcessEnv) {
  for (const key of Object.keys(process.env)) {
    if (!(key in original)) delete process.env[key];
  }
  Object.assign(process.env, original);
}

export async function loadAppModule(): Promise<Type<unknown>> {
  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = 'mongodb://localhost:27017/auth_app_test';
  const { AppModule } = await import('../../src/app.module');
  return AppModule;
}

export function createUserRepositoryDouble() {
  return {
    create: jest.fn<Promise<User>, [CreateUserInput]>(),
    findById: jest.fn<Promise<User | null>, [string]>(),
    findCredentialsByEmail: jest.fn<
      Promise<UserCredentials | null>,
      [string]
    >(),
  };
}

export async function createTestApp(
  AppModule: Type<unknown>,
  userRepository: UserRepository,
): Promise<INestApplication> {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(getConnectionToken())
    .useValue({ close: () => Promise.resolve() })
    .overrideProvider(getModelToken(USER_MODEL))
    .useValue({})
    .overrideProvider(USER_REPOSITORY)
    .useValue(userRepository)
    .compile();

  const app = moduleFixture.createNestApplication();
  await app.init();
  return app;
}
