# Frontend (web-app) - Task Tracking

## Current Status

### Recently Completed
- [x] TipTap v3 document editor with rich text features
- [x] Table support with TipTap table extensions
- [x] Table controls (add row/column buttons, cell options menu)
- [x] Table resize handle for drag-to-add rows/columns
- [x] Hover-based table controls (appear on hover, not just click)
- [x] Dark theme styling for table controls
- [x] Column resizing support (fixed `pointer-events: none` bug)
- [x] Page link extension for linking between pages
- [x] Page link menu with search API integration
- [x] Slash command menu (Notion-style `/` commands)
- [x] Task lists (checkboxes/to-do)
- [x] Code block syntax highlighting (lowlight)
- [x] Drag handle for blocks
- [x] Minimap component
- [x] Revision timeline & diff view
- [x] **Add to Paper** - Right-click context menu to append selected text to current open document

### Known Issues
- [x] **Table drag-to-create column width** - ~~New columns created via drag don't persist width properly~~ FIXED: Now sets `colwidth` attribute via ProseMirror transaction
- [x] ~~Table column widths don't persist after page reload~~ FIXED: Uses TipTap's `setNodeMarkup` to set `colwidth` attribute on new cells

---

## Document Editor Features

### Implemented
- Rich text formatting (bold, italic, underline, strikethrough)
- Headings (H1, H2, H3)
- Lists (bullet, numbered, task lists)
- Blockquotes
- Code blocks with syntax highlighting
- Horizontal rules
- Tables with:
  - Add row/column buttons
  - Cell options menu (insert/delete row/column, toggle headers, merge/split)
  - Column resizing
  - Drag handle to add rows/columns
- Page links (internal linking)
- Slash command menu
- Bubble menu for text formatting
- Drag handle for block reordering
- Minimap navigation
- Revision timeline
- Diff view

### In Progress
- [~] **LLM Document Editing** - Chat AI can edit the current document (frontend ready, needs backend tool support)
  - ✅ ActiveDocumentContext - exposes editor to chat
  - ✅ Document editing tools defined (view_document, replace_text, insert_text, append_text, replace_document)
  - ✅ useDocumentTools hook for tool execution
  - ✅ DocumentEditor registers with context
  - ⏳ Backend needs to support Anthropic-style tool use

### Planned/TODO
- [ ] Image upload and embedding
- [ ] File attachments
- [ ] Embeds (YouTube, Twitter, etc.)
- [ ] Comments/annotations
- [ ] Real-time collaboration (CRDT/WebSocket)
- [ ] Export to PDF/Word/Markdown
- [ ] Keyboard shortcuts customization
- [ ] Table of contents generation
- [ ] Search within document
- [ ] Undo/redo history visualization

---

## API Integration

### Implemented
- Page search API (`GET /pages/search`)
- Page CRUD operations

### Planned
- [ ] Auto-save with debouncing
- [ ] Optimistic updates
- [ ] Offline support with sync
- [ ] Conflict resolution

---

## UI/UX Improvements

### Planned
- [ ] Better mobile support
- [ ] Touch gestures for tables
- [ ] Accessibility improvements (ARIA labels, keyboard navigation)
- [ ] Theme customization
- [ ] Print styles

---

## Performance

### Planned
- [ ] Virtualization for large documents
- [ ] Lazy loading for images/embeds
- [ ] Service worker caching
- [ ] Bundle size optimization

---

## Tech Stack
- Next.js 15
- React 19
- TipTap v3 (ProseMirror-based editor)
- Tailwind CSS v4
- TypeScript 5
- WorkOS AuthKit

## Key Files
- `src/components/document-editor/DocumentEditor.tsx` - Main editor component
- `src/components/document-editor/TableControls.tsx` - Table hover controls
- `src/components/document-editor/EditorStyles.tsx` - Editor CSS styles
- `src/components/document-editor/SlashCommandMenu.tsx` - Slash commands
- `src/components/document-editor/PageLinkExtension.tsx` - Page link node
- `src/components/document-editor/PageLinkMenu.tsx` - Page link search UI
- `src/components/document-editor/DragHandle.tsx` - Block drag handle
- `src/components/document-editor/Minimap.tsx` - Document minimap

---

## Quick Commands

```bash
# Development
npm run dev

# Build
npm run build

# Tests
npm run test

# Lint
npm run lint
```
