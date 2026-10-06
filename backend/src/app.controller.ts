import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('app')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @ApiOperation({ summary: 'Root greeting' })
  @ApiOkResponse({
    description: 'Plain text greeting.',
    content: {
      'text/html': { schema: { type: 'string', example: 'hi i am mostafa' } },
    },
  })
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
