import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { normalizeEmail } from '../../../users/domain/normalize-email';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const normalize = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? normalizeEmail(value) : value;

export class SignupDto {
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name: string;

  @Transform(normalize)
  @IsString()
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/\p{L}/u, { message: 'password must contain at least one letter' })
  @Matches(/\p{N}/u, { message: 'password must contain at least one number' })
  @Matches(/[^\p{L}\p{N}\s]/u, {
    message: 'password must contain at least one special character',
  })
  password: string;
}
