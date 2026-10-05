import { mongo } from 'mongoose';

export interface StoredBucket {
  _id: string;
  count: number;
  expiresAt: Date;
}

export interface FindOneAndUpdateCall {
  filter: unknown;
  update: unknown;
  options: unknown;
}

type Update = {
  $inc: { count: number };
  $setOnInsert: { expiresAt: Date };
};

export function duplicateKeyError() {
  return new mongo.MongoServerError({
    message: 'E11000 duplicate key error mongodb://user:dbSecret@host/db',
    code: 11000,
  });
}

export class InMemoryRateLimitModel {
  failWith?: Error;
  duplicateKeyFailures = 0;
  readonly calls: FindOneAndUpdateCall[] = [];
  private readonly buckets = new Map<string, StoredBucket>();

  findOneAndUpdate(filter: { _id: string }, update: Update, options: unknown) {
    this.calls.push({ filter, update, options });
    return {
      lean: (): Promise<StoredBucket | null> => {
        if (this.failWith) return Promise.reject(this.failWith);
        if (this.duplicateKeyFailures > 0) {
          this.duplicateKeyFailures--;
          return Promise.reject(duplicateKeyError());
        }
        const existing = this.buckets.get(filter._id);
        const bucket = existing ?? {
          _id: filter._id,
          count: 0,
          expiresAt: update.$setOnInsert.expiresAt,
        };
        bucket.count += update.$inc.count;
        this.buckets.set(bucket._id, bucket);
        return Promise.resolve({ ...bucket });
      },
    };
  }

  snapshot(): StoredBucket[] {
    return [...this.buckets.values()].map((bucket) => ({ ...bucket }));
  }
}
