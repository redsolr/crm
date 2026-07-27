# Real-time Collaboration

> Multi-user real-time document editing with live cursors, powered by Yjs + Hocuspocus.

## Overview

When a user opens a document, a WebSocket connection is established to the backend's Hocuspocus server. All edits are synchronized in real-time between connected clients using Yjs CRDTs (Conflict-free Replicated Data Types). Cursors and selections are shared via the Yjs awareness protocol.

## Architecture

```
DocumentEditor (pageId prop)
  └── useCollaboration(pageId)
        ├── Y.Doc (CRDT document)
        ├── HocuspocusProvider (WebSocket client)
        │     ├── url: ws://api/collaboration
        │     ├── name: "page:{pageId}"
        │     └── token: JWT from authTokenManager
        └── Awareness (cursor positions, user info)

  └── Tiptap Editor
        ├── Collaboration extension (syncs content via Y.Doc)
        ├── CollaborationCursor extension (renders remote cursors)
        └── StarterKit (undoRedo: false — Yjs handles undo/redo)
```

## Key Files

| File | Purpose |
|------|---------|
| `hooks/use-collaboration.ts` | Hook managing HocuspocusProvider lifecycle |
| `components/document-editor/DocumentEditor.tsx` | Tiptap editor with collaboration extensions |
| `components/document-editor/types.ts` | `pageId` prop on `DocumentEditorProps` |
| `components/main-window/MainContentArea.tsx` | Passes `pageId={activeTabId}` to editor |

## useCollaboration Hook

```typescript
const { provider, ydoc, isSynced, isConnected, currentUser, connectedUsers } =
  useCollaboration({ pageId, enabled: true });
```

| Return Value | Type | Description |
|-------------|------|-------------|
| `provider` | `HocuspocusProvider \| null` | WebSocket provider instance |
| `ydoc` | `Y.Doc \| null` | Yjs document |
| `isSynced` | `boolean` | Document synced with server |
| `isConnected` | `boolean` | WebSocket connected |
| `currentUser` | `{ name, color }` | Current user's awareness info |
| `connectedUsers` | `number` | Number of connected clients |

## How Content Flows

1. `pageId` is passed to `DocumentEditor` (from `activeTabId`)
2. `useCollaboration` creates a `Y.Doc` + `HocuspocusProvider`
3. Provider connects to `ws://API_BASE/collaboration` with JWT token
4. Backend authenticates, loads Yjs state from PostgreSQL, syncs to client
5. `Collaboration` extension binds the `Y.Doc` to Tiptap's ProseMirror state
6. Edits are automatically synced — no manual save needed for collab content
7. `CollaborationCursor` renders other users' cursors with name labels and colors

## Packages

| Package | Purpose |
|---------|---------|
| `@hocuspocus/provider` | WebSocket client for Yjs sync |
| `@tiptap/extension-collaboration` | Binds Y.Doc to Tiptap editor |
| `@tiptap/extension-collaboration-cursor` | Renders remote cursors |
| `yjs` | CRDT library |
| `y-prosemirror` | ProseMirror bindings for Yjs |
| `y-indexeddb` | (available, not yet wired) Offline persistence |

## Status Indicator

The tab bar shows a connection status indicator when `pageId` is set:
- Green dot + "Connected" — WebSocket is active
- Green dot + "N collaborators" — Multiple users editing
- Yellow dot + "Connecting..." / "Reconnecting..." — Connection in progress

## Behavior Notes

- When collaboration is active, `initialContent` is ignored — content comes from Yjs
- Built-in undo/redo is disabled (`undoRedo: false` in StarterKit) — Yjs provides its own via the Collaboration extension
- Auto-save via `usePageQuery` still works for title changes; content persistence is handled by Hocuspocus server-side
- If `pageId` is null/undefined, editor falls back to non-collaborative mode (same as before)
