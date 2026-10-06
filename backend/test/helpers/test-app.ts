import { Type } from '@nestjs/common';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { configureApp } from '../../src/app.setup';
import { configureSwagger } from '../../src/swagger.setup';
import { AUTH_COOKIE_SECURE } from '../../src/modules/auth/infrastructure/auth-cookie.adapter';
import { RATE_LIMIT_MODEL } from '../../src/modules/auth/infrastructure/rate-limit-bucket.schema';
import { USER_REPOSITORY } from '../../src/modules/users/domain/user-repository.port';
import type { UserRepository } from '../../src/modules/users/domain/user-repository.port';
import type {
  CreateUserInput,
  User,
  UserCredentials,
} from '../../src/modules/users/domain/user.types';
import { USER_MODEL } from '../../src/modules/users/infrastructure/user.schema';
import { InMemoryRateLimitModel } from './in-memory-rate-limit-model';

export const TEST_JWT_SECRET = 'test-only-jwt-secret-0123456789abcdef-xyz';
export const TEST_ORIGIN = 'http://localhost:5173';
export const TEST_ALLOWED_ORIGINS = `${TEST_ORIGIN},http://127.0.0.1:5173`;
export const CSRF_HEADERS = { Origin: TEST_ORIGIN, 'X-Auth-Request': '1' };

export function api(server: App) {
  return {
    get: (path: string) => request(server).get(path).set(CSRF_HEADERS),
    post: (path: string) => request(server).post(path).set(CSRF_HEADERS),
  };
}

export function apiAgent(server: App) {
  return request.agent(server).set(CSRF_HEADERS);
}

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
  process.env.JWT_SECRET = TEST_JWT_SECRET;
  process.env.AUTH_ALLOWED_ORIGINS = TEST_ALLOWED_ORIGINS;
  const { AppModule } =
    require('../../src/app.module') as typeof import('../../src/app.module');
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

export interface TestAppOptions {
  production?: boolean;
  trustProxyHops?: number;
  rateLimitModel?: InMemoryRateLimitModel;
  swagger?: boolean;
}

export async function createTestApp(
  AppModule: Type<unknown>,
  userRepository: UserRepository,
  options: TestAppOptions = {},
): Promise<NestExpressApplication> {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(getConnectionToken())
    .useValue({ close: () => Promise.resolve() })
    .overrideProvider(getModelToken(USER_MODEL))
    .useValue({})
    .overrideProvider(USER_REPOSITORY)
    .useValue(userRepository)
    .overrideProvider(getModelToken(RATE_LIMIT_MODEL))
    .useValue(options.rateLimitModel ?? new InMemoryRateLimitModel())
    .overrideProvider(AUTH_COOKIE_SECURE)
    .useValue(options.production === true)
    .compile();

  const app = moduleFixture.createNestApplication<NestExpressApplication>();
  configureApp(app, {
    production: options.production,
    trustProxyHops: options.trustProxyHops ?? 0,
  });
  if (options.swagger) configureSwagger(app);
  await app.init();
  return app;
}
