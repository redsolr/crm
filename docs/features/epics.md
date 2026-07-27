# Epics

> High-level grouping of related tasks across sprints.

## Overview

Epics are large bodies of work that span multiple sprints. Tasks link to epics via `task.epicId`. Epics have their own status and can be used to track progress across many tasks.

## Files

| File | Purpose |
|------|---------|
| `queries/project-management/use-epics-query.ts` | Epic CRUD hooks |
| `lib/tasksApi.ts` | `epicId` field on Task, epic-related operations |

## Data Model

```typescript
interface Epic {
  id: string;
  title: string;
  description: string | null;
  status: "open" | "in_progress" | "done";
  projectId: string;
  color: string;
  startDate: string | null;
  targetDate: string | null;
  createdAt: string;
  updatedAt: string;
}
```

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/projects/:id/epics` | GET | List epics for a project |
| `/projects/:id/epics` | POST | Create epic |
| `/epics/:id` | PUT | Update epic |
| `/epics/:id` | DELETE | Delete epic |

## Task ↔ Epic Relationship

- `task.epicId = null` → task is unlinked
- `task.epicId = epicId` → task belongs to epic
- Multiple tasks across different sprints can share the same epic
- Epic progress = percentage of linked tasks in "done" status
