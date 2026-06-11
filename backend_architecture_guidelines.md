# Gitdash: GitHub Screen Optimization Backend Architecture Guidelines
**Author:** Principal System Architect  
**Version:** 1.0  
**Target Stack:** NestJS, PostgreSQL, Redis, Docker, GitHub API v3/v4  

---

## 1. 아키텍처 개요 (Architecture Overview)

본 시스템은 Chrome Extension(프론트엔드)의 부하를 줄이고, GitHub API의 엄격한 Rate Limit을 우회하며, 사용자 설정을 안정적으로 관리하기 위해 **BFF (Backend For Frontend)** 패턴을 채택합니다.

```mermaid
graph TD
    Client[Chrome Extension] <-->|REST API| BFF[NestJS BFF Server]
    BFF <-->|Cache / Rate Limit Guard| Redis[(Redis Cache)]
    BFF <-->|User Profile & Settings| DB[(PostgreSQL)]
    BFF <-->|Proxy & Aggregation| GitHubAPI[GitHub REST/GraphQL API]
```

### 핵심 설계 원칙
1. **API Aggregation (BFF)**: 프론트엔드가 대시보드를 그리기 위해 여러 번 GitHub API를 직접 호출하는 대신, BFF가 백그라운드에서 병렬(Parallel)로 수집 및 가공하여 **단일 진입점 API(Single Entry Point)**로 결합 및 반환합니다.
2. **Rate Limit Defense**: Redis 캐시 레이어를 도입하여 동일 리포지토리에 대한 중복 조회를 차단하고 GitHub API 할당량(Rate Limit)을 방어합니다.
3. **Decoupling**: 프론트엔드는 데이터의 원천(GitHub API 또는 DB)을 알 필요가 없으며, 백엔드가 제공하는 정제된 DTO(Data Transfer Object)만 소비하여 렌더링(Chart.js)에 집중합니다.

---

## 2. 백엔드 API 명세 (BFF API Specification)

### 2.1 리포지토리 대시보드 통합 데이터 조회
*   **Method / Path**: `GET /api/v1/repos/:owner/:repo/dashboard`
*   **Headers**: 
    *   `Authorization: Bearer <JWT_TOKEN>` (선택 사항: 사용자 맞춤형 API 요청 시 필요)
    *   `X-GitHub-Token: <USER_PAT>` (선택 사항: Private Repository 접근 시 사용자의 Personal Access Token 전달)
*   **Description**: R2.1~R4.2에 기재된 대시보드 오버레이용 모든 시각화 데이터를 한 번에 정제하여 반환합니다.

#### Response Body (JSON)
```json
{
  "repository": {
    "nwo": "owner/repo",
    "isArchived": false,
    "stars": 12500,
    "forks": 3400
  },
  "metrics": {
    "totalCommits30Days": 142,
    "totalContributors30Days": 12,
    "issues": {
      "open": 45,
      "closed": 180,
      "ratio": 0.2
    },
    "prs": {
      "open": 8,
      "merged": 95,
      "ratio": 0.92
    }
  },
  "visualizations": {
    "commitTrend": {
      "labels": ["2026-05-12", "2026-05-19", "2026-05-26", "2026-06-02"],
      "data": [35, 42, 28, 37]
    },
    "topContributors": [
      { "username": "dev-a", "commits": 54, "ratio": 0.38 },
      { "username": "dev-b", "commits": 32, "ratio": 0.225 },
      { "username": "dev-c", "commits": 15, "ratio": 0.105 }
    ],
    "activityHeatmap": [
      { "day": 1, "week": 20, "value": 4 },
      { "day": 2, "week": 20, "value": 8 }
    ],
    "languages": [
      { "name": "TypeScript", "value": 75.4, "color": "#3178c6" },
      { "name": "JavaScript", "value": 20.1, "color": "#f1e05a" },
      { "name": "CSS", "value": 4.5, "color": "#563d7c" }
    ]
  },
  "recentActivities": {
    "recentMergedPrs": [
      {
        "id": 102,
        "title": "feat: add redis caching layer to prevent rate limits",
        "url": "https://github.com/owner/repo/pull/102",
        "mergedAt": "2026-06-10T14:30:00Z",
        "author": "hagangmin"
      }
    ],
    "recentMajorIssues": [
      {
        "id": 105,
        "title": "bug: memory leak in dashboard chart rendering",
        "url": "https://github.com/owner/repo/issues/105",
        "status": "open",
        "updatedAt": "2026-06-11T09:15:00Z"
      }
    ]
  }
}
```

### 2.2 사용자 설정 관리 API
*   **Description**: PostgreSQL 데이터베이스에 저장될 크롬 익스텐션 설정(활성화 여부, 표시 언어 등)을 동기화합니다.
*   **Endpoint**:
    *   `GET /api/v1/users/settings` : 현재 로그인된 사용자의 설정을 조회합니다.
    *   `PATCH /api/v1/users/settings` : 설정을 수정 및 영속화합니다.

#### Request/Response Body (JSON)
```json
{
  "enabled": true,
  "lang": "ko",
  "theme": "dark",
  "dashboardLayout": {
    "showHeatmap": true,
    "showPrList": true
  }
}
```

---

## 3. 데이터베이스 및 캐싱 설계 (DB & Caching Strategy)

### 3.1 PostgreSQL 데이터베이스 모델 (DDL 방침)
사용자별 커스텀 설정 및 인증 토큰 정보를 관리하기 위한 기본 릴레이션 스키마입니다.

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    github_id VARCHAR(100) UNIQUE NOT NULL,
    username VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_settings (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    enabled BOOLEAN DEFAULT TRUE,
    lang VARCHAR(5) DEFAULT 'ko',
    theme VARCHAR(10) DEFAULT 'system',
    layout_config JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### 3.2 Redis 캐싱 전략 및 Cache-Aside 패턴
GitHub API의 호출 제한 정책(Rate Limit)을 준수하고 응답 속도를 개선하기 위해 다중 TTL(Time-To-Live) 방침을 적용합니다.

```mermaid
sequenceDiagram
    participant Client as Chrome Extension
    participant BFF as NestJS (BFF)
    participant Redis as Redis Cache
    participant GH as GitHub API
    
    Client->>BFF: GET /repos/owner/repo/dashboard
    BFF->>Redis: Get Cache (key: repo:dashboard:owner:repo)
    alt Cache Hit (데이터 존재)
        Redis-->>BFF: Return Cached Data
        BFF-->>Client: 200 OK (Fast Response)
    else Cache Miss (데이터 없음)
        Redis-->>BFF: null
        BFF->>GH: Call GitHub REST/GraphQL APIs (Parallel)
        GH-->>BFF: Return Raw Data
        BFF->>BFF: Refine and Aggregate DTO
        BFF->>Redis: Set Cache (TTL based on Data Type)
        BFF-->>Client: 200 OK
    end
```

#### 데이터 종류별 TTL 가이드라인
*   **정적 데이터 (Metadata, Languages)**:
    *   *설명*: 리포지토리 언어 비중, 스타/포크 수 등은 비교적 변동성이 낮습니다.
    *   *추천 TTL*: **2시간 ~ 6시간**
*   **주기적 변동 데이터 (Commit Activity, Contributor Info)**:
    *   *설명*: 주간 커밋 통계 및 전체 기여자 정보는 일 단위로 누적되므로 실시간 갱신 필요성이 낮습니다.
    *   *추천 TTL*: **6시간 ~ 12시간**
*   **실시간성 데이터 (Recent Issues, PRs, Heatmap)**:
    *   *설명*: 최근 머지된 PR 및 수정된 이슈 목록은 사용자가 즉시 반영 여부를 알고 싶어하는 중요 피드백 정보입니다.
    *   *추천 TTL*: **5분 ~ 15분**

---

## 4. 백엔드 NestJS 모듈 구조 방침 (NestJS Implementation Pattern)

백엔드는 기능별 결합도를 낮추고 유지보수성을 극대화하기 위해 다음과 같이 계층형 아키텍처(Layered Architecture) 구조로 모듈을 설계합니다.

```
src/
├── app.module.ts
├── common/
│   ├── filters/           # Global Exception Filters
│   ├── interceptors/      # Cache & Logging Interceptors
│   └── guards/            # Auth Guard
├── modules/
│   ├── auth/              # GitHub OAuth & JWT 발급
│   ├── users/             # 사용자 설정 및 DB 연동
│   └── github/            # 외부 API 연동 및 데이터 가공 (BFF 핵심)
│       ├── github.module.ts
│       ├── github.controller.ts
│       ├── github.service.ts
│       └── dto/
```

### GitHub API 연동부 병렬 처리 (Parallelization) 예시
단일 스레드 비동기 루프의 이점을 극대화하기 위해, 여러 개의 GitHub API 호출을 `Promise.all`로 병렬 처리하여 API 지연(Latency)을 단축합니다.

```typescript
// github.service.ts
import { Injectable, HttpService } from '@nestjs/common';

@Injectable()
export class GithubService {
  constructor(private readonly httpService: HttpService) {}

  async getDashboardData(owner: string, repo: string): Promise<DashboardDto> {
    const nwo = `${owner}/${repo}`;
    
    // 1. 병렬 API 호출 실행
    const [repoMeta, commitActivity, issuesOpen, prsMerged, languages] = await Promise.all([
      this.fetchRepoMetadata(owner, repo),
      this.fetchCommitActivity(owner, repo),
      this.fetchIssues(owner, repo, 'open'),
      this.fetchPRs(owner, repo, 'merged'),
      this.fetchLanguages(owner, repo),
    ]);

    // 2. Front-end 친화적인 DTO 구조로 포맷팅 및 가공
    return this.aggregateToDto({
      repoMeta,
      commitActivity,
      issuesOpen,
      prsMerged,
      languages
    });
  }
}
```

---

## 5. 인프라 및 컨테이너화 가이드라인 (DevOps & Deployment)

### 5.1 Docker Compose를 통한 로컬 개발 환경 통일 (`docker-compose.yml`)
개발 및 프로덕션 환경의 일관성을 위해 다중 컨테이너 환경을 정의합니다.

```yaml
version: '3.8'

services:
  gitdash-backend:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:password@postgres-db:5432/gitdash
      - REDIS_URL=redis://redis-cache:6379
      - GITHUB_APP_CLIENT_ID=${GITHUB_APP_CLIENT_ID}
      - GITHUB_APP_CLIENT_SECRET=${GITHUB_APP_CLIENT_SECRET}
    depends_on:
      - postgres-db
      - redis-cache
    networks:
      - gitdash-network

  postgres-db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=gitdash
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    networks:
      - gitdash-network

  redis-cache:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redisdata:/data
    networks:
      - gitdash-network

networks:
  gitdash-network:
    driver: bridge

volumes:
  pgdata:
  redisdata:
```

### 5.2 GitHub Actions CI/CD 구축 지침
백엔드의 빌드, 테스트, 배포 파이프라인 자동화 지침입니다.
1. **Lint & Test**: 코드 Push 또는 PR 생성 시 Jest 단위 테스트 및 ESLint 무결성 검증을 필수로 수행합니다.
2. **Docker Build**: 성공적으로 검증된 코드는 Docker 이미지로 빌드되어 Registry(예: Docker Hub 또는 AWS ECR)에 푸시됩니다.
3. **Continuous Deployment**: 배포 서버(예: AWS ECS 또는 자체 VPS)에 Webhook 신호를 보내 컨테이너를 무중단(Blue-Green 또는 Rolling Update) 배포합니다.
