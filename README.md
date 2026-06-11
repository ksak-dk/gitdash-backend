# GitDash - Backend BFF (Backend For Frontend)

<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

A robust and optimized backend server for **GitDash (GitHub Repository Analytics Dashboard)** Chrome browser extension. Built using NestJS, this backend implements the **BFF (Backend For Frontend) pattern** to consolidate multiple external GitHub REST API requests into a single, high-performance endpoint while shielding the system from API Rate Limit caps using Redis cache layers.

---

## 1. Introduction

### Purpose
Assessing a repository's health, contributor dynamics, and active ticket status natively on GitHub requires clicking through several fragmented tabs (Insights, Commits, Pull Requests, Issues). **GitDash** solves this by injecting an elegant dashboard overlay directly into the native GitHub interface. 

The backend BFF aggregates repository metadata, commit volumes, contributor statistics, and recent activities in parallel, delivering parsed and formatted payloads to the extension client.

### Core Architecture Features
- **BFF Pattern**: Reduces frontend computational load and eliminates browser-side API orchestration.
- **Rate Limit Defense**: Caches heavy GitHub API data on Redis with custom TTL strategies.
- **User Settings Sync**: Stores personalized extension layout preferences in PostgreSQL.
- **Dockerized Environment**: Ships database, cache, and app services in isolated Docker containers.

---

## 2. Technology Stack

- **Framework**: [NestJS](https://nestjs.com/) (Node.js framework using TypeScript)
- **Database**: PostgreSQL (User & Settings store)
- **Caching Layer**: Redis (In-memory token/API response store)
- **HTTP Client**: Octokit REST API wrapper
- **DevOps**: Docker, docker-compose, GitHub Actions

---

## 3. System Architecture

```mermaid
graph TD
    Client[Chrome Extension Client] -->|HTTP Requests| BFF[NestJS BFF Backend]
    BFF -->|Read/Write Layout| DB[(PostgreSQL Database)]
    BFF -->|Query Cache| Cache[(Redis Cache)]
    BFF -->|External API Calls| GitHubAPI[GitHub REST API v3]
```

### Redis Caching TTL Strategies
To prevent hitting GitHub API rate limits (typically 5,000 requests/hour for authenticated users), we categorize caching TTL policies as follows:
- **Static / Infrequent Data** (Repo metadata, language distribution): **2 Hours** (`7200s`)
- **Periodically Updated Data** (Weekly commit trends, top contributors, 8-week heatmap): **6 Hours** (`21600s`)
- **Real-time / Volatile Data** (Issue status, PR counts, recent merged PRs/major issues): **10 Minutes** (`600s`)

---

## 4. API Specification & Endpoints

Complete interactive documentation is exposed via Swagger UI at `http://localhost:3000/api-docs`.

### Auth Module (`/api/v1/auth`)
- **`GET /login`**: Redirects to GitHub OAuth gateway.
- **`GET /callback`**: Handles OAuth callback, saves user profile, and issues JWT token containing client authorization payloads.

### Users Module (`/api/v1/users`)
- **`GET /settings`** *(JWT Guarded)*: Retrieves custom layout configuration for the active user.
- **`PATCH /settings`** *(JWT Guarded)*: Updates user layout configs (e.g. enabling/disabling widgets).

### GitHub BFF Module (`/api/v1/repos`)
- **`GET /:owner/:repo/dashboard`**: Returns a comprehensive unified payload of metrics, visual chart data (trends, doughnut shares, heatmaps), and lists of recent activities.
  - Supports `x-github-token` in request headers for accessing private repositories.

---

## 5. Local Setup & Running Instructions

### Prerequisites
- **Node.js** (v18 or higher recommended)
- **Docker** and **docker-compose**

### 1. Environment Variables Configuration
Copy the `.env.example` file to `.env` and configure your keys:
```bash
PORT=3000
NODE_ENV=development

# Database Connection (PostgreSQL)
DATABASE_URL=postgresql://postgres:password@localhost:5432/gitdash

# Cache Connection (Redis)
REDIS_URL=redis://localhost:6379

# JWT Configuration
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRATION_TIME=7d

# GitHub OAuth credentials
GITHUB_CLIENT_ID=your_github_client_id_here
GITHUB_CLIENT_SECRET=your_github_client_secret_here
GITHUB_REDIRECT_URI=http://localhost:3000/api/v1/auth/callback
```

### 2. Infrastructure Setup (Docker Compose)
Start the PostgreSQL and Redis containers in detached mode:
```bash
$ docker-compose up -d
```

### 3. Install Dependencies
```bash
$ npm install
```

### 4. Running the Application
```bash
# development mode
$ npm run start

# watch mode (development)
$ npm run start:dev

# production build & run
$ npm run build
$ npm run start:prod
```

### 5. Access Swagger UI API Docs
Navigate to:
[http://localhost:3000/api-docs](http://localhost:3000/api-docs)

---

## 6. Project Plan & Team

### Project Timeline (OSP_Team_3)
- **Week 1**: Requirements gathering, Docker setup, Manifest configuration, CI/CD pipeline linkage.
- **Week 2**: Backend API structure design, DB schema, Frontend DOM analyzer research.
- **Week 3**: API integration, Inject scripts, Chart.js mapping.
- **Week 4**: Redis caching execution, layout configs, theme adjustments, integrated QA.
- **Week 5**: Refactoring, optimization, final testing and deployment preparation.

### Role Assignments
- **PM: 김민규** - Project overview, GitHub Projects Kanban management, scheduling, peer review coordination, and presentation compilation.
- **Backend Developer: 하강민** - NestJS BFF API architecture design, PostgreSQL/Redis connections, Dockerization, and CI/CD pipelines.
- **Frontend Developer: 장팅웨이** - Chrome Extension script development, DOM manipulation & overlay UI, and Chart.js visualization.

---

## License

This project is [MIT licensed](LICENSE).
