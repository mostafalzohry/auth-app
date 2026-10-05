import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from '../users/users.module';
import { ACCESS_TOKEN_SERVICE } from './application/access-token.port';
import { AuthService } from './application/auth.service';
import { PASSWORD_HASHER } from './application/password-hasher.port';
import { RATE_LIMITER } from './application/rate-limiter.port';
import { Argon2PasswordHasher } from './infrastructure/argon2-password-hasher';
import {
  AUTH_COOKIE_SECURE,
  AuthCookieAdapter,
} from './infrastructure/auth-cookie.adapter';
import { JwtAccessTokenService } from './infrastructure/jwt-access-token.service';
import { MongoRateLimiter } from './infrastructure/mongo-rate-limiter';
import {
  RATE_LIMIT_MODEL,
  RateLimitBucketSchema,
} from './infrastructure/rate-limit-bucket.schema';
import { AccessTokenGuard } from './presentation/access-token.guard';
import { AuthController } from './presentation/auth.controller';
import { RateLimitGuard } from './presentation/rate-limit.guard';

@Module({
  imports: [
    UsersModule,
    JwtModule.register({}),
    MongooseModule.forFeature([
      { name: RATE_LIMIT_MODEL, schema: RateLimitBucketSchema },
    ]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthCookieAdapter,
    AccessTokenGuard,
    RateLimitGuard,
    { provide: RATE_LIMITER, useClass: MongoRateLimiter },
    { provide: ACCESS_TOKEN_SERVICE, useClass: JwtAccessTokenService },
    {
      provide: AUTH_COOKIE_SECURE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        config.getOrThrow<string>('NODE_ENV') === 'production',
    },
    { provide: PASSWORD_HASHER, useClass: Argon2PasswordHasher },
  ],
})
export class AuthModule {}
