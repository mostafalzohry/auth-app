import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { SanitizedLogger } from './database/sanitized-logger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new SanitizedLogger(),
  });
  const port = app.get(ConfigService).getOrThrow<number>('PORT');
  await app.listen(port);
}

bootstrap().catch((error: unknown) => {
  Logger.error(error, 'Bootstrap');
  process.exit(1);
});
