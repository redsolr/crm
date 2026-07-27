# Component Reference

> **For LLMs**: Read this before creating new UI. If something here solves your need, use it — don't build a new one.
> Page-level components (views, screens) are not documented here — they're self-explanatory from the code. This focuses on **reusable building blocks**.
>
> **Utilities available project-wide:**
> - `clsx` — className composition (installed, use instead of template literal concatenation)
> - `formatDate` from `@/lib/date-constants` — formats date strings to "Apr 5, 2026". Handles null/undefined. **Use this instead of writing your own date formatter.**
> - `getInitials` / `stringToHue` from `@/components/team/member-utils` — avatar initials + deterministic color from string

---

## Hooks — Reusable Logic

### `useResizePanel` — Draggable panel resize

Handles mouse-drag resizing with min/max constraints, responsive mobile fallback, and cursor management. Used by Sidebar, ChatSidebar, KeyFindingsPanel, MemberDetailPanel.

```ts
import { useResizePanel, PANEL_SIZES } from "@/hooks/use-resize-panel";
import { ResizeGrip } from "@/components/Sidebar"; // decorative 6-dot grip SVG

// Always use a preset — don't hardcode sizes:
PANEL_SIZES.sidebar       // { defaultWidth: 280, minWidth: 180, maxWidthRatio: 0.35, maxWidthPx: 480 }
PANEL_SIZES.chatPanel     // { defaultWidth: 380, minWidth: 300, maxWidthRatio: 0.4,  maxWidthPx: 600 }
PANEL_SIZES.findingsPanel // { defaultWidth: 320, minWidth: 260, maxWidthRatio: 0.35, maxWidthPx: 500 }
PANEL_SIZES.memberDetail  // { defaultWidth: 340, minWidth: 280, maxWidthRatio: 0.4,  maxWidthPx: 520 }

const { width, maxWidth, minWidth, isDesktop, handleMouseDown, isDragging } =
  useResizePanel({ ...PANEL_SIZES.chatPanel, side: "right" });
// side: "left" → drag handle on right edge (sidebar), "right" → drag handle on left edge (panels)

// Apply to container:
<div style={{ width, minWidth, maxWidth, userSelect: isDragging ? "none" : undefined }}>
  {isDesktop && (
    <div onMouseDown={handleMouseDown} className="resize-sash left-0" role="separator">
      <ResizeGrip />
    </div>
  )}
  {children}
</div>
```

To add a new resizable panel: add a preset to `PANEL_SIZES`, use the hook, add `resize-sash` div. CSS is in `styles/workspace.css`.

---

### `useClickOutside` — Close on outside click / Escape

```ts
import { useClickOutside } from "@/hooks/use-click-outside";

const ref = useRef<HTMLDivElement>(null);
useClickOutside(ref, () => setOpen(false), isOpen); // 3rd arg: enabled (skip when already closed)
```

---

### `useContextMenu` — Right-click menu positioning

```ts
import { useContextMenu } from "@/hooks/use-context-menu";

const { state, show, hide } = useContextMenu();
// state: { visible: boolean, position: { x: number, y: number } }

<div onContextMenu={show}>
  {state.visible && <Menu style={{ left: state.position.x, top: state.position.y }} />}
</div>
```

---

### `useMenuNavigation` — Arrow key navigation for menus

```ts
import { useMenuNavigation } from "@/hooks/use-menu-navigation";

const { selectedIndex, setSelectedIndex } = useMenuNavigation({
  items,                    // T[] — the list of items
  onSelect: (item) => {},   // called on Enter
  onClose: () => {},        // called on Escape
  orientation: "vertical",  // "horizontal" | "vertical" | "both"
  autoSelectFirstItem: true,
  query: searchText,        // resets selection on change
  containerRef,             // optional — scopes keyboard events
  editor,                   // optional — TipTap editor instance
});
```

---

### `useScrollToBottom` — Auto-scroll message lists

```ts
import { useScrollToBottom } from "@/hooks/use-scroll-to-bottom";

const lastMsgRef = useRef<HTMLDivElement>(null);
const { scrollContainerRef } = useScrollToBottom({
  userMessageCount: messages.length,
  lastMsgRef,
  scrollContainerRef,  // optional — provide your own or let hook create one
});
```

---

### `useThrottledCallback` — Throttled function with cleanup

```ts
import { useThrottledCallback } from "@/hooks/use-throttled-callback";

const throttledSave = useThrottledCallback(
  (content: string) => save(content),
  300,           // wait ms
  [save],        // dependencies
  { leading: true, trailing: true }
);
// Returns function with .cancel() and .flush() methods. Auto-cancels on unmount.
```

---

### `useOverlayRouting` — URL ↔ overlay state sync

Settings, Pricing, Help render as overlays over main content. This hook syncs the URL with overlay state.

```ts
const { overlayView, openOverlay, closeOverlay, returnPath } = useOverlayRouting();
// overlayView: current overlay or null
// openOverlay("settings") → navigates to /settings, shows overlay
// closeOverlay() → navigates back to returnPath
```

---

### `useHealthStatus` — Backend health monitoring

```ts
const { overall, label, color, services, message } = useHealthStatus();
// overall: "operational" | "degraded" | "outage"
// services: { database: { status }, redis: { status }, ai: { status } }
// status per service: "operational" | "degraded" | "down" | "not_configured"
```

---

### `useCollaboration` — Real-time collaborative editing

Connects to Hocuspocus server for Yjs-based collaboration on a page.

```ts
const { ydoc, provider, isSynced, isConnected, currentUser, connectedUsers, collaborators } =
  useCollaboration({ pageId: "abc-123", enabled: true });
// currentUser: { name, color }
// collaborators: CollaborationUser[] — other connected users
```

---

### `useBacklogDnd` / `useBoardDnd` — Drag-and-drop

Both use `@dnd-kit`. Backlog supports reorder + nest subtasks. Board supports cross-column moves.

```ts
// Backlog
const { activeId, flatItems, sortableIds, sensors, handleDragStart, handleDragOver, handleDragEnd, handleDragCancel } =
  useBacklogDnd({ tasks, updateTask, reorderTask, mode: "desktop" });

// Board
const { localColumns, activeTask, sensors, handleDragStart, handleDragOver, handleDragEnd, handleDragCancel } =
  useBoardDnd({ serverColumns, columnDefs, mapStatus, moveTask, updateTask, searchQuery, filterFn });
```

---

### `useWindowSize` / `useContainerWidth` / `useElementRect` — Size tracking

```ts
const { width, height, offsetTop, offsetLeft, scale } = useWindowSize();  // window dimensions
const { ref, width } = useContainerWidth();  // attach ref to element, get its width
```

---

### Other hooks (simple, read source if needed)

| Hook | What it does |
|------|-------------|
| `useNotifications` | Returns `{ notifications, dismiss }` from notification API |
| `useComposedRef` | Combines multiple refs into one |
| `useUnmount` | Runs cleanup callback on unmount with stable ref |
| `useSidebar` | Sidebar open/close state |
| `useScrolling` | Tracks scroll events |
| `useCarouselHeight` | Auto-height for carousel containers |
| `useCursorVisibility` | Tracks cursor in TipTap editor |
| `useOnboarding` | Onboarding flow state machine |
| `usePushNotifications` | Push notification registration |
| `useWorkflowStatuses` | Board column/status configuration |
| `useDocumentTools` | Document manipulation utilities |
| `useTiptapEditor` | TipTap editor setup with extensions |

---

## Reusable UI Components

### Layout Primitives (`components/layout/`)

#### `CreateModal` — Generic creation modal with dynamic fields

```tsx
<CreateModal
  isOpen={true}
  onClose={() => {}}
  title="Create Project"
  fields={[
    { key: "name", label: "Name", placeholder: "My project", required: true },
    { key: "key", label: "Key", placeholder: "PRJ", uppercase: true, maxLength: 5 },
  ]}
  onSubmit={async (values) => { /* values: { name: "...", key: "..." } */ }}
  isSubmitting={false}
/>
```

#### `Dropdown` — Generic select dropdown with custom rendering

```tsx
<Dropdown<Project>
  items={projects}
  selectedItem={current}
  onSelect={(p) => select(p)}
  renderItem={(p) => <span>{p.name}</span>}
  renderSelectedItem={(p) => <span>{p?.name ?? "Select..."}</span>}
  icon={<ProjectIcon />}
  placeholder="Select project"
  getItemId={(p) => p.id}
  addLabel="New Project"      // optional "+" button at bottom
  onAdd={() => openCreate()}  // optional
/>
```

#### `menu-primitives` — Menu building blocks

```tsx
import { MenuItem, MenuSeparator, MenuIconSettings, MenuIconHelp, MenuIconPlans, MenuIconLogout } from "@/components/layout/menu-primitives";

<MenuItem icon={<MenuIconSettings />} label="Settings" onClick={() => {}} />
<MenuSeparator />
<MenuItem icon={<MenuIconLogout />} label="Logout" onClick={logout} />
```

#### `MobileOverlay` — Animated backdrop for mobile menus

```tsx
<MobileOverlay isVisible={menuOpen} onClose={() => setMenuOpen(false)} />
// Renders a dark animated overlay that covers the screen behind a mobile menu/sheet.
```

---

### Settings Primitives (`components/settings/primitives.tsx`)

Reuse these in any settings/form UI:

```tsx
import { SectionTitle, SectionDivider, FieldLabel, Toggle, OutlineButton, SettingRow, INPUT_CLASS } from "@/components/settings/primitives";

<SectionTitle>Account</SectionTitle>

<SettingRow label="Email notifications" description="Get notified about updates">
  <Toggle checked={on} onChange={setOn} />
</SettingRow>

<input className={INPUT_CLASS} />  // pre-styled text input

<OutlineButton onClick={save}>Save</OutlineButton>
<OutlineButton danger onClick={del}>Delete Account</OutlineButton>
<SectionDivider />
```

Also exports: `UsageMeter` (label + subtitle + percent bar), `ThemeCard` (dark/light/system selector), `CopyIcon`, `formatCurrency(cents)`, `formatDate`.

---

### Auth Components (`components/auth/`)

For login/signup/onboarding pages:

```tsx
// OAuth button — renders Google/Apple icon + text
<SocialButton href="/auth/google" provider="google" action="Sign in" />

// Password with show/hide toggle and optional strength meter
<PasswordInput name="password" label="Password" showStrength error="Too short" />

// Submit button with loading spinner
<SubmitButton isPending={loading} label="Sign In" pendingLabel="Signing in..." />

// Validation error below a field
<FieldError message="Email is required" />

// Toggle for checkboxes
<ToggleSwitch name="terms" label="I agree to the Terms" />
```

---

### Team Components (`components/team/`)

#### `RoleSelector` — Role dropdown + `RoleBadge`

```tsx
import { RoleSelector, RoleBadge } from "@/components/team/RoleSelector";
// MemberRole = "owner" | "admin" | "member" | "billing" | "readonly"

<RoleSelector currentRole="member" onChange={(r) => {}} disabled={false} />
<RoleBadge role="admin" />  // inline colored badge
```

#### `MemberRow` — Member list item with avatar, role, actions

```tsx
<MemberRow
  name="John Doe"
  email="john@example.com"
  role="admin"
  isCurrentUser={false}
  isSelected={true}          // highlight state
  onClick={() => select()}   // makes row clickable with cursor: pointer
  onRoleChange={(r) => {}}   // role dropdown
  onRemove={() => {}}        // delete button (hidden for current user, appears on hover)
/>
// Avatar: colored circle with initials, hue derived from email hash
```

#### `MemberDetailPanel` — Full member detail sidebar

```tsx
<MemberDetailPanel
  member={accountMember}       // AccountMember object with userId, role, isActive, joinedAt, etc.
  isCurrentUser={false}
  onClose={() => {}}
  onRoleChange={(r) => {}}
  onRemove={() => {}}
/>
// Shows: large avatar, name, email, role selector, active/inactive status, joined date, added date, user ID, remove button
```

#### `ResizableMemberDetail` — MemberDetailPanel wrapped with resize

Mounts `useResizePanel` + `MemberDetailPanel` together. Use this instead of `MemberDetailPanel` directly when you want the panel to be resizable. Only mounts when rendered — resize listeners are inactive when panel is closed.

```tsx
<ResizableMemberDetail
  member={accountMember}
  isCurrentUser={false}
  onClose={() => {}}
  onRoleChange={(r) => {}}
  onRemove={() => {}}
/>
// Same props as MemberDetailPanel. Adds drag handle + resize-sash automatically.
```

#### `InviteMemberModal` — Invite by email or link

```tsx
<InviteMemberModal
  isOpen={true}
  onClose={() => {}}
  onInvite={async (userId, role) => {}}
  title="Invite Account Member"
  availableRoles={["admin", "member"]}  // optional — defaults to all roles
/>
```

---

### Sharing Components (`components/sharing/`)

#### `MemberSearch` — Search users to share with

```tsx
<MemberSearch
  searchQuery={query}
  onSearchQueryChange={setQuery}
  showDropdown={open}
  onShowDropdownChange={setOpen}
  searchResults={results}    // MemberSearchResult[] — { userId, userFullName?, userEmail? }
  onAddPerson={(userId) => {}}
  isLoading={false}
/>
```

#### `GrantsList` — List of people with access

```tsx
<GrantsList
  grants={grants}            // GrantDisplay[] — { shareId, principalType, principalId, role, name, email?, avatarUrl? }
  isLoading={false}
  sharesLoading={false}
  onRoleChange={(grant, newRole) => {}}
  onRemoveGrant={(grant) => {}}
/>
```

---

### Chat Components (`components/chat/`)

#### `MarkdownRenderer` — Render markdown with syntax highlighting

```tsx
<MarkdownRenderer content="**Hello** world\n```js\nconsole.log('hi')\n```" />
// Optional: highlights={[{ start, end, color }]}, messageIndex for keying
```

#### `TextSelectionMenu` — Floating menu on text select

```tsx
<TextSelectionMenu
  containerRef={chatRef}
  onAskAI={(text) => {}}
  onAddToFindings={(ctx) => {}}   // ctx: SelectionContext { text, messageRole, timestamp, ... }
  onAddToPaper={(ctx) => {}}
  addToPaperTarget={pageId}       // null hides "add to paper" option
  chatTitle="My Chat"
  model="gpt-5"
/>
```

#### `ModelSelector` — LLM model picker

```tsx
<ModelSelector disabled={isStreaming} />
// Reads/writes to models.store. Shows color-coded provider badges.
```

#### `LoadingIndicator` — Animated 4-dot loader

```tsx
<LoadingIndicator />  // no props, renders animated dots
```

---

### Other Root Components

#### `ProtectedRoute` — Auth + permission guard

```tsx
<ProtectedRoute requiredPermissions={["tasks:write"]} requiredRoles={["admin", "owner"]}>
  <AdminPanel />
</ProtectedRoute>
// Redirects to login if unauthenticated. Shows nothing if unauthorized.
```

#### `UsageMeter` — Token usage bar (self-contained)

```tsx
<UsageMeter />
// No props — fetches usage data internally via useUsageDisplayQuery.
// Shows monthly token usage as a progress bar with percentage.
```

#### `Modal` — Design system for dialogs (`components/ui/modal.tsx`)

Compound component for all modal dialogs. Use this instead of rolling your own backdrop/card.

```tsx
import { Modal } from "@/components/ui/modal";

// Simple confirmation
<Modal onClose={close}>
  <Modal.Title>Delete project?</Modal.Title>
  <Modal.Description>This action cannot be undone.</Modal.Description>
  <Modal.Actions>
    <Modal.Button onClick={confirm}>Delete</Modal.Button>
    <Modal.ButtonMuted onClick={close}>Cancel</Modal.ButtonMuted>
  </Modal.Actions>
</Modal>

// With order details (plan change, purchases)
<Modal onClose={close}>
  <Modal.Title>Change to Pro plan</Modal.Title>
  <Modal.OrderDetails
    from={{ label: "Current cycle", name: "Starter", price: "$7.99" }}
    to={{ label: "Effective now", name: "Pro", price: "$24.99" }}
  />
  <Modal.Notice>Your plan will be upgraded immediately.</Modal.Notice>
  <Modal.Agreement checked={agreed} onCheckedChange={setAgreed}>
    You agree to be charged <strong>$17.00</strong> now...
  </Modal.Agreement>
  <Modal.Actions>
    <Modal.Button onClick={confirm} disabled={!agreed}>Confirm</Modal.Button>
    <Modal.ButtonMuted onClick={close}>Cancel</Modal.ButtonMuted>
  </Modal.Actions>
</Modal>

// Two-column layout (wide modal)
<Modal wide onClose={close}>
  <Modal.Title>Cancel plan</Modal.Title>
  <Modal.Description>Cancel to stop recurring billing.</Modal.Description>
  <Modal.Columns>
    <Modal.Column>
      <Modal.RadioSelect value={reason} onValueChange={setReason} options={reasons} />
      <Modal.Textarea value={feedback} onChange={setFeedback} placeholder="Tell us more..." />
    </Modal.Column>
    <Modal.Column divider>
      <Modal.OrderDetails from={...} to={...} />
      <Modal.Notice>Your subscription remains active until...</Modal.Notice>
      <Modal.Actions>
        <Modal.Button onClick={confirm}>Confirm</Modal.Button>
        <Modal.ButtonMuted onClick={close}>Go back</Modal.ButtonMuted>
      </Modal.Actions>
    </Modal.Column>
  </Modal.Columns>
</Modal>

// Success screen (post-action confirmation)
<Modal.Success
  title="Your plan has been canceled"
  description={<>You'll have access until <strong>May 8, 2026</strong>.</>}
  detail="Thank you for your feedback."
  onClose={close}
/>
```

**Sub-components:**

| Component | Purpose |
|-----------|---------|
| `Modal` | Root — backdrop + card. `wide` prop for two-column layout |
| `Modal.Title` | `h2` heading |
| `Modal.Description` | Subtitle text below title |
| `Modal.Body` | Generic content wrapper with bottom margin |
| `Modal.Columns` | Flex container for two-column layout |
| `Modal.Column` | Column wrapper. `divider` prop adds left border |
| `Modal.OrderDetails` | Plan comparison card (from → to with prices) |
| `Modal.Notice` | Calendar icon + info text block |
| `Modal.Actions` | Button container |
| `Modal.Button` | Primary action button. `disabled`, `loading` props |
| `Modal.ButtonMuted` | Secondary/cancel text button |
| `Modal.Agreement` | Radix checkbox + label text |
| `Modal.RadioSelect` | Radix radio group with options list |
| `Modal.Textarea` | Textarea with character counter |
| `Modal.Success` | Full success screen with checkmark, title, description |

**Design tokens** (defined in modal.tsx, shared across all modals):
- Button style: `rounded-full`, theme border, hover state
- Spacing: `mb-8` between sections
- Card: `rounded-2xl`, theme border, `p-8`
- Accent color: `--ctx-accent-primary` (red theme) for checkbox/radio

---

#### `SelectionButton` (`components/ui/`)

```tsx
<SelectionButton selected={isActive} onClick={toggle} variant="accent" showCheck>
  Option A
</SelectionButton>
// variant: "accent" (colored) | "light" (subtle). showCheck adds checkmark when selected.
```

---

## Zustand Stores

| Store | Import | Key state & actions |
|-------|--------|-------------------|
| **Auth** | `stores/auth.store` | `user`, `backendToken`, `loading`, `needsOnboarding`, `setUser()`, `clearAuth()` |
| **UI** | `stores/ui.store` | `isChatSidebarOpen`, `isKeyFindingsOpen`, `toggleChatSidebar()`, `toggleKeyFindings()`, add-to-paper state |
| **Workspace Editor** | `stores/workspace-editor.store` | `tabs[]`, `activeTabId`, `activeContent`, `openTab()`, `closeTab()`, `contextItems`, `addToContext()` |
| **Layout UI** | `stores/use-layout-ui` | `isAccountMenuOpen`, `overlayView`, `returnPath` |
| **Workspace** | `stores/workspace.store` | Active organization/project context |
| **Theme** | `stores/use-theme` | `mode`: `"dark"` / `"light"` / `"system"`, `setMode()` |
| **Activity Bar** | `stores/activity-bar.store` | Active sidebar view tab |
| **Chat Nav** | `stores/chat-navigation.store` | Current chat ID and navigation state |
| **Models** | `stores/models.store` | Available LLM models, selected model |
| **Team UI** | `stores/team-ui.store` | `activeSection`, `selectedMemberId`, `selectedOrgId`, `selectedTeamId` |
| **Share Dialog** | `stores/share-dialog.store` | Share dialog open/close + target resource |
| **Editor** | `stores/editor.store` | Active document metadata (legacy) |
| **Viewport** | `stores/viewport.store` | Scroll position state |

**Pattern**: All stores use Zustand `create()`. Components read directly — no prop drilling. Server state lives in TanStack Query, stores hold client-only UI state.

---

## Page-Level Components (not documented in detail)

These are full views tied to routes. Read the source directly when working on them:

- **`layout/`**: `AppLayout`, `ActivityBar`, `TopBar`, `ChatSidebar`, `ViewWithChat`
- **`chat/`**: `ChatWindow`, `ChatWindowContainer`, `ChatContentView`, `ChatBox`, `ChatHistoryPanel`
- **`document-editor/`**: `DocumentEditor`, `Toolbar`, `SlashCommandMenu`, `DragHandle`
- **`explorers/`**: `BaseExplorer`, `FileExplorer`, `PersonalExplorer`, `ContextBuilderExplorer`
- **`main-window/`**: `ProjectBacklogView`, `ProjectBoardView`, `SprintView`, `CalendarView`, `TimelineView`, `TaskDetailPanel`
- **`research/`**: `ResearchView`, `AllChatsView`
- **`team/`**: `TeamPageContent`, `AccountMembersPanel`, `OrganizationsPanel`, `TeamsPanel`, `GroupsPanel`
- **`settings/`**: `GeneralSection`, `CustomizationSection`, `AccountSection`, `BillingSection`, `UsageSection`
- **`mobile/`**: `MobileContentArea`, `MobileChatScreen`, `MobileBacklogScreen`, and other `Mobile*Screen` views
- **`onboarding/`**: `WelcomeStep`, `StepDots`, `LabeledInput`, `SelectionGroup`
- **`sync/`**: `ChatNavigationSync`, `ViewportSync`
- **Root**: `Sidebar`, `SplashScreen`, `ThemeInit`, `TrackingProvider`
