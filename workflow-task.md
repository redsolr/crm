# Key Findings & Workspace Feature - Implementation Task

## Overview

Implementation of the "Chat → Key Findings → Workspace → Synthesis" UX flow as specified by the Head of Engineering. This transforms Jurisimus from a chat-focused app into a knowledge management platform.

---

## Feature Summary

| Feature | Description | Priority |
|---------|-------------|----------|
| Save as Key Finding | One-tap save from chat messages | P0 |
| Key Findings Panel | Persistent navbar item + drawer | P0 |
| Workspace Mode | Document editor with findings integration | P0 |
| Document Save | Save as memo/analysis/draft/template | P1 |
| Synthesis | Add to Knowledge Library (Company/Personal) | P2 |

---

## Phase 1: Core Flow (MVP)

### 1.1 Key Findings State Management

**New File:** `src/hooks/use-key-findings.ts`

```typescript
interface KeyFinding {
  id: string;
  content: string;
  title: string;           // Auto-generated from first sentence
  source: {
    type: 'chat-message' | 'text-selection';
    messageId?: string;
    conversationId?: string;
    timestamp: Date;
  };
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

interface UseKeyFindingsReturn {
  findings: KeyFinding[];
  addFinding: (content: string, source: FindingSource) => void;
  removeFinding: (id: string) => void;
  updateFinding: (id: string, updates: Partial<KeyFinding>) => void;
  renameFinding: (id: string, newTitle: string) => void;
  findingsCount: number;
  findingsByConversation: Record<string, KeyFinding[]>;
  findingsByDate: Record<string, KeyFinding[]>;
  clearFindings: () => void;
}
```

**Tasks:**
- [x] Create `use-key-findings.ts` hook with state management
- [x] Implement auto-title generation (first sentence extraction)
- [x] Add localStorage persistence for session findings
- [x] Group findings by conversation and date
- [ ] Export hook from `src/hooks/index.ts`

---

### 1.2 Save as Key Finding Button (Chat Integration)

**Modify:** `src/components/chat/LLMBubble.tsx`

**Tasks:**
- [x] Add "Save as Key Finding" button (⭐ icon) to LLM message actions
- [x] Button appears on hover (desktop) / always visible (mobile)
- [x] One-tap action - no modal required
- [x] Connect to `useKeyFindings().addFinding()`
- [x] Show visual feedback on save (brief highlight/animation)

**New File:** `src/components/chat/SaveFindingButton.tsx`

```typescript
interface SaveFindingButtonProps {
  messageContent: string;
  messageId: string;
  conversationId?: string;
  onSaved?: () => void;
}
```

**Tasks:**
- [ ] Create reusable SaveFindingButton component
- [ ] Handle already-saved state (show "Saved" instead of "Save")
- [ ] Prevent duplicate saves of same content

---

### 1.3 Toast Notification System

**New File:** `src/components/ui/Toast.tsx`

**Tasks:**
- [ ] Create lightweight toast component
- [ ] Position: bottom-center or bottom-right
- [ ] Auto-dismiss after 2-3 seconds
- [ ] Message: "Saved to Key Findings"
- [ ] Optional: "Undo" action on toast

**New File:** `src/contexts/ToastContext.tsx`

**Tasks:**
- [ ] Create toast context provider
- [ ] Expose `showToast(message, options)` function
- [ ] Support queue of multiple toasts
- [ ] Add to app layout providers

---

### 1.4 Key Findings Navbar Item

**Modify:** `src/components/Navbar.tsx` or `src/components/NavbarWrapper.tsx`

**Tasks:**
- [ ] Add persistent "Key Findings" item with bookmark icon (🔖)
- [ ] Show badge with findings count
- [ ] Badge updates in real-time when findings added
- [ ] Click/tap opens Key Findings drawer
- [ ] Style: subtle, doesn't dominate navbar

---

### 1.5 Key Findings Drawer Panel

**New File:** `src/components/key-findings/KeyFindingsDrawer.tsx`

**Layout:**
```
┌─────────────────────────────┐
│ 🔖 Key Findings (12)    ✕  │
├─────────────────────────────┤
│ ▼ Today                     │
│   ├─ Finding title 1        │
│   │   "Preview text..."     │
│   │   [Insert] [Copy] [⋮]   │
│   └─ Finding title 2        │
│                             │
│ ▼ Yesterday                 │
│   └─ Finding title 3        │
│                             │
│ ▼ From: Research Session    │
│   └─ Finding title 4        │
└─────────────────────────────┘
```

**Tasks:**
- [ ] Create KeyFindingsDrawer component
- [ ] Right-side sliding panel (like ChatSidebar pattern)
- [ ] Does NOT navigate away from current page
- [ ] Group findings by date and/or conversation
- [ ] Each finding shows:
  - [ ] Title (editable on click)
  - [ ] Preview text (truncated)
  - [ ] Origin label ("Saved from Chat")
  - [ ] Optional tags
- [ ] Quick actions per finding:
  - [ ] Insert into document (if Workspace open)
  - [ ] Copy to clipboard
  - [ ] Open source (scroll to original message)
  - [ ] Delete
- [ ] Mobile: render as bottom sheet instead of side drawer

**New File:** `src/components/key-findings/KeyFindingItem.tsx`

**Tasks:**
- [ ] Create individual finding item component
- [ ] Hover state with action buttons
- [ ] Inline title editing
- [ ] Drag handle for reordering (optional)

**New File:** `src/components/key-findings/index.ts`

**Tasks:**
- [ ] Barrel export for key-findings components

---

### 1.6 Drawer State Management

**Modify:** `src/components/layout/AppLayout.tsx`

**Tasks:**
- [ ] Add `isKeyFindingsOpen` state
- [ ] Add `toggleKeyFindings()` function
- [ ] Pass to Navbar and render KeyFindingsDrawer conditionally
- [ ] Handle overlay/backdrop on mobile

---

## Phase 2: Workspace Mode

### 2.1 Workspace Route/View

**New File:** `src/app/(routes)/workspace/page.tsx`

**Tasks:**
- [ ] Create workspace route
- [ ] Protected route (requires auth)
- [ ] Initialize with empty document or selected findings

**Alternative:** Add as ContentType in MainContentArea

**Tasks:**
- [ ] Add `"workspace"` to ContentType union
- [ ] Add Workspace tab support
- [ ] Render WorkspaceView component

---

### 2.2 Navbar Mode Toggle

**Modify:** `src/components/Navbar.tsx`

**Tasks:**
- [ ] Add mode toggle: `[ Chat ] [ Workspace ]`
- [ ] Visual indicator for active mode
- [ ] Smooth transition between modes
- [ ] Preserve state when switching

---

### 2.3 Workspace Layout

**New File:** `src/components/workspace/WorkspaceView.tsx`

**Layout:**
```
┌──────────────┬────────────────────────┬──────────────┐
│ Key Findings │   Markdown Editor      │ LLM Assistant│
│ from session │   (live preview)       │    Panel     │
│              │                        │              │
│ [Finding 1]  │   # Document Title     │ "Rewrite     │
│ [Finding 2]  │                        │  this as..." │
│ [Finding 3]  │   Content here...      │              │
│              │                        │ [Send]       │
│   ⟵ drag     │                        │              │
└──────────────┴────────────────────────┴──────────────┘
```

**Tasks:**
- [ ] Create three-panel layout component
- [ ] Left panel: session findings (draggable)
- [ ] Center panel: markdown editor with live preview toggle
- [ ] Right panel: LLM assistant (scoped to document + findings)
- [ ] Resizable panel dividers
- [ ] Responsive: stack on mobile

---

### 2.4 Workspace Findings Panel (Left)

**New File:** `src/components/workspace/WorkspaceFindingsPanel.tsx`

**Tasks:**
- [ ] Display findings from current session only
- [ ] Drag-and-drop to insert into document
- [ ] Visual feedback during drag
- [ ] "Used" indicator for findings already in document
- [ ] Filter/search findings

---

### 2.5 Workspace Editor (Center)

**Reuse:** `src/components/document-editor/DocumentEditor.tsx`

**Tasks:**
- [ ] Integrate existing DocumentEditor
- [ ] Add live preview toggle (edit/preview/split)
- [ ] Handle drop events from findings panel
- [ ] Auto-insert finding content at cursor position
- [ ] Track which findings are in document

---

### 2.6 Workspace LLM Assistant (Right)

**New File:** `src/components/workspace/WorkspaceAssistant.tsx`

**Tasks:**
- [ ] Create scoped chat interface
- [ ] Context: document content + selected findings ONLY
- [ ] No external context injection (safe and predictable)
- [ ] Quick actions:
  - [ ] "Rewrite selection"
  - [ ] "Summarize"
  - [ ] "Structure as outline"
  - [ ] "Expand this point"
- [ ] Apply changes directly to document

---

## Phase 3: Document Save System

### 3.1 Save Document Modal

**New File:** `src/components/workspace/SaveDocumentModal.tsx`

**Tasks:**
- [ ] Create save modal component
- [ ] Document type selection:
  - [ ] Research memo
  - [ ] Legal analysis note
  - [ ] Draft argument
  - [ ] Template
- [ ] Title input field
- [ ] Optional description/tags
- [ ] Save to: folder picker

---

### 3.2 Auto-Save System

**New File:** `src/hooks/use-auto-save.ts`

**Tasks:**
- [ ] Create auto-save hook
- [ ] Debounced save (e.g., 2 seconds after last edit)
- [ ] Visual indicator: "Saving..." / "Saved"
- [ ] Handle offline/error states
- [ ] Version tracking (optional for v1)

---

### 3.3 Document Storage

**Tasks:**
- [ ] Define document API endpoints (coordinate with backend)
- [ ] POST `/documents` - Create document
- [ ] PUT `/documents/:id` - Update document
- [ ] GET `/documents` - List user documents
- [ ] GET `/documents/:id` - Get document

---

## Phase 4: Synthesis & Knowledge Library

### 4.1 Synthesis Action

**New File:** `src/components/workspace/SynthesizeAction.tsx`

**Tasks:**
- [ ] "Synthesize → Add to Knowledge Library" button
- [ ] Appears after document save
- [ ] Optional action (not forced)
- [ ] Triggers background processing

---

### 4.2 Synthesis Processing

**Tasks:**
- [ ] API endpoint for synthesis (coordinate with backend)
- [ ] Background job processing
- [ ] Extract: key concepts, sections, citations
- [ ] Create relationships/links

---

### 4.3 Synthesis Confirmation UI

**New File:** `src/components/workspace/SynthesisConfirmation.tsx`

**Tasks:**
- [ ] Show detected links before confirmation
- [ ] Example: "Linked to Section 420 · 425 · Case 1234/2564"
- [ ] Allow edits before final confirmation
- [ ] Destination picker:
  - [ ] Company Knowledge (shared)
  - [ ] Personal Knowledge (private)
- [ ] Non-technical language (avoid "graph" wording)

---

### 4.4 Knowledge Library Views

**New Files:**
- `src/app/(routes)/knowledge/page.tsx`
- `src/components/knowledge/KnowledgeLibrary.tsx`
- `src/components/knowledge/KnowledgeItem.tsx`

**Tasks:**
- [ ] Create Knowledge Library route
- [ ] List synthesized documents
- [ ] Show relationships between items
- [ ] Filter by: Company/Personal, date, type
- [ ] Search within knowledge base

---

## Design Principles Checklist

- [ ] **One-tap actions** whenever possible
- [ ] Keep user in flow - avoid page transitions
- [ ] Right-side panels and drawers instead of full-screen jumps
- [ ] Auto-organize findings (topic, session, date)
- [ ] Graph building happens **after**, not during writing
- [ ] Mobile UX avoids long-press unless necessary

---

## Acceptance Criteria

### Phase 1 (MVP)
- [ ] User can save key findings directly from chat with one tap
- [ ] Key Findings always accessible via navbar pin
- [ ] Findings persist in session
- [ ] Toast notification on save

### Phase 2 (Workspace)
- [ ] Workspace supports drag-and-drop from findings → document
- [ ] LLM side panel edits content safely and predictably
- [ ] Mode toggle between Chat and Workspace

### Phase 3 (Save)
- [ ] Documents can be saved with type classification
- [ ] Auto-save works reliably

### Phase 4 (Synthesis)
- [ ] Synthesis runs as an optional final step
- [ ] No step forces user to think in "graph" terminology
- [ ] Knowledge Library accessible and searchable

---

## File Structure (New Files)

```
src/
├── hooks/
│   ├── use-key-findings.ts          # Key findings state
│   └── use-auto-save.ts             # Document auto-save
│
├── contexts/
│   └── ToastContext.tsx             # Toast notifications
│
├── components/
│   ├── ui/
│   │   └── Toast.tsx                # Toast component
│   │
│   ├── chat/
│   │   └── SaveFindingButton.tsx    # Save to findings button
│   │
│   ├── key-findings/
│   │   ├── index.ts
│   │   ├── KeyFindingsDrawer.tsx    # Right-side drawer
│   │   └── KeyFindingItem.tsx       # Individual finding
│   │
│   ├── workspace/
│   │   ├── index.ts
│   │   ├── WorkspaceView.tsx        # Main workspace layout
│   │   ├── WorkspaceFindingsPanel.tsx
│   │   ├── WorkspaceAssistant.tsx   # Scoped LLM panel
│   │   ├── SaveDocumentModal.tsx
│   │   ├── SynthesizeAction.tsx
│   │   └── SynthesisConfirmation.tsx
│   │
│   └── knowledge/
│       ├── index.ts
│       ├── KnowledgeLibrary.tsx
│       └── KnowledgeItem.tsx
│
└── app/
    └── (routes)/
        ├── workspace/
        │   └── page.tsx             # Workspace route
        └── knowledge/
            └── page.tsx             # Knowledge library route
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/chat/LLMBubble.tsx` | Add SaveFindingButton |
| `src/components/Navbar.tsx` | Add Key Findings item + mode toggle |
| `src/components/layout/AppLayout.tsx` | Add drawer state, ToastProvider |
| `src/components/main-window/MainContentArea.tsx` | Add workspace ContentType |
| `src/app/layout.tsx` | Add ToastProvider wrapper |

---

## Dependencies

No new npm packages required. Leverages existing:
- Framer Motion (animations)
- TipTap (document editor)
- Tailwind CSS (styling)

---

## API Endpoints (MOCKED FOR NOW)

**Backend team directive:** Don't worry about backend implementation - mock all APIs using localStorage.

| Method | Endpoint | Mock Implementation |
|--------|----------|---------------------|
| POST | `/findings` | localStorage (`jurisimus-key-findings`) ✅ Done |
| GET | `/findings` | localStorage ✅ Done |
| DELETE | `/findings/:id` | localStorage ✅ Done |
| POST | `/documents` | localStorage (`jurisimus-documents`) |
| PUT | `/documents/:id` | localStorage |
| GET | `/documents` | localStorage |
| POST | `/synthesis/run` | Mock async processing |
| GET | `/synthesis/status/:id` | Mock status |
| GET | `/knowledge` | localStorage (`jurisimus-knowledge`) |

**When backend is ready:** Replace localStorage with actual API calls, keeping same interfaces.

---

## Timeline Estimate

| Phase | Scope |
|-------|-------|
| Phase 1 | Core key findings flow |
| Phase 2 | Workspace mode |
| Phase 3 | Document save system |
| Phase 4 | Synthesis & Knowledge Library |

---

## Notes

- Mobile UX: Use bottom sheets instead of side drawers
- Avoid long-press interactions on mobile
- Keep synthesis optional and non-intrusive
- Use plain language, avoid "graph" terminology for users
- **Backend APIs: MOCK EVERYTHING** - backend team said not to worry about their implementation
- Use localStorage for all persistence until backend is ready

---

## Status

**Current Phase:** Phase 1 - In Progress
**Last Updated:** 2025-12-29
**Owner:** Frontend Team

### Completed
- [x] Research view in Activity Bar (first icon)
- [x] Layout swap when research mode active
- [x] useKeyFindings hook with localStorage
- [x] KeyFindingsPanel (right sidebar)
- [x] Save button on LLM messages
- [x] Findings grouped by date
- [x] Rename, copy, delete actions

### In Progress
- [ ] Toast notification on save (polish)
- [ ] Text selection to save (optional)

### Next Up
- [ ] Workspace view (Phase 2)
