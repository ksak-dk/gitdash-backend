# GitDash API Specification

This document details the REST API endpoints provided by the **GitDash Backend BFF**. All endpoints follow the `/api/v1` namespace (except for the root health check).

---

## 1. Overview & Authentication

- **Base URL**: `http://localhost:3000`
- **Response Format**: `application/json`
- **Authentication**: JWT-based Bearer Token authentication is applied to settings endpoints.
  - Header: `Authorization: Bearer <JWT_TOKEN>`

---

## 2. API Endpoints Map

| Module | Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Health** | `GET` | `/` | None | Service entry point / health check |
| **Auth** | `GET` | `/api/v1/auth/login` | None | Initiates GitHub OAuth authentication flow |
| | `GET` | `/api/v1/auth/callback` | None | Handles GitHub callback and signs JWT token |
| **Users** | `GET` | `/api/v1/users/settings` | Bearer JWT | Retrieves settings & layout configuration |
| | `PATCH` | `/api/v1/users/settings` | Bearer JWT | Partially updates settings & layout configuration |
| **GitHub BFF** | `GET` | `/api/v1/repos/:owner/:repo/dashboard` | Optional | Gathers and aggregates analytical dashboard data |

---

## 3. Endpoints Detail

### 3.1 Health Check

#### `GET /`
- **Description**: Verifies that the NestJS server is online.
- **Headers**: None
- **Response** (`200 OK`):
  ```json
  "Hello World!"
  ```

---

### 3.2 Auth Module

#### `GET /api/v1/auth/login`
- **Description**: Triggers redirect to GitHub OAuth authorize page.
- **Response** (`302 Found`): Redirects browser to `https://github.com/login/oauth/authorize`.

#### `GET /api/v1/auth/callback`
- **Description**: Target callback endpoint handling query code validation with GitHub.
- **Query Parameters**:
  - `code` (string, required): Authorization code returned from GitHub.
- **Response** (`200 OK`):
  ```json
  {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEs...",
    "user": {
      "id": 1,
      "username": "octocat"
    }
  }
  ```
- **Error Responses**:
  - `401 Unauthorized`: Authentication failed with passport-github.

---

### 3.3 Users Module

#### `GET /api/v1/users/settings`
- **Description**: Fetches the authenticated user settings and dashboard layout preferences.
- **Headers**:
  - `Authorization: Bearer <JWT_TOKEN>` (required)
- **Response** (`200 OK`):
  ```json
  {
    "id": 1,
    "githubId": "583231",
    "username": "octocat",
    "settings": {
      "id": 1,
      "theme": "dark",
      "layoutConfig": {
        "showHeatmap": true,
        "showPrList": true
      }
    }
  }
  ```

#### `PATCH /api/v1/users/settings`
- **Description**: Updates user theme or layout parameters. Supports partial updates.
- **Headers**:
  - `Authorization: Bearer <JWT_TOKEN>` (required)
- **Request Body** (`UpdateSettingsDto`):
  ```json
  {
    "theme": "light",
    "layoutConfig": {
      "showHeatmap": false
    }
  }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "id": 1,
    "theme": "light",
    "layoutConfig": {
      "showHeatmap": false,
      "showPrList": true
    }
  }
  ```

---

### 3.4 GitHub BFF Module

#### `GET /api/v1/repos/:owner/:repo/dashboard`
- **Description**: Aggregates metadata, languages, metrics, visualizations, and activities in parallel.
- **Path Parameters**:
  - `owner` (string, required): GitHub username/org (e.g. `nestjs`).
  - `repo` (string, required): GitHub repository name (e.g. `nest`).
- **Headers**:
  - `x-github-token` (string, optional): Client-side Personal Access Token for private repositories.
- **Response** (`200 OK`):
  ```json
  {
    "repository": {
      "nwo": "nestjs/nest",
      "isArchived": false,
      "stars": 56200,
      "forks": 6700
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
        {
          "username": "octocat",
          "commits": 54,
          "ratio": 0.38
        }
      ],
      "activityHeatmap": [
        {
          "day": 2,
          "week": 3,
          "value": 8
        }
      ],
      "languages": [
        {
          "name": "TypeScript",
          "value": 75.4,
          "color": "#3178c6"
        }
      ]
    },
    "recentActivities": {
      "recentMergedPrs": [
        {
          "id": 102,
          "title": "feat: add redis caching layer to prevent rate limits",
          "url": "https://github.com/nestjs/nest/pull/102",
          "mergedAt": "2026-06-10T14:30:00Z",
          "author": "hagangmin"
        }
      ],
      "recentMajorIssues": [
        {
          "id": 105,
          "title": "bug: memory leak in dashboard chart rendering",
          "url": "https://github.com/nestjs/nest/issues/105",
          "status": "open",
          "updatedAt": "2026-06-11T09:15:00Z"
        }
      ]
    }
  }
  ```
- **Error Responses**:
  - `404 Not Found`: Repository not found or access denied.
  - `500 Internal Server Error`: External GitHub API call failed.
