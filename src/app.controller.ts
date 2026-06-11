import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Default entry point / health check' })
  @ApiResponse({ status: 200, description: 'Return welcome message' })
  getHello(): string {
    return this.appService.getHello();
  }
}
