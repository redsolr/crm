# Mobile Screens

> Touch-optimized screens for all major features.

## Architecture

Mobile uses completely separate screen components (not responsive wrappers). The `MobileContentArea` component routes between screens based on the active view.

### Layout

```
┌──────────────────────────┐
│     MobileTabHeader      │  ← hamburger + title + actions
├──────────────────────────┤
│                          │
│     Screen Content       │  ← full-screen content
│                          │
├──────────────────────────┤
│     Bottom Tab Bar       │  ← 6 tabs (chat, notes, tasks, backlog, settings, profile)
└──────────────────────────┘
```

## Screens

| Screen | File | Purpose |
|--------|------|---------|
| Chat | `MobileChatScreen.tsx` | AI chat with pill-style input bar |
| Notes | `MobileNotesScreen.tsx` | Note browser with search + compose |
| Sprint | `MobileSprintScreen.tsx` | Sprint board |
| Backlog | `MobileBacklogScreen.tsx` | Backlog with dnd-kit drag-and-drop |
| Done | `MobileDoneScreen.tsx` | Completed items |

## Shared Mobile Components

| Component | File | Purpose |
|-----------|------|---------|
| `MobileTabHeader` | `MobileTabHeader.tsx` | Top bar with hamburger, title, trailing actions |
| `MobileEmptyState` | `MobileEmptyState.tsx` | Empty state placeholder (icon + title + subtitle) |
| `AccentFab` | `AccentFab.tsx` | Floating action button (yellow accent) |
| `CreateTaskSheet` | `CreateTaskSheet.tsx` | Bottom sheet for creating tasks |
| `PickerSheet` | `PickerSheet.tsx` | Bottom sheet for option selection |

## Mobile Chat Input

The chat input matches iOS messaging apps:
```
[ + btn ]  [  text pill (flex-1)  ]  [ mic/send btn ]
```
- Plus button and mic/send button sit outside the pill
- Same padding/spacing as the notes search bar
- Textarea auto-grows up to 100px

## Mobile Backlog DnD

Uses the same `useBacklogDnd` hook as desktop with mobile-specific sensors:
- `TouchSensor` with 200ms delay (long press to drag, allows normal scrolling)
- `PointerSensor` with 8px distance constraint
