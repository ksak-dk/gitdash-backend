import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Octokit } from '@octokit/rest';
import { RedisService } from '../cache/redis.service';
import {
  DashboardResponseDto,
  RepositoryDto,
  MetricsDto,
  VisualizationsDto,
  RecentActivitiesDto,
  LanguageDto,
  ContributorActivityDto,
  HeatmapElementDto,
  RecentPrDto,
  RecentIssueDto,
} from './dto/dashboard-response.dto';

const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  CSS: '#563d7c',
  HTML: '#e34c26',
  Python: '#3572A5',
  Java: '#b07219',
  Go: '#00ADD8',
  C: '#555555',
  'C++': '#f34b7d',
  'C#': '#178600',
  Ruby: '#701516',
  Rust: '#dea584',
  PHP: '#4F5D95',
  Shell: '#89e051',
  Vue: '#41b883',
  Svelte: '#ff3e00',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  Dart: '#00B4AB',
};

/**
 * Service facilitating integration with the GitHub API (v3 REST API).
 * Performs data caching via Redis and aggregates multiple requests in parallel (BFF).
 */
@Injectable()
export class GithubService {
  private readonly logger = new Logger(GithubService.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Instantiates or returns a configured Octokit client for calling GitHub API.
   * Defaults to server-configured token if no user-specific Personal Access Token is supplied.
   *
   * @param token - Optional user-specific Personal Access Token (PAT)
   * @returns Configured Octokit client instance
   * @private
   */
  private getOctokit(token?: string): Octokit {
    const defaultToken = this.configService.get<string>('GITHUB_TOKEN');
    return new Octokit({
      auth: token || defaultToken || undefined,
    });
  }

  /**
   * Orchestrates the aggregation of GitHub dashboard analytics and visual statistics.
   * Combines repository metadata, language profiles, commits, issues, PRs, and recent activities in parallel.
   *
   * @param owner - GitHub owner/org handle
   * @param repo - GitHub repository name
   * @param token - Optional GitHub OAuth or Personal Access Token
   * @returns Promise resolving to aggregated DashboardResponseDto structure
   * @throws HttpException if interfacing with GitHub API fails
   */
  async getDashboardData(
    owner: string,
    repo: string,
    token?: string,
  ): Promise<DashboardResponseDto> {
    const octokit = this.getOctokit(token);

    try {
      // 1. parallel fetch of cached or fresh components
      const [repoMeta, languages, commitStats, issuesPrs, recentActs] = await Promise.all([
        this.getRepoMetadata(owner, repo, octokit),
        this.getLanguages(owner, repo, octokit),
        this.getCommitAndContributorStats(owner, repo, octokit),
        this.getIssuesAndPrsCount(owner, repo, octokit),
        this.getRecentActivities(owner, repo, octokit),
      ]);

      const issuesRatio = issuesPrs.open + issuesPrs.closed > 0
        ? Number((issuesPrs.open / (issuesPrs.open + issuesPrs.closed)).toFixed(2))
        : 0;

      const prsRatio = prsRatioCalculate(issuesPrs.prOpen, issuesPrs.prMerged);

      return {
        repository: repoMeta,
        metrics: {
          totalCommits30Days: commitStats.totalCommits30Days,
          totalContributors30Days: commitStats.totalContributors30Days,
          issues: {
            open: issuesPrs.open,
            closed: issuesPrs.closed,
            ratio: issuesRatio,
          },
          prs: {
            open: issuesPrs.prOpen,
            merged: issuesPrs.prMerged,
            ratio: prsRatio,
          },
        },
        visualizations: {
          commitTrend: commitStats.commitTrend,
          topContributors: commitStats.topContributors,
          activityHeatmap: commitStats.activityHeatmap,
          languages,
        },
        recentActivities: recentActs,
      };
    } catch (err) {
      this.logger.error(`Error aggregating dashboard data for ${owner}/${repo}:`, err);
      throw new HttpException(
        err.message || 'Failed to fetch GitHub dashboard data',
        err.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Fetches basic repository metadata (stars, forks, archival status) with a 2-hour Redis cache TTL.
   *
   * @param owner - GitHub owner name
   * @param repo - GitHub repo name
   * @param octokit - Configured Octokit instance
   * @returns Promise resolving to RepositoryDto
   * @private
   */
  private async getRepoMetadata(
    owner: string,
    repo: string,
    octokit: Octokit,
  ): Promise<RepositoryDto> {
    const cacheKey = `repo:meta:${owner}:${repo}`;
    const cached = await this.redisService.get<RepositoryDto>(cacheKey);
    if (cached) return cached;

    const { data } = await octokit.repos.get({ owner, repo });
    const result: RepositoryDto = {
      nwo: data.full_name,
      isArchived: data.archived || false,
      stars: data.stargazers_count,
      forks: data.forks_count,
    };

    await this.redisService.set(cacheKey, result, 7200); // 2 hours TTL
    return result;
  }

  /**
   * Fetches the programming languages used in the repository and formats their share percentage.
   * Caches response for 2 hours in Redis.
   *
   * @param owner - GitHub owner name
   * @param repo - GitHub repo name
   * @param octokit - Configured Octokit instance
   * @returns Promise resolving to array of LanguageDto
   * @private
   */
  private async getLanguages(
    owner: string,
    repo: string,
    octokit: Octokit,
  ): Promise<LanguageDto[]> {
    const cacheKey = `repo:languages:${owner}:${repo}`;
    const cached = await this.redisService.get<LanguageDto[]>(cacheKey);
    if (cached) return cached;

    const { data } = await octokit.repos.listLanguages({ owner, repo });
    const totalBytes = Object.values(data).reduce((acc, curr) => acc + curr, 0);

    const result: LanguageDto[] = Object.entries(data).map(([name, bytes]) => {
      const value = totalBytes > 0 ? Number(((bytes / totalBytes) * 100).toFixed(1)) : 0;
      const color = LANGUAGE_COLORS[name] || '#858585';
      return { name, value, color };
    });

    await this.redisService.set(cacheKey, result, 7200); // 2 hours TTL
    return result;
  }

  /**
   * Aggregates commit activities and contributor statistics.
   * Combines last 30-day commit/contributor volumes, commit trends (last 4 weeks), heatmap (last 8 weeks),
   * and top contributors. Caches responses for 6 hours in Redis.
   *
   * @param owner - GitHub owner name
   * @param repo - GitHub repo name
   * @param octokit - Configured Octokit instance
   * @returns Promise resolving to stats bundle including commit trends, contributors, and heatmap
   * @private
   */
  private async getCommitAndContributorStats(
    owner: string,
    repo: string,
    octokit: Octokit,
  ): Promise<{
    totalCommits30Days: number;
    totalContributors30Days: number;
    commitTrend: { labels: string[]; data: number[] };
    topContributors: ContributorActivityDto[];
    activityHeatmap: HeatmapElementDto[];
  }> {
    const cacheKey = `repo:commits:${owner}:${repo}`;
    const cached = await this.redisService.get<any>(cacheKey);
    if (cached) return cached;

    try {
      const [commitActResponse, contribsResponse] = await Promise.all([
        octokit.repos.getCommitActivityStats({ owner, repo }).catch(() => null),
        octokit.repos.getContributorsStats({ owner, repo }).catch(() => null),
      ]);

      let totalCommits30Days = 0;
      let totalContributors30Days = 0;
      const commitTrend = { labels: [] as string[], data: [] as number[] };
      let topContributors: ContributorActivityDto[] = [];
      let activityHeatmap: HeatmapElementDto[] = [];

      // 1. Process commit activity stats
      if (commitActResponse && Array.isArray(commitActResponse.data)) {
        const stats = commitActResponse.data;
        // Last 4 weeks
        const recent4Weeks = stats.slice(-4);
        totalCommits30Days = recent4Weeks.reduce((sum, w) => sum + (w.total || 0), 0);

        recent4Weeks.forEach((week) => {
          const dateStr = new Date(week.week * 1000).toISOString().split('T')[0];
          commitTrend.labels.push(dateStr);
          commitTrend.data.push(week.total || 0);
        });

        // Heatmap: last 8 weeks
        const recent8Weeks = stats.slice(-8);
        recent8Weeks.forEach((week, weekIdx) => {
          if (week.days && Array.isArray(week.days)) {
            week.days.forEach((value, dayIdx) => {
              activityHeatmap.push({
                day: dayIdx + 1, // 1: Sunday, 2: Monday...
                week: weekIdx + 1,
                value: value,
              });
            });
          }
        });
      } else {
        // Fallback commit trend & heatmap if github statistics endpoint is cold
        commitTrend.labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
        commitTrend.data = [0, 0, 0, 0];
      }

      // 2. Process contributor stats
      if (contribsResponse && Array.isArray(contribsResponse.data)) {
        const stats = contribsResponse.data;
        const totalCommits = stats.reduce((sum, c) => sum + (c.total || 0), 0);

        topContributors = stats
          .map((c) => {
            const username = c.author?.login || 'unknown';
            const commits = c.total || 0;
            const ratio = totalCommits > 0 ? Number((commits / totalCommits).toFixed(3)) : 0;
            return { username, commits, ratio };
          })
          .sort((a, b) => b.commits - a.commits)
          .slice(0, 5);

        // Active contributors in the last 4 weeks
        totalContributors30Days = stats.filter((c) => {
          if (!c.weeks) return false;
          const last4Weeks = c.weeks.slice(-4);
          return last4Weeks.some((w) => w.c && w.c > 0);
        }).length;
      }

      const result = {
        totalCommits30Days,
        totalContributors30Days,
        commitTrend,
        topContributors,
        activityHeatmap,
      };

      await this.redisService.set(cacheKey, result, 21600); // 6 hours TTL
      return result;
    } catch (err) {
      this.logger.error(`Error calculating commit stats for ${owner}/${repo}:`, err);
      // Fail-safe default return
      return {
        totalCommits30Days: 0,
        totalContributors30Days: 0,
        commitTrend: { labels: [], data: [] },
        topContributors: [],
        activityHeatmap: [],
      };
    }
  }

  /**
   * Retrieves issues and pull requests counts (both open and closed).
   * Utilizes GitHub search queries to obtain aggregated numbers quickly. Caches response for 10 minutes.
   *
   * @param owner - GitHub owner name
   * @param repo - GitHub repo name
   * @param octokit - Configured Octokit instance
   * @returns Promise resolving to issue and PR open/closed totals
   * @private
   */
  private async getIssuesAndPrsCount(
    owner: string,
    repo: string,
    octokit: Octokit,
  ): Promise<{
    open: number;
    closed: number;
    prOpen: number;
    prMerged: number;
  }> {
    const cacheKey = `repo:counts:${owner}:${repo}`;
    const cached = await this.redisService.get<any>(cacheKey);
    if (cached) return cached;

    // Use search API which is cached to guarantee clean results
    const [openIssuesRes, closedIssuesRes, openPrsRes, mergedPrsRes] = await Promise.all([
      octokit.search.issuesAndPullRequests({
        q: `repo:${owner}/${repo} is:issue is:open`,
        per_page: 1,
      }).catch(() => ({ data: { total_count: 0 } })),
      octokit.search.issuesAndPullRequests({
        q: `repo:${owner}/${repo} is:issue is:closed`,
        per_page: 1,
      }).catch(() => ({ data: { total_count: 0 } })),
      octokit.search.issuesAndPullRequests({
        q: `repo:${owner}/${repo} is:pr is:open`,
        per_page: 1,
      }).catch(() => ({ data: { total_count: 0 } })),
      octokit.search.issuesAndPullRequests({
        q: `repo:${owner}/${repo} is:pr is:merged`,
        per_page: 1,
      }).catch(() => ({ data: { total_count: 0 } })),
    ]);

    const result = {
      open: openIssuesRes.data.total_count,
      closed: closedIssuesRes.data.total_count,
      prOpen: openPrsRes.data.total_count,
      prMerged: mergedPrsRes.data.total_count,
    };

    await this.redisService.set(cacheKey, result, 600); // 10 minutes TTL
    return result;
  }

  /**
   * Retrieves the latest 5 merged pull requests and 5 recently updated issues.
   * Caches results for 10 minutes in Redis.
   *
   * @param owner - GitHub owner name
   * @param repo - GitHub repo name
   * @param octokit - Configured Octokit instance
   * @returns Promise resolving to RecentActivitiesDto
   * @private
   */
  private async getRecentActivities(
    owner: string,
    repo: string,
    octokit: Octokit,
  ): Promise<RecentActivitiesDto> {
    const cacheKey = `repo:recent:${owner}:${repo}`;
    const cached = await this.redisService.get<RecentActivitiesDto>(cacheKey);
    if (cached) return cached;

    const [pullsResponse, issuesResponse] = await Promise.all([
      octokit.pulls.list({
        owner,
        repo,
        state: 'closed',
        sort: 'updated',
        direction: 'desc',
        per_page: 20,
      }).catch(() => ({ data: [] })),
      octokit.issues.listForRepo({
        owner,
        repo,
        state: 'open',
        sort: 'updated',
        direction: 'desc',
        per_page: 20,
      }).catch(() => ({ data: [] })),
    ]);

    const recentMergedPrs: RecentPrDto[] = pullsResponse.data
      .filter((pr: any) => pr.merged_at !== null)
      .slice(0, 5)
      .map((pr: any) => ({
        id: pr.number,
        title: pr.title,
        url: pr.html_url,
        mergedAt: pr.merged_at,
        author: pr.user?.login || 'unknown',
      }));

    const recentMajorIssues: RecentIssueDto[] = issuesResponse.data
      .filter((issue: any) => !issue.pull_request)
      .slice(0, 5)
      .map((issue: any) => ({
        id: issue.number,
        title: issue.title,
        url: issue.html_url,
        status: issue.state,
        updatedAt: issue.updated_at,
      }));

    const result: RecentActivitiesDto = {
      recentMergedPrs,
      recentMajorIssues,
    };

    await this.redisService.set(cacheKey, result, 600); // 10 minutes TTL
    return result;
  }
}

/**
 * Helper utility calculating ratio of merged pull requests over total pull requests.
 *
 * @param open - Number of open pull requests
 * @param merged - Number of merged pull requests
 * @returns PR merge ratio as decimal (e.g. 0.92)
 */
function prsRatioCalculate(open: number, merged: number): number {
  return open + merged > 0 ? Number((merged / (open + merged)).toFixed(2)) : 0;
}
