import { ApiError } from "@/lib/api";
import {
  AVATAR_MAX_BYTES,
  AVATAR_MAX_MB,
  AVATAR_TYPES,
} from "@/lib/avatar-policy";

export function validateAvatarFile(file: File): string | null {
  if (!AVATAR_TYPES.includes(file.type)) {
    return "Choose a JPEG, PNG or WebP image.";
  }
  if (file.size === 0) return "That file is empty.";
  if (file.size > AVATAR_MAX_BYTES) {
    return `That image is larger than ${AVATAR_MAX_MB} MB. Choose a smaller one.`;
  }
  return null;
}

export function avatarUploadErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return "Your photo could not be saved. Please try again.";
  }
  switch (error.status) {
    case 0:
      return "We could not reach the server. Please check your connection and try again.";
    case 400:
      return "That image could not be read. Try a different photo.";
    case 401:
      return "Your session has ended. Please sign in again.";
    case 413:
      return "That image is too large. Choose a smaller one.";
    case 415:
      return "Choose a JPEG, PNG or WebP image.";
    case 429:
      return "You have uploaded too many times. Please try again later.";
    default:
      return "Your photo could not be saved. Please try again.";
  }
}
