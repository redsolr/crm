/**
 * Route handler factories for notes/pages/folders endpoints.
 * Mocks the file-system API used by FileExplorer and PersonalExplorer.
 *
 * Wire contract (matches platform DTOs):
 *   - `/v1/file_system/nodes` returns `{ data, meta: { total } }`
 *     where each node uses snake_case (`parent_id`, `created_at`, etc.)
 *   - `/v1/folders/*` envelope: `{ folder }`
 *   - `/v1/pages/*` envelope: `{ page }`
 *   - The `Page` wire shape has `title` + `content` + `owner_id` +
 *     `owner_name` (polymorphic actor; opaque text, NOT prefixed acc_*)
 */

import { Page } from "@playwright/test";
import { API_V1, TEST_USER } from "./shared";

// ============================================================================
// Mock Data Types — snake_case throughout to match wire shape.
// ============================================================================

export interface MockFileNode {
  id: string;
  name: string;
  type: "folder" | "file";
  content_type?: "document";
  parent_id: string | null;
  icon: { type: "emoji"; emoji: string } | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface MockPageContent {
  id: string;
  title: string;
  content: string;
  folder_id: string | null;
  icon: { type: "emoji"; emoji: string } | null;
  cover: unknown | null;
  version: number;
  position: number;
  pinned: boolean;
  archived: boolean;
  in_trash: boolean;
  is_personal: boolean;
  workspace_id: string;
  owner_id: string;
  owner_name: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Factory Functions
// ============================================================================

let nodeCounter = 0;

export function createMockFolder(
  overrides: Partial<MockFileNode> = {},
): MockFileNode {
  nodeCounter++;
  const now = new Date().toISOString();
  return {
    id: overrides.id ?? `folder-e2e-${nodeCounter}`,
    name: overrides.name ?? `Test Folder ${nodeCounter}`,
    type: "folder",
    parent_id: overrides.parent_id ?? null,
    icon: overrides.icon ?? null,
    position: overrides.position ?? nodeCounter,
    created_at: overrides.created_at ?? now,
    updated_at: overrides.updated_at ?? now,
  };
}

export function createMockFile(
  overrides: Partial<MockFileNode> = {},
): MockFileNode {
  nodeCounter++;
  const now = new Date().toISOString();
  return {
    id: overrides.id ?? `file-e2e-${nodeCounter}`,
    name: overrides.name ?? `Test Page ${nodeCounter}`,
    type: "file",
    content_type: "document",
    parent_id: overrides.parent_id ?? null,
    icon: overrides.icon ?? null,
    position: overrides.position ?? nodeCounter,
    created_at: overrides.created_at ?? now,
    updated_at: overrides.updated_at ?? now,
  };
}

export function createMockPageContent(
  overrides: Partial<MockPageContent> = {},
): MockPageContent {
  const now = new Date().toISOString();
  return {
    id: overrides.id ?? `page-e2e-${++nodeCounter}`,
    title: overrides.title ?? "Test Page",
    content: overrides.content ?? "<p>Hello, this is test page content.</p>",
    folder_id: overrides.folder_id ?? null,
    icon: overrides.icon ?? null,
    cover: overrides.cover ?? null,
    version: overrides.version ?? 1,
    position: overrides.position ?? 0,
    pinned: overrides.pinned ?? false,
    archived: overrides.archived ?? false,
    in_trash: overrides.in_trash ?? false,
    is_personal: overrides.is_personal ?? false,
    workspace_id: overrides.workspace_id ?? "ws-e2e-default",
    owner_id: overrides.owner_id ?? TEST_USER.user_id,
    owner_name: overrides.owner_name ?? TEST_USER.full_name ?? null,
    created_at: overrides.created_at ?? now,
    updated_at: overrides.updated_at ?? now,
  };
}

// ============================================================================
// Default Mock Data
// ============================================================================

export function createDefaultFileTree(): MockFileNode[] {
  const rootFolder = createMockFolder({
    id: "folder-root",
    name: "My Workspace",
    parent_id: null,
    position: 0,
  });

  const projectsFolder = createMockFolder({
    id: "folder-projects",
    name: "Projects",
    parent_id: "folder-root",
    position: 1,
  });

  const notesFolder = createMockFolder({
    id: "folder-notes",
    name: "Notes",
    parent_id: "folder-root",
    position: 2,
  });

  const meetingNotes = createMockFile({
    id: "file-meeting-notes",
    name: "Meeting Notes",
    parent_id: "folder-notes",
    position: 1,
  });

  const projectPlan = createMockFile({
    id: "file-project-plan",
    name: "Project Plan",
    parent_id: "folder-projects",
    position: 1,
  });

  const rootPage = createMockFile({
    id: "file-getting-started",
    name: "Getting Started",
    parent_id: "folder-root",
    position: 3,
  });

  return [
    rootFolder,
    projectsFolder,
    notesFolder,
    meetingNotes,
    projectPlan,
    rootPage,
  ];
}

// ============================================================================
// Handler Options
// ============================================================================

export interface NotesHandlerOptions {
  /** Custom file tree nodes. Defaults to createDefaultFileTree(). */
  fileNodes?: MockFileNode[];
  /** Custom page content returned for GET /pages/:id. */
  pageContent?: MockPageContent;
  /** Scope to filter on ('personal' | 'team'). If set, only matching routes are mocked. */
  scope?: "personal" | "team";
}

// ============================================================================
// Setup Function
// ============================================================================

/**
 * Sets up route handlers for file-system, pages, and folders endpoints.
 *
 * IMPORTANT: Call this AFTER the auth fixture's handlers have been registered.
 * Playwright uses last-registered-wins for route matching, so these handlers
 * will override the empty-array defaults set by the auth fixture.
 */
export async function setupNotesHandlers(
  page: Page,
  options: NotesHandlerOptions = {},
) {
  const fileNodes = options.fileNodes ?? createDefaultFileTree();
  const defaultPageContent =
    options.pageContent ??
    createMockPageContent({
      id: "file-meeting-notes",
      title: "Meeting Notes",
      content: "<p>Hello, this is test page content.</p>",
      folder_id: "folder-notes",
    });

  // ------------------------------------------------------------------
  // GET /v1/file_system/nodes — returns flat list of all file nodes
  // ------------------------------------------------------------------
  await page.route(`${API_V1}/file_system/nodes**`, async (route) => {
    const url = new URL(route.request().url());
    const scope = url.searchParams.get("scope");

    // If a scope filter is requested and we have a specific scope, respect it
    let filteredNodes = fileNodes;
    if (scope === "personal") {
      filteredNodes = options.scope === "personal" ? fileNodes : [];
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: filteredNodes,
        meta: { total: filteredNodes.length },
      }),
    });
  });

  // ------------------------------------------------------------------
  // GET /v1/file_system/tree — returns pre-built tree structure
  // ------------------------------------------------------------------
  await page.route(`${API_V1}/file_system/tree**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ tree: [] }),
    });
  });

  // ------------------------------------------------------------------
  // GET /v1/pages/:id — page content
  // PUT /v1/pages/:id — update
  // DELETE /v1/pages/:id — soft delete
  // POST /v1/pages/:id/restore — restore
  // PUT /v1/pages/:id/move — move folder
  // ------------------------------------------------------------------
  await page.route(
    (url) => /^\/v1\/pages\/[^/]+(\/.*)?$/.test(url.pathname),
    async (route, request) => {
      const method = request.method();
      const url = request.url();
      const pathParts =
        url.split("/v1/pages/")[1]?.split("?")[0]?.split("/") ?? [];
      const pageId = pathParts[0] ?? "";
      const subPath = pathParts[1];

      // POST /v1/pages/:id/restore
      if (method === "POST" && subPath === "restore") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            page: createMockPageContent({ id: pageId }),
          }),
        });
        return;
      }

      // PUT /v1/pages/:id/move
      if (method === "PUT" && subPath === "move") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            page: createMockPageContent({ id: pageId }),
          }),
        });
        return;
      }

      if (method === "GET") {
        const p =
          pageId === defaultPageContent.id
            ? defaultPageContent
            : createMockPageContent({ id: pageId, title: "Untitled" });
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ page: p }),
        });
        return;
      }

      if (method === "PUT") {
        let body: Record<string, unknown> = {};
        try {
          body = JSON.parse(request.postData() ?? "{}") as Record<
            string,
            unknown
          >;
        } catch {
          // ignore parse errors — empty body still allowed
        }
        const updated = createMockPageContent({
          id: pageId,
          title: (body.title as string) ?? defaultPageContent.title,
          content: (body.content as string) ?? defaultPageContent.content,
          folder_id: defaultPageContent.folder_id,
        });
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ page: updated }),
        });
        return;
      }

      if (method === "DELETE") {
        await route.fulfill({ status: 204 });
        return;
      }

      await route.fallback();
    },
  );

  // ------------------------------------------------------------------
  // POST /v1/pages — create
  // GET /v1/pages — list (empty by default)
  // ------------------------------------------------------------------
  await page.route(`${API_V1}/pages**`, async (route, request) => {
    const u = new URL(request.url());
    // Defer to /v1/pages/:id handler
    if (u.pathname !== "/v1/pages") {
      await route.fallback();
      return;
    }

    if (request.method() === "POST") {
      let body: Record<string, unknown> = {};
      try {
        body = JSON.parse(request.postData() ?? "{}") as Record<
          string,
          unknown
        >;
      } catch {
        // ignore parse errors
      }
      const newPage = createMockPageContent({
        title: (body.title as string) ?? "Untitled",
        folder_id: (body.folder_id as string) ?? null,
        content: (body.content as string) ?? "",
      });
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ page: newPage }),
      });
      return;
    }

    if (request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [],
          has_more: false,
          next_page_url: null,
          previous_page_url: null,
        }),
      });
      return;
    }

    await route.fallback();
  });

  // ------------------------------------------------------------------
  // POST /v1/folders — create
  // ------------------------------------------------------------------
  await page.route(`${API_V1}/folders`, async (route, request) => {
    if (request.method() !== "POST") {
      await route.fallback();
      return;
    }
    let body: Record<string, unknown> = {};
    try {
      body = JSON.parse(request.postData() ?? "{}") as Record<string, unknown>;
    } catch {
      // ignore parse errors
    }
    const newFolder = createMockFolder({
      name: (body.name as string) ?? "New Folder",
      parent_id: (body.parent_id as string) ?? null,
    });
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ folder: newFolder }),
    });
  });

  // ------------------------------------------------------------------
  // PUT/DELETE /v1/folders/:id
  // PUT /v1/folders/:id/move
  // GET /v1/folders/:id/children (legacy)
  // ------------------------------------------------------------------
  await page.route(
    (url) => /^\/v1\/folders\/[^/]+(\/.*)?$/.test(url.pathname),
    async (route, request) => {
      const method = request.method();
      const url = request.url();
      const pathParts =
        url.split("/v1/folders/")[1]?.split("?")[0]?.split("/") ?? [];
      const folderId = pathParts[0] ?? "";
      const subPath = pathParts[1];

      // Folder views (board / backlog / calendar / settings) — handled
      // by setupTaskHandlers / view-specific handlers in tests that
      // need them; here we just return empty defaults to avoid 404
      // chatter in the unrelated specs.
      if (subPath === "views") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            columns: [],
            data: [],
            has_more: false,
            next_page_url: null,
          }),
        });
        return;
      }

      if (method === "PUT" && subPath === "move") {
        const existing = fileNodes.find((n) => n.id === folderId);
        const updated = createMockFolder({
          id: folderId,
          name: existing?.name ?? "Folder",
        });
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ folder: updated }),
        });
        return;
      }

      if (method === "PUT") {
        let body: Record<string, unknown> = {};
        try {
          body = JSON.parse(request.postData() ?? "{}") as Record<
            string,
            unknown
          >;
        } catch {
          // ignore parse errors
        }
        const existing = fileNodes.find((n) => n.id === folderId);
        const updated = createMockFolder({
          id: folderId,
          name: (body.name as string) ?? existing?.name ?? "Folder",
          parent_id: existing?.parent_id ?? null,
        });
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ folder: updated }),
        });
        return;
      }

      if (method === "DELETE") {
        await route.fulfill({ status: 204 });
        return;
      }

      if (method === "GET" && subPath === "children") {
        const children = fileNodes.filter((n) => n.parent_id === folderId);
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: children }),
        });
        return;
      }

      if (method === "GET") {
        const folder =
          fileNodes.find((n) => n.id === folderId) ??
          createMockFolder({ id: folderId });
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ folder }),
        });
        return;
      }

      await route.fallback();
    },
  );
}
