import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AvatarController } from './presentation/avatar.controller';
import { AvatarUploadInterceptor } from './presentation/avatar-upload.interceptor';
import { UsersModule } from './users.module';

@Module({
  imports: [UsersModule, AuthModule],
  controllers: [AvatarController],
  providers: [AvatarUploadInterceptor],
})
export class AvatarModule {}
