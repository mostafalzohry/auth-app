import {
  Body,
  ConflictException,
  Controller,
  HttpCode,
  Post,
  UseInterceptors,
} from '@nestjs/common';
import { NoStoreInterceptor } from '../../../common/interceptors/no-store.interceptor';
import { toPublicUser } from '../../users/domain/public-user';
import { DuplicateEmailError } from '../../users/domain/user.errors';
import { AuthService } from '../application/auth.service';
import { SignupDto } from './dto/signup.dto';

@Controller('api/auth')
@UseInterceptors(NoStoreInterceptor)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @HttpCode(201)
  async signup(@Body() dto: SignupDto) {
    try {
      const user = await this.authService.signup(dto);
      return { user: toPublicUser(user) };
    } catch (error) {
      if (error instanceof DuplicateEmailError) {
        throw new ConflictException('Email is already registered');
      }
      throw error;
    }
  }
}
