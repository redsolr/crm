# Overlay System

> Settings, Pricing, and Help pages render inside the main content area as overlay views.

## How It Works

Instead of modals or full-page routes, overlay views replace the main content panels while keeping the activity bar visible. The sidebar panel hides when an overlay is open.

### Store: `useLayoutUI`

```typescript
overlayView: "settings" | "plan" | "help" | null
returnPath: string  // captured when overlay opens, used for "back" navigation

openOverlay(view)   // sets overlayView + captures current pathname as returnPath
closeOverlay()      // sets overlayView to null
```

### URL Sync: `useOverlayRouting` hook

| Overlay | URL |
|---------|-----|
| settings | `/settings` |
| plan | `/pricing` |
| help | `/contact` |

- **On mount**: if pathname matches an overlay route, opens the overlay
- **On open**: pushes the overlay URL via `router.push`
- **On close**: navigates to `returnPath` via `router.replace`

### Rendering (AppLayout)

```tsx
{overlayView && (
  <div className="overlay-page">
    <div className="overlay-back-bar">
      <button onClick={closeOverlay}>← Back</button>
    </div>
    <div className="overlay-content">
      {overlayView === "settings" && <SettingsContent />}
      {overlayView === "plan" && <PlanContent />}
      {overlayView === "help" && <HelpContent />}
    </div>
  </div>
)}
```

When overlay is open, the following are hidden:
- Sidebar panel (`!overlayView` guard)
- ResearchView, MainContentArea, right panel (`!overlayView` guards)

### Adding a New Overlay

1. Add the view type to `OverlayView` in `use-layout-ui.ts`
2. Add path mapping to `OVERLAY_PATHS` and `OVERLAY_TO_PATH`
3. Create the content component (e.g., `NewContent.tsx`)
4. Add the render case in AppLayout's overlay block
5. Create the route page under `app/(workspace)/(views)/new/page.tsx` (returns content for direct navigation)
