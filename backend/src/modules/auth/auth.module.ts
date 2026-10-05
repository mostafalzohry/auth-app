import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';
import { ACCESS_TOKEN_SERVICE } from './application/access-token.port';
import { AuthService } from './application/auth.service';
import { PASSWORD_HASHER } from './application/password-hasher.port';
import { Argon2PasswordHasher } from './infrastructure/argon2-password-hasher';
import {
  AUTH_COOKIE_SECURE,
  AuthCookieAdapter,
} from './infrastructure/auth-cookie.adapter';
import { JwtAccessTokenService } from './infrastructure/jwt-access-token.service';
import { AccessTokenGuard } from './presentation/access-token.guard';
import { AuthController } from './presentation/auth.controller';

@Module({
  imports: [UsersModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthCookieAdapter,
    AccessTokenGuard,
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
