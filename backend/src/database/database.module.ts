import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { MongooseError } from 'mongoose';

export function sanitizeConnectionError(error: MongooseError): MongooseError {
  return new MongooseError(
    `Unable to connect to MongoDB (${error.name}). Check MONGODB_URI, credentials and network access.`,
  );
}

@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('MONGODB_URI'),
        maxPoolSize: 5,
        serverSelectionTimeoutMS: 10000,
        retryAttempts: 3,
        retryDelay: 2000,
        connectionErrorFactory: sanitizeConnectionError,
      }),
    }),
  ],
})
export class DatabaseModule {}
