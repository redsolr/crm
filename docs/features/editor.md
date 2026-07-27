# Document Editor

> Tiptap-based rich text editor with slash commands, tables, AI collaboration, and multi-document tabs.

## Overview

The editor powers all document/note views. Built on Tiptap 3 with 15+ extensions. Supports markdown shortcuts, slash commands, tables, code blocks, hypothesis blocks, and AI-assisted writing.

## State Management

All tab and content state lives in the **Workspace Editor Store** (`stores/workspace-editor.store.ts`). Components read from it directly — no prop drilling through AppLayout.

| State | Purpose |
|-------|---------|
| `tabs` | Open editor tabs (preview + permanent) |
| `activeTabId` | Currently selected tab |
| `activeContent` | Content metadata for the active tab |
| `isSaving` | Whether a save is in progress |
| `contextItems` | Context builder chain items |

Key actions: `selectFile`, `closeTab`, `savePage`, `changeContent`, `openFinding`, `openContextBuilder`, `addToContext`, `contextItemClick`.

## File System

The backend auto-creates a **root folder** ("My Workspace") for every new account. All files and folders must be descendants of this root.

- New accounts get the root folder in the `createWithOwner` transaction (`accounts.service.ts`)
- Existing accounts get it lazily via `ensureRootFolder` on first `GET /file-system/nodes` call
- Frontend reads `rootFolderId` from `useFileSystemQuery()` — used by explorers to nest new items inside the root

## Files

| File | Purpose |
|------|---------|
| `components/document-editor/DocumentEditor.tsx` | Core editor with tab management |
| `components/document-editor/Toolbar.tsx` | Formatting toolbar |
| `components/document-editor/SlashCommandMenu.tsx` | / command menu for inserting blocks |
| `components/document-editor/TableControls.tsx` | Floating table manipulation controls |
| `components/document-editor/HypothesisBlock.tsx` | Custom research hypothesis blocks |
| `components/document-editor/PageLinkExtension.tsx` | Internal document linking |
| `components/document-editor/DiffView.tsx` | Side-by-side change comparison |
| `components/document-editor/ChangeProposal.tsx` | Review interface for AI-proposed changes |
| `components/document-editor/Minimap.tsx` | VS Code-style navigation minimap |
| `components/document-editor/StatusBar.tsx` | File info and modification state |
| `stores/workspace-editor.store.ts` | Zustand store for tabs, content, context |
| `lib/pagesApi.ts` | Page CRUD API client |
| `lib/blockApi.ts` | Block manipulation API client |
| `lib/key-findings-utils.ts` | Key findings bundle → markdown converter |
| `lib/finding-navigation.ts` | Scroll-to-finding DOM utility |
| `queries/documents/use-page-query.ts` | Page content query hooks |
| `queries/files/use-file-system-query.ts` | File system nodes + rootFolderId |

## Tiptap Extensions

Standard: StarterKit, Table, TaskList, TaskItem, CodeBlockLowlight, Highlight, Link, Image, Placeholder, Typography, Underline

Custom: HypothesisBlock, PageLink, SlashCommand

## Slash Commands

Type `/` to open the command menu:
- Heading 1/2/3
- Bullet list, Numbered list, Task list
- Code block, Blockquote
- Table, Image
- Hypothesis (research-specific)
- Page link (internal document reference)
