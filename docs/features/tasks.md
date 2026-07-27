# Tasks & Backlog

> Task management with backlog, board, and drag-and-drop subtask nesting.

## Overview

Tasks are the core PM unit. They belong to a project, optionally to a sprint or epic, and can have subtasks via `parentId`. Two main views: backlog (table/list) and board (kanban).

## Data Model

```typescript
interface Task {
  id: string;
  identifier: string;           // "WEB-42" (auto-generated)
  title: string;
  description: string | null;
  status: TaskStatus;            // backlog | todo | in_progress | in_review | done | cancelled
  priority: TaskPriority;        // none | low | medium | high | urgent
  position: number;              // ordering within status column
  projectId: string;
  sprintId: string | null;       // null = backlog
  epicId: string | null;
  parentId: string | null;       // subtask relationship
  assigneeId: string | null;
  dueDate: string | null;
  estimate: number | null;       // story points
}
```

## Files

### Desktop

| File | Purpose |
|------|---------|
| `components/main-window/ProjectBacklogView.tsx` | CSS Grid table with sortable rows, inline editing, status/priority dropdowns |
| `components/main-window/ProjectBoardView.tsx` | Kanban board with 3 columns (To Do, In Progress, Done) |

### Mobile

| File | Purpose |
|------|---------|
| `components/mobile/MobileBacklogScreen.tsx` | Touch-optimized list with dnd-kit drag-and-drop |
| `components/mobile/MobileSprintScreen.tsx` | Mobile sprint board |
| `components/mobile/CreateTaskSheet.tsx` | Bottom sheet for creating tasks |

### Shared

| File | Purpose |
|------|---------|
| `hooks/use-backlog-dnd.ts` | Shared drag-and-drop hook (reorder + nest) |
| `lib/task-tree.ts` | Tree helpers: `buildFlatTree`, `getDescendantIds` |
| `lib/tasksApi.ts` | API client: CRUD, move, subtasks, bulk update |
| `lib/task-constants.ts` | `PRIORITY_COLORS`, `STATUS_OPTIONS`, `PRIORITY_OPTIONS` |
| `queries/project-management/use-tasks-query.ts` | General task query hook |
| `queries/views/use-folder-views-query.ts` | `useProjectBacklogQuery`, `useProjectBoard` with optimistic reorder |

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/tasks` | POST | Create task |
| `/tasks` | GET | List tasks (filters: projectId, sprintId, backlog, parentId) |
| `/tasks/:id` | PUT | Update task (title, status, priority, position, parentId) |
| `/tasks/:id/move` | PUT | Move task (status + position) |
| `/tasks/:id` | DELETE | Delete task |
| `/tasks/:id/subtasks` | GET | Get subtasks |
| `/tasks/bulk` | PUT | Bulk update multiple tasks |

## Drag-and-Drop

See [Backlog DnD docs](./backlog-dnd.md) for full architecture.

- **Reorder**: drag between items (top/bottom 30% of row)
- **Nest as subtask**: drag to center 40% of another item
- **Local state layer**: prevents snap-back after drop
- **iOS-style animation**: `scale(1.03)` overlay, `cubic-bezier(0.25, 1, 0.5, 1)` easing
