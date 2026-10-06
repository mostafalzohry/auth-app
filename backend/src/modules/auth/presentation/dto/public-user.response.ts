import { ApiProperty } from '@nestjs/swagger';

export class PublicUserResponse {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  id: string;

  @ApiProperty({ example: 'Mostafa Elzohry' })
  name: string;

  @ApiProperty({ example: 'mostafa@example.com', format: 'email' })
  email: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;
}

export class UserEnvelopeResponse {
  @ApiProperty({ type: PublicUserResponse })
  user: PublicUserResponse;
}
