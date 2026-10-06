import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { normalizeEmailInput, trimString } from './transforms';

export class SignupDto {
  @ApiProperty({
    example: 'Mostafa Elzohry',
    minLength: 3,
    maxLength: 100,
    description: 'Trimmed before validation.',
  })
  @Transform(trimString)
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name: string;

  @ApiProperty({
    example: 'mostafa@example.com',
    format: 'email',
    maxLength: 254,
    description: 'Trimmed and lowercased before validation.',
  })
  @Transform(normalizeEmailInput)
  @IsString()
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({
    example: 'ChangeMe-123!',
    minLength: 8,
    maxLength: 128,
    format: 'password',
    description:
      'Must contain at least one letter, one number and one special character (whitespace does not count as special). Never trimmed or transformed.',
  })
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
