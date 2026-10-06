import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { createCsrfMiddleware } from './common/middleware/csrf.middleware';
import { noStoreMiddleware } from './common/middleware/no-store.middleware';
import { parseAllowedOrigins } from './config/allowed-origins';

export interface AppSetupOptions {
  production?: boolean;
  trustProxyHops?: number;
}

export function configureApp(
  app: NestExpressApplication,
  options: AppSetupOptions = {},
): void {
  const config = app.get(ConfigService);
  const production =
    options.production ??
    config.getOrThrow<string>('NODE_ENV') === 'production';
  const trustProxyHops =
    options.trustProxyHops ??
    (production ? config.getOrThrow<number>('TRUST_PROXY_HOPS') : 0);
  const allowedOrigins = parseAllowedOrigins(
    config.getOrThrow<string>('AUTH_ALLOWED_ORIGINS'),
  );
  const trustedOrigins = new Set(allowedOrigins);

  if (trustProxyHops > 0) {
    app.set('trust proxy', trustProxyHops);
  }

  app.use('/api/auth', noStoreMiddleware);
  app.enableCors({
    origin: (origin: string | undefined, callback) =>
      callback(null, origin !== undefined && trustedOrigins.has(origin)),
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Auth-Request'],
    exposedHeaders: ['Retry-After'],
    maxAge: 600,
  });
  app.use(
    '/api/auth',
    createCsrfMiddleware({
      allowedOrigins,
      bodylessPaths: ['/logout'],
      multipartPaths: ['/avatar'],
    }),
  );
}
