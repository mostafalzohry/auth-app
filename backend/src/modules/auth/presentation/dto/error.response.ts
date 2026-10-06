import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ErrorResponse {
  @ApiProperty({ example: 400 })
  statusCode: number;

  @ApiProperty({
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    description:
      'A generic message. Validation errors (400) return an array of messages that never contain submitted values.',
    example: 'Invalid email or password',
  })
  message: string | string[];

  @ApiPropertyOptional({ example: 'Unauthorized' })
  error?: string;
}
