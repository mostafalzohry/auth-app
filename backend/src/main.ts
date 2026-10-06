import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { SanitizedLogger } from './database/sanitized-logger';
import { configureSwagger } from './swagger.setup';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: new SanitizedLogger(),
  });
  configureApp(app);
  const config = app.get(ConfigService);
  configureSwagger(app, {
    cdnAssets: config.getOrThrow<string>('NODE_ENV') === 'production',
  });
  const port = config.getOrThrow<number>('PORT');
  await app.listen(port);
}

bootstrap().catch((error: unknown) => {
  Logger.error(error, 'Bootstrap');
  process.exit(1);
});
