import { AuthService } from '../application/auth.service';
import { AuthController } from './auth.controller';

describe('AuthController.signup', () => {
  it('returns only public fields even if the service returns more', async () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const service = {
      signup: jest.fn().mockResolvedValue({
        id: '1',
        name: 'Jane',
        email: 'jane@example.com',
        createdAt: now,
        updatedAt: now,
        passwordHash: 'secret-hash',
        _id: 'internal',
        __v: 0,
      }),
    };
    const controller = new AuthController(service as unknown as AuthService);

    const result = await controller.signup({
      name: 'Jane',
      email: 'jane@example.com',
      password: 'Sup3r-secret!',
    });

    expect(result).toEqual({
      user: {
        id: '1',
        name: 'Jane',
        email: 'jane@example.com',
        createdAt: now,
        updatedAt: now,
      },
    });
    expect(Object.keys(result.user).sort()).toEqual([
      'createdAt',
      'email',
      'id',
      'name',
      'updatedAt',
    ]);
    expect(JSON.stringify(result)).not.toContain('secret-hash');
  });
});
