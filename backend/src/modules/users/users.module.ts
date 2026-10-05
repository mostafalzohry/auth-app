import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { USER_REPOSITORY } from './domain/user-repository.port';
import { MongooseUserRepository } from './infrastructure/mongoose-user.repository';
import { USER_MODEL, UserSchema } from './infrastructure/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: USER_MODEL, schema: UserSchema }]),
  ],
  providers: [{ provide: USER_REPOSITORY, useClass: MongooseUserRepository }],
  exports: [USER_REPOSITORY],
})
export class UsersModule {}
