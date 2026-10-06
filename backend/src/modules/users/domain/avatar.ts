import { AVATAR_OUTPUT_CONTENT_TYPE } from './avatar-policy';

export interface AvatarImage {
  data: Buffer;
  contentType: typeof AVATAR_OUTPUT_CONTENT_TYPE;
}

export function avatarUrlFor(version: number): string {
  return `/api/auth/avatar?v=${version}`;
}
