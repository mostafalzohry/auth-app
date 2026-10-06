import { AvatarImage } from './avatar';

export type InvalidAvatarReason = 'unsupported' | 'corrupt' | 'too-large';

export class InvalidAvatarError extends Error {
  constructor(readonly reason: InvalidAvatarReason) {
    super(`Invalid avatar image (${reason})`);
    this.name = 'InvalidAvatarError';
  }
}

export interface AvatarProcessor {
  process(input: Buffer): Promise<AvatarImage>;
}

export const AVATAR_PROCESSOR = Symbol('AVATAR_PROCESSOR');
