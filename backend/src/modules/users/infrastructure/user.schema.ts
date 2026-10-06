import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export const USER_MODEL = 'User';

@Schema({ collection: 'users', timestamps: true })
export class UserRecord {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true, lowercase: true })
  email: string;

  @Prop({ required: true, select: false })
  passwordHash: string;

  @Prop({ type: Buffer, select: false })
  avatarData?: Buffer;

  @Prop({ type: String })
  avatarContentType?: string;

  @Prop({ type: Number })
  avatarVersion?: number;

  createdAt: Date;
  updatedAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(UserRecord);

UserSchema.index({ email: 1 }, { unique: true });
