# Backlog Drag-and-Drop

> Reorder tasks and nest subtasks via drag-and-drop using @dnd-kit.

## Architecture

Both desktop (`ProjectBacklogView`) and mobile (`MobileBacklogScreen`) use a shared `useBacklogDnd` hook that handles all drag logic.

### Files

| File | Purpose |
|------|---------|
| `hooks/use-backlog-dnd.ts` | Shared hook: sensors, handlers, local state, nest detection |
| `lib/task-tree.ts` | Tree helpers: `buildFlatTree`, `getDescendantIds`, `FlatItem` type |
| `components/main-window/ProjectBacklogView.tsx` | Desktop: CSS Grid table with sortable rows |
| `components/mobile/MobileBacklogScreen.tsx` | Mobile: touch-optimized list with sortable items |

### Drag Behaviors

**Reorder**: Drag an item between other items (top/bottom 30% of row). Uses `SortableContext` with `verticalListSortingStrategy` for smooth animations.

**Nest as subtask**: Drag an item to the center 40% of another item. Target shows a blue ring highlight. On drop, updates `parentId` via `updateTask`. Prevents circular nesting (can't nest into own descendants).

### Local State Layer

The hook maintains a `localTasks` state that prevents snap-back after drop:
- `isDraggingRef` gates server→local sync during active drag
- On drop: local state updates immediately via `arrayMove`
- After 300ms delay: allows server data to sync back

### Nest Zone Detection

Tracks pointer position via `pointermove`/`touchmove` listeners during drag. In `onDragOver`, compares pointer Y with the drop target's bounding rect:
- Top 30%: reorder (insert before)
- Center 40%: nest as subtask
- Bottom 30%: reorder (insert after)

### Sensors

| Platform | Sensors |
|----------|---------|
| Desktop | `PointerSensor` (5px distance) + `KeyboardSensor` |
| Mobile | `PointerSensor` (8px distance) + `TouchSensor` (200ms delay) |

### Drop Animation

iOS-style: dragged item fully hidden (`opacity: 0`), `DragOverlay` shows a lifted copy with `scale(1.03)` + `box-shadow`. Drop uses `cubic-bezier(0.25, 1, 0.5, 1)` easing at 200ms.
