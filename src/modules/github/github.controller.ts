import { Controller, Get, Param, Headers, Req, UseGuards } from '@nestjs/common';
import { GithubService } from './github.service';
import { DashboardResponseDto } from './dto/dashboard-response.dto';
import { ApiTags, ApiOperation, ApiParam, ApiHeader, ApiResponse } from '@nestjs/swagger';

// OptionalAuthGuard will be implemented in Phase 4.
// For now, we allow the endpoint to be accessed openly, supporting X-GitHub-Token header.
@ApiTags('GitHub BFF')
@Controller('api/v1/repos')
export class GithubController {
  constructor(private readonly githubService: GithubService) {}

  @Get(':owner/:repo/dashboard')
  @ApiOperation({ summary: 'Retrieve aggregated dashboard metrics and visuals for a given GitHub repository' })
  @ApiParam({ name: 'owner', description: 'GitHub username or organization name', example: 'nestjs' })
  @ApiParam({ name: 'repo', description: 'GitHub repository name', example: 'nest' })
  @ApiHeader({
    name: 'x-github-token',
    description: 'Personal Access Token (PAT) for accessing private repositories',
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Aggregated repository dashboard payload successfully retrieved',
    type: DashboardResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Repository not found or access denied' })
  @ApiResponse({ status: 500, description: 'Internal server error while interfacing with GitHub API' })
  async getDashboard(
    @Param('owner') owner: string,
    @Param('repo') repo: string,
    @Headers('x-github-token') userPat?: string,
    @Req() req?: any,
  ): Promise<DashboardResponseDto> {
    let token = userPat;

    // If JWT user exists (when auth guard is activated later), fallback to user's accessToken
    if (!token && req?.user?.githubAccessToken) {
      token = req.user.githubAccessToken;
    }

    return this.githubService.getDashboardData(owner, repo, token);
  }
}
