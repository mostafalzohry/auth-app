import type { Request } from 'express';
import { User } from '../../users/domain/user.types';

export interface AuthenticatedRequest extends Request {
  authUser: User;
}
