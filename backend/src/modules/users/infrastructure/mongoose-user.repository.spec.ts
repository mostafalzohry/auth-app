import { Model } from 'mongoose';
import { DuplicateEmailError } from '../domain/user.errors';
import { MongooseUserRepository } from './mongoose-user.repository';
import { UserRecord } from './user.schema';

const ID = '507f1f77bcf86cd799439011';
const NOW = new Date('2026-01-01T00:00:00Z');

function row(extra: object = {}) {
  return {
    _id: { toString: () => ID },
    name: 'Jane',
    email: 'jane@example.com',
    createdAt: NOW,
    updatedAt: NOW,
    __v: 0,
    ...extra,
  };
}

function setup() {
  const query = {
    select: jest.fn().mockReturnThis(),
    lean: jest.fn(),
  };
  const model = {
    create: jest.fn(),
    findById: jest.fn().mockReturnValue(query),
    findOne: jest.fn().mockReturnValue(query),
  };
  const repository = new MongooseUserRepository(
    model as unknown as Model<UserRecord>,
  );
  return { model, query, repository };
}

const publicUser = {
  id: ID,
  name: 'Jane',
  email: 'jane@example.com',
  createdAt: NOW,
  updatedAt: NOW,
};

describe('MongooseUserRepository', () => {
  it('creates a user with a normalized email and returns the public user', async () => {
    const { model, repository } = setup();
    model.create.mockResolvedValue(row({ passwordHash: 'hash' }));

    const user = await repository.create({
      name: 'Jane',
      email: '  Jane@Example.com ',
      passwordHash: 'hash',
    });

    expect(model.create).toHaveBeenCalledWith({
      name: 'Jane',
      email: 'jane@example.com',
      passwordHash: 'hash',
    });
    expect(user).toEqual(publicUser);
    expect(user).not.toHaveProperty('passwordHash');
    expect(user).not.toHaveProperty('_id');
    expect(user).not.toHaveProperty('__v');
    expect(Object.keys(user).sort()).toEqual([
      'createdAt',
      'email',
      'id',
      'name',
      'updatedAt',
    ]);
  });

  it('translates a duplicate email error', async () => {
    const { model, repository } = setup();
    model.create.mockRejectedValue(
      Object.assign(new Error('E11000 duplicate key'), {
        code: 11000,
        keyPattern: { email: 1 },
      }),
    );

    await expect(
      repository.create({ name: 'Jane', email: 'a@b.co', passwordHash: 'h' }),
    ).rejects.toBeInstanceOf(DuplicateEmailError);
  });

  it('preserves unrelated errors, including duplicates on other keys', async () => {
    const { model, repository } = setup();
    const unrelated = new Error('network down');
    const otherKey = Object.assign(new Error('dup'), {
      code: 11000,
      keyPattern: { other: 1 },
    });
    const input = { name: 'Jane', email: 'a@b.co', passwordHash: 'h' };

    model.create.mockRejectedValueOnce(unrelated);
    await expect(repository.create(input)).rejects.toBe(unrelated);
    model.create.mockRejectedValueOnce(otherKey);
    await expect(repository.create(input)).rejects.toBe(otherKey);
  });

  it('finds a user by id without passwordHash', async () => {
    const { query, repository } = setup();
    query.lean.mockResolvedValue(row());

    const user = await repository.findById(ID);

    expect(user).toEqual(publicUser);
    expect(query.select).not.toHaveBeenCalled();
  });

  it('returns null for unknown and malformed ids without querying', async () => {
    const { model, query, repository } = setup();
    query.lean.mockResolvedValue(null);

    await expect(repository.findById(ID)).resolves.toBeNull();
    for (const bad of ['', 'not-an-id', '123456789012', `${ID}0`]) {
      await expect(repository.findById(bad)).resolves.toBeNull();
    }
    expect(model.findById).toHaveBeenCalledTimes(1);
  });

  it('explicitly selects passwordHash for credentials lookup', async () => {
    const { model, query, repository } = setup();
    query.lean.mockResolvedValue(row({ passwordHash: 'stored-hash' }));

    const credentials =
      await repository.findCredentialsByEmail(' Jane@Example.com');

    expect(model.findOne).toHaveBeenCalledWith({ email: 'jane@example.com' });
    expect(query.select).toHaveBeenCalledWith('+passwordHash');
    expect(credentials).toEqual({ ...publicUser, passwordHash: 'stored-hash' });
  });

  it('returns null when no credentials exist', async () => {
    const { query, repository } = setup();
    query.lean.mockResolvedValue(null);

    await expect(
      repository.findCredentialsByEmail('none@example.com'),
    ).resolves.toBeNull();
  });
});
