import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { normalizeEmail } from '../domain/normalize-email';
import { toPublicUser } from '../domain/public-user';
import { UserRepository } from '../domain/user-repository.port';
import { DuplicateEmailError } from '../domain/user.errors';
import { CreateUserInput, User, UserCredentials } from '../domain/user.types';
import { USER_MODEL, UserRecord } from './user.schema';

const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

type UserRow = Pick<
  UserRecord,
  'name' | 'email' | 'createdAt' | 'updatedAt'
> & {
  _id: Types.ObjectId;
};

function toUser(row: UserRow): User {
  return toPublicUser({
    id: row._id.toString(),
    name: row.name,
    email: row.email,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function isDuplicateEmailError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const { code, keyPattern } = error as {
    code?: unknown;
    keyPattern?: Record<string, unknown>;
  };
  return code === 11000 && keyPattern?.email !== undefined;
}

@Injectable()
export class MongooseUserRepository implements UserRepository {
  constructor(
    @InjectModel(USER_MODEL) private readonly users: Model<UserRecord>,
  ) {}

  async create(input: CreateUserInput): Promise<User> {
    try {
      const created = await this.users.create({
        name: input.name,
        email: normalizeEmail(input.email),
        passwordHash: input.passwordHash,
      });
      return toUser(created);
    } catch (error) {
      if (isDuplicateEmailError(error)) throw new DuplicateEmailError();
      throw error;
    }
  }

  async findById(id: string): Promise<User | null> {
    if (!OBJECT_ID_PATTERN.test(id)) return null;
    const row = await this.users.findById(id).lean();
    return row ? toUser(row) : null;
  }

  async findCredentialsByEmail(email: string): Promise<UserCredentials | null> {
    const row = await this.users
      .findOne({ email: normalizeEmail(email) })
      .select('+passwordHash')
      .lean();
    return row ? { ...toUser(row), passwordHash: row.passwordHash } : null;
  }
}
