# Feature: Notion-Style Block Model

Backend implementation complete. This document describes the new block-based content system for the frontend team.

---

## Overview

We've implemented a **Notion-style block model** where everything is a block. This replaces the old documents approach with a more flexible system that supports:

- Freeform markdown documents
- Kanban boards
- Timelines / Roadmaps
- Tables with custom schemas
- Any combination of the above

### Key Concepts

| Term | Description |
|------|-------------|
| **Page** | A special block that can be opened (document or database row) |
| **Block** | Content inside pages (paragraph, heading, list, to-do, etc.) |
| **Space** | A database container (NOT the table itself) |
| **Source** | The actual table with schema and rows (lives inside a Space) |
| **Source View** | How to display a Source (table, board, timeline, calendar, list, gallery) |

### Entity Hierarchy

```
Workspace (root)
├── Page (standalone document)
│   └── Blocks (content)
└── Space (database)
    └── Source (table)
        ├── Source Views (table, board, timeline...)
        └── Pages (rows)
            └── Blocks (card content)
```

---

## API Endpoints

Base URL: ``

### Pages

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/pages` | Create a page |
| `GET` | `/pages` | List pages (with filters) |
| `GET` | `/pages/trash` | List trashed pages |
| `GET` | `/pages/:id` | Get a page |
| `PUT` | `/pages/:id` | Update a page |
| `PUT` | `/pages/:id/move` | Move/reorder a page |
| `DELETE` | `/pages/:id` | Soft delete (move to trash) |
| `POST` | `/pages/:id/restore` | Restore from trash |
| `DELETE` | `/pages/:id/permanent` | Permanently delete |

### Blocks

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/blocks` | Create a block |
| `POST` | `/blocks/append?parentType=...&parentId=...` | Append multiple blocks |
| `GET` | `/blocks?parentType=...&parentId=...` | List child blocks |
| `GET` | `/blocks/:id` | Get a block |
| `PUT` | `/blocks/:id` | Update a block |
| `PUT` | `/blocks/:id/move` | Move/reorder a block |
| `DELETE` | `/blocks/:id` | Delete a block |

### Spaces (Databases)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/spaces` | Create a space |
| `GET` | `/spaces` | List spaces |
| `GET` | `/spaces/:id` | Get a space |
| `PUT` | `/spaces/:id` | Update a space |
| `DELETE` | `/spaces/:id` | Delete a space |

### Sources (Data Tables)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/spaces/:spaceId/sources` | Create a source |
| `GET` | `/spaces/:spaceId/sources` | List sources in a space |
| `GET` | `/spaces/:spaceId/sources/:sourceId` | Get a source |
| `PUT` | `/spaces/:spaceId/sources/:sourceId` | Update a source |
| `DELETE` | `/spaces/:spaceId/sources/:sourceId` | Delete a source |

### Source Views

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/spaces/:spaceId/sources/:sourceId/views` | Create a view |
| `GET` | `/spaces/:spaceId/sources/:sourceId/views` | List views |
| `GET` | `/spaces/:spaceId/sources/:sourceId/views/:viewId` | Get a view |
| `PUT` | `/spaces/:spaceId/sources/:sourceId/views/:viewId` | Update a view |
| `DELETE` | `/spaces/:spaceId/sources/:sourceId/views/:viewId` | Delete a view |

---

## Request/Response Types

### Pages

#### Create Page
```typescript
// POST /pages
interface CreatePageRequest {
  parentType: 'workspace' | 'page' | 'block' | 'source';
  parentId?: string;      // required unless parentType is 'workspace'
  icon?: IconObject;      // { type: 'emoji', emoji: '📄' } or { type: 'file', url: '...' }
  cover?: FileObject;     // { url: '...', ... }
  properties?: Record<string, PropertyValue>;
}

// Response: { page: Page }
```

#### Page Properties

Page properties depend on the parent type:

**Standalone page** (parent: workspace/page/block):
```json
{
  "properties": {
    "title": {
      "id": "title",
      "type": "title",
      "title": [{ "type": "text", "text": { "content": "My Document" } }]
    }
  }
}
```

**Database row** (parent: source):
```json
{
  "properties": {
    "Name": { "id": "title", "type": "title", "title": [...] },
    "Status": { "id": "st", "type": "select", "select": { "name": "Done", "color": "green" } },
    "Due Date": { "id": "dd", "type": "date", "date": { "start": "2025-01-15" } }
  }
}
```

#### Query Pages
```typescript
// GET /pages?parentType=source&parentId=xxx&page=1&limit=50
interface PagesQuery {
  parentType?: 'workspace' | 'page' | 'block' | 'source';
  parentId?: string;
  archived?: boolean;
  inTrash?: boolean;
  page?: number;    // pagination
  limit?: number;
}

// Response: { pages: Page[], total: number }
```

#### Move Page
```typescript
// PUT /pages/:id/move
interface MovePageRequest {
  parentType: 'workspace' | 'page' | 'block' | 'source';
  parentId?: string;
  position?: number;  // 0-indexed position among siblings
}
```

### Blocks

#### Block Types (31 types)
```typescript
type BlockType =
  // Text
  | 'paragraph' | 'heading_1' | 'heading_2' | 'heading_3'
  | 'quote' | 'callout' | 'code'
  // Lists
  | 'bulleted_list_item' | 'numbered_list_item' | 'to_do' | 'toggle'
  // Media
  | 'image' | 'video' | 'audio' | 'file' | 'pdf'
  | 'bookmark' | 'embed' | 'link_preview'
  // Structure
  | 'divider' | 'table_of_contents' | 'breadcrumb'
  | 'column_list' | 'column' | 'table' | 'table_row'
  // Database
  | 'child_database' | 'child_page'
  // Advanced
  | 'synced_block' | 'template' | 'equation';
```

#### Create Block
```typescript
// POST /blocks
interface CreateBlockRequest {
  type: BlockType;
  parentType: 'page' | 'block' | 'source';
  parentId: string;
  properties?: Record<string, unknown>;  // type-specific (color, checked, language, etc.)
  content?: RichText[];                  // for text blocks
}

// Response: { block: Block }
```

#### Rich Text Format
```typescript
interface RichText {
  type: 'text' | 'mention' | 'equation';
  text?: { content: string; link?: { url: string } };
  mention?: { type: 'user' | 'page' | 'date'; ... };
  equation?: { expression: string };
  annotations: {
    bold: boolean;
    italic: boolean;
    strikethrough: boolean;
    underline: boolean;
    code: boolean;
    color: Color;
  };
  plain_text: string;
  href?: string;
}
```

#### Append Multiple Blocks
```typescript
// POST /blocks/append?parentType=page&parentId=xxx
interface AppendBlocksRequest {
  blocks: CreateBlockRequest[];
}

// Response: { blocks: Block[] }
```

### Spaces (Databases)

#### Create Space
```typescript
// POST /spaces
interface CreateSpaceRequest {
  parentType: 'workspace' | 'page' | 'block';
  parentId?: string;
  title: string;
  description?: string;
  icon?: IconObject;
  cover?: FileObject;
  isInline?: boolean;  // inline vs full-page database
}

// Response: { space: Space }
```

### Sources (Data Tables)

#### Create Source
```typescript
// POST /spaces/:spaceId/sources
interface CreateSourceRequest {
  name: string;
  icon?: IconObject;
  schema?: Record<string, PropertyDefinition>;
}

// Response: { source: Source }
```

#### Property Definition Schema
```typescript
interface PropertyDefinition {
  id: string;
  name: string;
  type: PropertyType;
  // Type-specific config:
  select?: { options: SelectOption[] };
  multi_select?: { options: SelectOption[] };
  number?: { format: 'number' | 'currency' | 'percent' };
  formula?: { expression: string };
  relation?: { database_id: string };
  // etc.
}

type PropertyType =
  | 'title'           // required, one per source
  | 'rich_text'
  | 'number'
  | 'select'
  | 'multi_select'
  | 'status'
  | 'date'
  | 'people'
  | 'files'
  | 'checkbox'
  | 'url'
  | 'email'
  | 'phone_number'
  | 'formula'
  | 'relation'
  | 'rollup'
  | 'created_time'
  | 'created_by'
  | 'last_edited_time'
  | 'last_edited_by';
```

#### Example: Task Board Schema
```json
{
  "Name": {
    "id": "title",
    "name": "Name",
    "type": "title"
  },
  "Status": {
    "id": "status",
    "name": "Status",
    "type": "select",
    "select": {
      "options": [
        { "id": "1", "name": "Todo", "color": "gray" },
        { "id": "2", "name": "In Progress", "color": "blue" },
        { "id": "3", "name": "Done", "color": "green" }
      ]
    }
  },
  "Priority": {
    "id": "priority",
    "name": "Priority",
    "type": "select",
    "select": {
      "options": [
        { "id": "1", "name": "Low", "color": "gray" },
        { "id": "2", "name": "Medium", "color": "yellow" },
        { "id": "3", "name": "High", "color": "red" }
      ]
    }
  },
  "Due Date": {
    "id": "due",
    "name": "Due Date",
    "type": "date"
  },
  "Assignee": {
    "id": "assignee",
    "name": "Assignee",
    "type": "people"
  }
}
```

### Source Views

#### Create View
```typescript
// POST /spaces/:spaceId/sources/:sourceId/views
interface CreateSourceViewRequest {
  name: string;
  type: 'table' | 'board' | 'timeline' | 'calendar' | 'list' | 'gallery';
  query?: {
    filter?: FilterGroup;
    sort?: Sort[];
    group_by?: string;  // property key for board/timeline grouping
  };
  layout?: {
    visible_properties?: string[];
    property_widths?: Record<string, number>;
    card_size?: 'small' | 'medium' | 'large';
    // view-specific config...
  };
}

// Response: { view: SourceView }
```

#### Example Views

**Kanban Board:**
```json
{
  "name": "Task Board",
  "type": "board",
  "query": {
    "group_by": "Status",
    "sort": [{ "property": "Priority", "direction": "descending" }]
  },
  "layout": {
    "visible_properties": ["Assignee", "Due Date", "Priority"],
    "card_size": "medium"
  }
}
```

**Timeline:**
```json
{
  "name": "Roadmap",
  "type": "timeline",
  "query": {
    "filter": { "property": "Status", "select": { "does_not_equal": "Done" } }
  },
  "layout": {
    "date_property": "Due Date",
    "visible_properties": ["Status", "Assignee"]
  }
}
```

---

## Implementation Guide

### 1. Freeform Document (Markdown Editor)

```typescript
// 1. Create a page
const { page } = await api.post('/pages', {
  parentType: 'workspace',
  properties: {
    title: { type: 'title', title: [{ type: 'text', text: { content: 'My Notes' } }] }
  }
});

// 2. Add content blocks
await api.post(`/blocks/append?parentType=page&parentId=${page.id}`, {
  blocks: [
    { type: 'heading_1', content: [{ type: 'text', text: { content: 'Introduction' } }] },
    { type: 'paragraph', content: [{ type: 'text', text: { content: 'This is my document...' } }] },
    { type: 'bulleted_list_item', content: [{ type: 'text', text: { content: 'Point one' } }] },
    { type: 'bulleted_list_item', content: [{ type: 'text', text: { content: 'Point two' } }] },
  ]
});

// 3. Fetch page with blocks
const { page } = await api.get(`/pages/${pageId}`);
const { blocks } = await api.get(`/blocks?parentType=page&parentId=${pageId}`);
```

### 2. Kanban Board

```typescript
// 1. Create a space (database container)
const { space } = await api.post('/spaces', {
  parentType: 'workspace',
  title: 'Project Tasks'
});

// 2. Create a source with schema
const { source } = await api.post(`/spaces/${space.id}/sources`, {
  name: 'Tasks',
  schema: {
    Name: { id: 'title', name: 'Name', type: 'title' },
    Status: { id: 'status', name: 'Status', type: 'select', select: { options: [...] } },
    Priority: { id: 'priority', name: 'Priority', type: 'select', select: { options: [...] } },
  }
});

// 3. Create a board view
const { view } = await api.post(`/spaces/${space.id}/sources/${source.id}/views`, {
  name: 'Board',
  type: 'board',
  query: { group_by: 'Status' }
});

// 4. Add rows (pages with parent = source)
await api.post('/pages', {
  parentType: 'source',
  parentId: source.id,
  properties: {
    Name: { type: 'title', title: [{ type: 'text', text: { content: 'Fix login bug' } }] },
    Status: { type: 'select', select: { name: 'In Progress' } },
    Priority: { type: 'select', select: { name: 'High' } },
  }
});

// 5. Fetch rows for the board
const { pages: rows } = await api.get(`/pages?parentType=source&parentId=${source.id}`);
```

### 3. Timeline / Roadmap

Same as Kanban, but with a `timeline` view type:

```typescript
const { view } = await api.post(`/spaces/${space.id}/sources/${source.id}/views`, {
  name: 'Roadmap',
  type: 'timeline',
  query: { group_by: 'Status' },
  layout: {
    date_property: 'Due Date',
    end_date_property: 'End Date',  // optional for ranges
  }
});
```

### 4. Nested Content (Page inside Page)

```typescript
// Create a child page
const { page: childPage } = await api.post('/pages', {
  parentType: 'page',
  parentId: parentPageId,
  properties: {
    title: { type: 'title', title: [{ type: 'text', text: { content: 'Sub-document' } }] }
  }
});

// Add blocks to the child page
await api.post(`/blocks/append?parentType=page&parentId=${childPage.id}`, { blocks: [...] });
```

### 5. Inline Database (Database inside Page)

```typescript
// Create an inline space within a page
const { space } = await api.post('/spaces', {
  parentType: 'page',
  parentId: pageId,
  title: 'Task List',
  isInline: true
});

// Then create source, views, and rows as usual
```

---

## Frontend Components to Build

1. **PageEditor** - Rich text editor for pages (use TipTap or similar)
2. **BlockRenderer** - Render different block types
3. **SpaceView** - Container for source views
4. **TableView** - Spreadsheet-like view
5. **BoardView** - Kanban columns
6. **TimelineView** - Gantt-style timeline
7. **CalendarView** - Month/week calendar
8. **ListView** - Simple list
9. **GalleryView** - Card grid
10. **PropertyEditor** - Edit page properties based on schema
11. **SchemaEditor** - Add/edit columns in a source

---

## Questions?

Ping backend team or check `notion.md` in `core-api` for the full data model documentation.
