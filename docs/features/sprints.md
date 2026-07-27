# Sprints

> Sprint management for organizing tasks into time-boxed iterations.

## Overview

Sprints group tasks into time-boxed iterations. Tasks move between backlog and sprints. Each sprint has a status (planned, active, completed), date range, and goal.

## Files

| File | Purpose |
|------|---------|
| `components/main-window/SprintView.tsx` | Desktop sprint view with task lists per status |
| `components/mobile/MobileSprintScreen.tsx` | Mobile sprint board |
| `queries/project-management/use-sprints-query.ts` | Sprint CRUD hooks |
| `lib/tasksApi.ts` | `AssignTaskToSprintRequest`, sprint-related task operations |

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/projects/:id/sprints` | GET | List sprints for a project |
| `/projects/:id/sprints` | POST | Create sprint |
| `/sprints/:id` | PUT | Update sprint (name, dates, status, goal) |
| `/sprints/:id` | DELETE | Delete sprint |
| `/sprints/:id/complete` | POST | Complete sprint (move unfinished tasks) |

## Sprint Lifecycle

```
Planned → Active → Completed
              ↓
        On complete: choose where unfinished tasks go
        - Next sprint
        - Back to backlog
```

## Task ↔ Sprint Relationship

- `task.sprintId = null` → task is in backlog
- `task.sprintId = sprintId` → task is in sprint
- Moving between sprint and backlog: update `sprintId`
