import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { GithubAuthGuard } from './guards/github-auth.guard';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Auth')
@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('login')
  @UseGuards(GithubAuthGuard)
  @ApiOperation({ summary: 'Initiate GitHub OAuth login flow' })
  @ApiResponse({ status: 302, description: 'Redirects to GitHub authorization page' })
  async login() {
    // passport-github2 handles the redirection to github login page
  }

  @Get('callback')
  @UseGuards(GithubAuthGuard)
  @ApiOperation({ summary: 'GitHub OAuth callback handler' })
  @ApiResponse({ status: 200, description: 'Returns JWT token and basic user details' })
  @ApiResponse({ status: 401, description: 'Authentication failed' })
  async callback(@Req() req: any, @Res() res: Response) {
    const result = await this.authService.login(req.user);
    return res.json(result);
  }
}
