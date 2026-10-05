import { normalizeEmail } from '../../../users/domain/normalize-email';

export const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export const normalizeEmailInput = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? normalizeEmail(value) : value;
