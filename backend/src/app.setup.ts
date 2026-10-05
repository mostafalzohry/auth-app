import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { noStoreMiddleware } from './common/middleware/no-store.middleware';
import { PRODUCTION_TRUSTED_PROXY_HOPS } from './modules/auth/infrastructure/auth-token.config';

export interface AppSetupOptions {
  production?: boolean;
}

export function configureApp(
  app: NestExpressApplication,
  options: AppSetupOptions = {},
): void {
  const production =
    options.production ??
    app.get(ConfigService).getOrThrow<string>('NODE_ENV') === 'production';

  if (production) {
    app.set('trust proxy', PRODUCTION_TRUSTED_PROXY_HOPS);
  }

  app.use('/api/auth', noStoreMiddleware);
}
