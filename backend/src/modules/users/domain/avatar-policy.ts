export const AVATAR_FIELD_NAME = 'file';

export const AVATAR_MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
export const AVATAR_MAX_UPLOAD_MIB = AVATAR_MAX_UPLOAD_BYTES / (1024 * 1024);

export const AVATAR_ACCEPTED_FORMATS = ['jpeg', 'png', 'webp'] as const;
export type AvatarInputFormat = (typeof AVATAR_ACCEPTED_FORMATS)[number];
export const AVATAR_ACCEPTED_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;
export const AVATAR_ACCEPTED_LABEL = 'JPEG, PNG or WebP';

export const AVATAR_MAX_INPUT_PIXELS = 24_000_000;
export const AVATAR_MAX_INPUT_MEGAPIXELS = AVATAR_MAX_INPUT_PIXELS / 1_000_000;

export const AVATAR_MAX_DIMENSION = 256;
export const AVATAR_MAX_OUTPUT_BYTES = 128 * 1024;
export const AVATAR_OUTPUT_CONTENT_TYPE = 'image/webp';
