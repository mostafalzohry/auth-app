import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AvatarService } from './application/avatar.service';
import { AVATAR_PROCESSOR } from './domain/avatar-processor.port';
import { USER_REPOSITORY } from './domain/user-repository.port';
import { MongooseUserRepository } from './infrastructure/mongoose-user.repository';
import { SharpAvatarProcessor } from './infrastructure/sharp-avatar-processor';
import { USER_MODEL, UserSchema } from './infrastructure/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: USER_MODEL, schema: UserSchema }]),
  ],
  providers: [
    { provide: USER_REPOSITORY, useClass: MongooseUserRepository },
    { provide: AVATAR_PROCESSOR, useClass: SharpAvatarProcessor },
    AvatarService,
  ],
  exports: [USER_REPOSITORY, AvatarService],
})
export class UsersModule {}
