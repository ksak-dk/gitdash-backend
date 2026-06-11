import { Controller, Get, Patch, Body, UseGuards, Req } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UserSettings } from './entities/user-settings.entity';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('api/v1/users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('settings')
  @ApiOperation({ summary: 'Retrieve settings of the logged-in user' })
  @ApiResponse({ status: 200, description: 'Success in retrieving settings', type: UserSettings })
  @ApiResponse({ status: 401, description: 'Unauthorized access' })
  @ApiResponse({ status: 404, description: 'User settings not found' })
  async getSettings(@Req() req: any): Promise<UserSettings> {
    return this.usersService.getUserSettings(req.user.id);
  }

  @Patch('settings')
  @ApiOperation({ summary: 'Update settings of the logged-in user' })
  @ApiResponse({ status: 200, description: 'Settings successfully updated', type: UserSettings })
  @ApiResponse({ status: 401, description: 'Unauthorized access' })
  @ApiResponse({ status: 404, description: 'User settings not found' })
  async updateSettings(@Req() req: any, @Body() body: UpdateSettingsDto): Promise<UserSettings> {
    return this.usersService.updateUserSettings(req.user.id, body);
  }
}
