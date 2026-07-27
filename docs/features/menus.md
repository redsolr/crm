# Account & User Menus

> Shared menu system for the activity bar account button and sidebar user card.

## Architecture

Both menus render the same items via a shared `MenuItems` component. Each menu provides its own positioning shell.

### Files

| File | Purpose |
|------|---------|
| `components/layout/MenuItems.tsx` | Shared menu content: email, Settings, Help, Plans, Logout |
| `components/layout/AccountMenu.tsx` | Activity bar dropdown (right of bar, bottom-aligned) |
| `components/UserCardDropdown.tsx` | Sidebar user card dropdown (above card) |
| `components/layout/menu-primitives.tsx` | `MenuItem`, `MenuSeparator`, menu icons |

### Menu Items (shared)

| Item | Action |
|------|--------|
| Settings | `openOverlay("settings")` |
| Get help | `openOverlay("help")` |
| View all plans | `openOverlay("plan")` |
| Log out | `logout()` from auth store |

### AccountMenu Positioning

```
Activity bar bottom → relative container
  AccountMenu → absolute bottom-0 left-[calc(100%+1px)]
    → rounded-r-lg (no left border radius, touches bar edge)
    → border-l-0 (no left border, flush with activity bar)
```

### Adding a Menu Item

1. Add the icon to `menu-primitives.tsx`
2. Add the handler and `<MenuItem>` in `MenuItems.tsx`
3. Both menus update automatically
