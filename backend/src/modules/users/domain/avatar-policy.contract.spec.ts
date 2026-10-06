import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  AVATAR_ACCEPTED_CONTENT_TYPES,
  AVATAR_FIELD_NAME,
  AVATAR_MAX_UPLOAD_BYTES,
} from './avatar-policy';

const FRONTEND_POLICY = join(
  __dirname,
  '../../../../../frontend/lib/avatar-policy.ts',
);

const describeIfFrontend = existsSync(FRONTEND_POLICY)
  ? describe
  : describe.skip;

describeIfFrontend('avatar policy contract with the frontend', () => {
  const source = readFileSync(FRONTEND_POLICY, 'utf8');

  it('uses the same multipart field name', () => {
    const match = /AVATAR_FIELD_NAME\s*=\s*"([^"]+)"/.exec(source);

    expect(match?.[1]).toBe(AVATAR_FIELD_NAME);
  });

  it('uses the same maximum upload size', () => {
    const match = /AVATAR_MAX_BYTES\s*=\s*([\d\s*]+);/.exec(source);
    const bytes = (match?.[1] ?? '')
      .split('*')
      .map((factor) => Number(factor.trim()))
      .reduce((product, factor) => product * factor, 1);

    expect(bytes).toBe(AVATAR_MAX_UPLOAD_BYTES);
  });

  it('accepts the same content types', () => {
    const match = /AVATAR_TYPES\s*=\s*\[([^\]]+)\]/.exec(source);
    const types = [...(match?.[1] ?? '').matchAll(/"([^"]+)"/g)].map(
      (m) => m[1],
    );

    expect(types).toEqual([...AVATAR_ACCEPTED_CONTENT_TYPES]);
  });
});
