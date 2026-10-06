import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { normalizeEmailInput } from './transforms';

export class SigninDto {
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
    minLength: 1,
    maxLength: 128,
    format: 'password',
    description:
      'Required and non-empty. Signup complexity rules are not applied. Never trimmed or transformed.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password: string;
}
