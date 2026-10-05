import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AuthService } from './application/auth.service';
import { PASSWORD_HASHER } from './application/password-hasher.port';
import { Argon2PasswordHasher } from './infrastructure/argon2-password-hasher';
import { AuthController } from './presentation/auth.controller';

@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    { provide: PASSWORD_HASHER, useClass: Argon2PasswordHasher },
  ],
})
export class AuthModule {}
