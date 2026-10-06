import { INestApplication, Type } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  createTestApp,
  createUserRepositoryDouble,
  loadAppModule,
  restoreEnv,
  snapshotEnv,
} from './helpers/test-app';

describe('AppController (e2e)', () => {
  const originalEnv = snapshotEnv();
  let AppModule: Type<unknown>;
  let app: INestApplication<App>;

  beforeAll(async () => {
    AppModule = await loadAppModule();
  });

  afterAll(() => {
    restoreEnv(originalEnv);
  });

  beforeEach(async () => {
    app = await createTestApp(AppModule, createUserRepositoryDouble());
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('hi i am mostafa');
  });

  afterEach(async () => {
    await app.close();
  });
});
