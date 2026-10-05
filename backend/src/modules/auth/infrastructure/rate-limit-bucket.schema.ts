import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export const RATE_LIMIT_MODEL = 'RateLimitBucket';

@Schema({ collection: 'rate_limits', versionKey: false })
export class RateLimitBucketRecord {
  @Prop({ type: String })
  _id: string;

  @Prop({ required: true })
  count: number;

  @Prop({ required: true })
  expiresAt: Date;
}

export const RateLimitBucketSchema = SchemaFactory.createForClass(
  RateLimitBucketRecord,
);

RateLimitBucketSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
