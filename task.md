# Task: Set Up Proper Frontend E2E Testing

## Context

Next.js 15 frontend (React 19, TypeScript, Zustand, TanStack Query) needs production-grade E2E testing. Playwright and Jest are already installed but existing E2E tests are brittle — hardcoded credentials, raw selectors, no API mocking, no auth bypass for testing.

**Backend:** NestJS platform at `D:\Jurisimus\platform` with Docker Compose (PostgreSQL + Redis). Backend has `MockLLMProvider` enabled via `LLM_MOCK_ENABLED=true`. Auth is WorkOS AuthKit.

## Current State

### Already installed
- `@playwright/test: ^1.55.0`
- `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`
- `jest: ^30.0.5`, `jest-environment-jsdom`
- `playwright.config.ts` at `http://localhost:3000`

### Existing E2E tests (`e2e/`)
- `auth.spec.ts` — uses hardcoded `test@example.com`, can't pass WorkOS OAuth
- `chat.spec.ts` — chat interface, model selector
- `account.spec.ts` — account page, profile
- `folders.spec.ts` — folder management
- `simple.spec.ts` — placeholder

### Problems
- **No auth bypass** — can't pass WorkOS OAuth in tests
- **No API mocking** — no MSW, uses manual `route.fulfill()` (brittle)
- **Hardcoded selectors** — fragile, coupled to CSS
- **No `data-testid`** — missing on interactive elements

## What to Do

### 1. Install MSW
```bash
npm install msw --save-dev
```

### 2. Create MSW Handlers
```
src/mocks/
├── handlers/
│   ├── auth.ts          — POST /auth/login, GET /auth/me
│   ├── organizations.ts — GET /organizations
│   ├── projects.ts      — GET /projects, CRUD
│   ├── chat.ts          — POST /chat, POST /chat/completion, POST /chat/stream (SSE)
│   ├── usage.ts         — GET /usage/limits/check, GET /usage/summary
│   ├── subscriptions.ts — GET /subscriptions, plan data
│   ├── workspaces.ts    — GET /workspaces
│   └── folders.ts       — GET /folders, CRUD
├── handlers.ts          — Aggregates all handlers
├── browser.ts           — MSW browser setup (for dev/component tests)
└── server.ts            — MSW server setup (for Playwright/Node tests)
```

Handlers return **realistic data** matching real API response shapes.

### 3. Set Up Auth Bypass for E2E
**a) Playwright `storageState`** — inject test JWT into localStorage via `e2e/fixtures/auth.setup.ts`

**b) MSW auth handler** — mock `GET /auth/me` → test user, mock `POST /auth/login` → test JWT. Tests don't need the real backend.

### 4. Create Playwright Fixtures & Helpers
```
e2e/
├── fixtures/
│   ├── auth.setup.ts      — Global auth setup (generates storageState)
│   └── test-fixtures.ts   — Custom fixtures (authenticated page, API mocks)
├── helpers/
│   └── msw-playwright.ts  — MSW integration for Playwright
├── auth.spec.ts           — Rewrite with proper mocking
├── chat.spec.ts           — Send message → see response → check usage
├── account.spec.ts        — View profile, usage stats, plan info
├── folders.spec.ts        — Create, rename, delete folders
├── navigation.spec.ts     — NEW: sidebar tabs, workspace switching
└── usage-limits.spec.ts   — NEW: usage meter updates, plan upgrade CTA
```

### 5. Add `data-testid` Attributes
Key interactive elements:
- Sidebar: `sidebar`, `nav-research`, `nav-explorer`
- Chat: `chat-input`, `chat-send`, `chat-message-list`
- Account: `usage-meter`, `plan-badge`, `logout-btn`
- Auth: `login-form`, `email-input`

### 6. Update Playwright Config
- `globalSetup` for auth token generation
- `storageState` for authenticated tests
- Projects: `authenticated` (most tests) and `unauthenticated` (auth flow tests)
- `baseURL` from env var

### 7. npm Scripts (already exist, may need updates)
```json
"test:e2e": "playwright test",
"test:e2e:ui": "playwright test --ui",
"test:e2e:debug": "playwright test --debug"
```

## E2E Test Scenarios

### Auth Flow
- [ ] Unauthenticated user → redirected to /login
- [ ] Login → token stored → redirected to home
- [ ] Token persists across page reload
- [ ] Logout → token cleared → redirected to /login
- [ ] Expired token → redirected to /login

### Chat (Core Flow)
- [ ] Send message → see user message in chat
- [ ] Receive AI response (mocked SSE stream)
- [ ] Chat history loads on revisit
- [ ] Model selector changes provider
- [ ] New chat creates fresh conversation

### Navigation & Layout
- [ ] Sidebar tabs navigate correctly (research, explorer, personal)
- [ ] Folder list renders from API data
- [ ] Create folder → appears in list
- [ ] Breadcrumb navigation works
- [ ] Responsive: sidebar collapses on mobile

### Account & Usage
- [ ] Account page shows profile info
- [ ] Usage meter shows token consumption
- [ ] Subscription plan displayed
- [ ] Upgrade button navigates to /plan

### Workspace
- [ ] Organization list loads
- [ ] Switching organization updates context
- [ ] Projects load for selected organization

## Architecture Notes

- **Backend API:** `http://localhost:8080` (Docker Compose)
- **Frontend dev:** `http://localhost:3000`
- **Auth:** WorkOS AuthKit, token in localStorage key `friendly_fortnight_token`
- **State:** Zustand (auth, workspace) + TanStack Query (orgs, projects, account)
- **Backend docs:** `D:\Jurisimus\platform\CONTEXT.md`

## Key Reference Files
- `playwright.config.ts` — Playwright config
- `src/stores/auth.store.ts` — Auth state
- `src/lib/authTokenManager.ts` — Token storage
- `src/middleware.ts` — WorkOS auth middleware
- `src/queries/` — TanStack Query hooks
- `e2e/` — Existing tests (to be rewritten)
