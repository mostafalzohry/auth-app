import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '../application/auth.service';
import { AuthCookieAdapter } from '../infrastructure/auth-cookie.adapter';
import type { AuthenticatedRequest } from './authenticated-request';

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly cookies: AuthCookieAdapter,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.cookies.read(req);
    if (!token) throw new UnauthorizedException();

    const user = await this.authService.authenticate(token);
    if (!user) throw new UnauthorizedException();

    req.authUser = user;
    return true;
  }
}
