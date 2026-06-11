import { ApiProperty } from '@nestjs/swagger';

export class RepositoryDto {
  @ApiProperty({ description: 'Name with Owner (e.g. facebook/react)', example: 'nestjs/nest' })
  nwo: string;

  @ApiProperty({ description: 'Whether the repository is archived', example: false })
  isArchived: boolean;

  @ApiProperty({ description: 'Number of stars', example: 56200 })
  stars: number;

  @ApiProperty({ description: 'Number of forks', example: 6700 })
  forks: number;
}

export class IssuesMetricsDto {
  @ApiProperty({ description: 'Number of currently open issues', example: 45 })
  open: number;

  @ApiProperty({ description: 'Number of closed issues', example: 180 })
  closed: number;

  @ApiProperty({ description: 'Ratio of open issues to total issues', example: 0.2 })
  ratio: number;
}

export class PrsMetricsDto {
  @ApiProperty({ description: 'Number of currently open PRs', example: 8 })
  open: number;

  @ApiProperty({ description: 'Number of merged PRs', example: 95 })
  merged: number;

  @ApiProperty({ description: 'Ratio of merged PRs to total PRs', example: 0.92 })
  ratio: number;
}

export class MetricsDto {
  @ApiProperty({ description: 'Total commits in the last 30 days', example: 142 })
  totalCommits30Days: number;

  @ApiProperty({ description: 'Total unique contributors who committed in the last 30 days', example: 12 })
  totalContributors30Days: number;

  @ApiProperty({ type: IssuesMetricsDto, description: 'Summary metrics of repository issues' })
  issues: IssuesMetricsDto;

  @ApiProperty({ type: PrsMetricsDto, description: 'Summary metrics of repository pull requests' })
  prs: PrsMetricsDto;
}

export class CommitTrendDto {
  @ApiProperty({ description: 'Array of date strings (typically week starts)', example: ['2026-05-12', '2026-05-19', '2026-05-26', '2026-06-02'] })
  labels: string[];

  @ApiProperty({ description: 'Commit counts corresponding to labels', example: [35, 42, 28, 37] })
  data: number[];
}

export class ContributorActivityDto {
  @ApiProperty({ description: 'GitHub username of the contributor', example: 'octocat' })
  username: string;

  @ApiProperty({ description: 'Number of commits by this contributor', example: 54 })
  commits: number;

  @ApiProperty({ description: 'Contribution ratio of this user compared to total commits', example: 0.38 })
  ratio: number;
}

export class HeatmapElementDto {
  @ApiProperty({ description: 'Day of week (1: Sunday, 2: Monday... 7: Saturday)', example: 2 })
  day: number;

  @ApiProperty({ description: 'Week index offset (typically 1 to 8 for the last 8 weeks)', example: 3 })
  week: number;

  @ApiProperty({ description: 'Commit count for this specific day', example: 8 })
  value: number;
}

export class LanguageDto {
  @ApiProperty({ description: 'Name of the programming language', example: 'TypeScript' })
  name: string;

  @ApiProperty({ description: 'Percentage share of the language in repository', example: 75.4 })
  value: number;

  @ApiProperty({ description: 'Hex color associated with the language', example: '#3178c6' })
  color: string;
}

export class VisualizationsDto {
  @ApiProperty({ type: CommitTrendDto, description: 'Weekly commit volume trends over the last 4 weeks' })
  commitTrend: CommitTrendDto;

  @ApiProperty({ type: [ContributorActivityDto], description: 'List of top active contributors' })
  topContributors: ContributorActivityDto[];

  @ApiProperty({ type: [HeatmapElementDto], description: '8-week commit intensity heatmap data' })
  activityHeatmap: HeatmapElementDto[];

  @ApiProperty({ type: [LanguageDto], description: 'List of repository languages and their percentages' })
  languages: LanguageDto[];
}

export class RecentPrDto {
  @ApiProperty({ description: 'Pull request number', example: 102 })
  id: number;

  @ApiProperty({ description: 'Pull request title', example: 'feat: add redis caching layer to prevent rate limits' })
  title: string;

  @ApiProperty({ description: 'GitHub URL of the pull request', example: 'https://github.com/owner/repo/pull/102' })
  url: string;

  @ApiProperty({ description: 'ISO date time string of PR merge', example: '2026-06-10T14:30:00Z' })
  mergedAt: string;

  @ApiProperty({ description: 'Author username', example: 'hagangmin' })
  author: string;
}

export class RecentIssueDto {
  @ApiProperty({ description: 'Issue number', example: 105 })
  id: number;

  @ApiProperty({ description: 'Issue title', example: 'bug: memory leak in dashboard chart rendering' })
  title: string;

  @ApiProperty({ description: 'GitHub URL of the issue', example: 'https://github.com/owner/repo/issues/105' })
  url: string;

  @ApiProperty({ description: 'Current status of the issue (e.g. open, closed)', example: 'open' })
  status: string;

  @ApiProperty({ description: 'ISO date time string of last update', example: '2026-06-11T09:15:00Z' })
  updatedAt: string;
}

export class RecentActivitiesDto {
  @ApiProperty({ type: [RecentPrDto], description: 'List of five recently merged pull requests' })
  recentMergedPrs: RecentPrDto[];

  @ApiProperty({ type: [RecentIssueDto], description: 'List of five recently updated open issues' })
  recentMajorIssues: RecentIssueDto[];
}

export class DashboardResponseDto {
  @ApiProperty({ type: RepositoryDto, description: 'Repository metadata' })
  repository: RepositoryDto;

  @ApiProperty({ type: MetricsDto, description: 'Aggregated analytics metrics' })
  metrics: MetricsDto;

  @ApiProperty({ type: VisualizationsDto, description: 'Refined data suitable for chart rendering' })
  visualizations: VisualizationsDto;

  @ApiProperty({ type: RecentActivitiesDto, description: 'Recent commits/PRs and issues metadata lists' })
  recentActivities: RecentActivitiesDto;
}
