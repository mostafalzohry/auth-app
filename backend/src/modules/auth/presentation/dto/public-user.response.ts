import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PublicUserResponse {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  id: string;

  @ApiProperty({ example: 'Mostafa Elzohry' })
  name: string;

  @ApiProperty({ example: 'mostafa@example.com', format: 'email' })
  email: string;

  @ApiPropertyOptional({
    example: '/api/auth/avatar?v=2',
    description:
      'Relative URL of the current avatar (requires the auth cookie). Absent when the user has no avatar. The `v` value changes whenever the avatar is replaced. Image bytes are never part of any JSON response.',
  })
  avatarUrl?: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;
}

export class UserEnvelopeResponse {
  @ApiProperty({ type: PublicUserResponse })
  user: PublicUserResponse;
}
