/**
 * File System API Client
 *
 * Unified access to folders and pages in the sidebar / file explorer.
 * Wraps the platform `/v1/file_system/*` endpoints plus the underlying
 * `/v1/folders` and `/v1/pages` CRUD.
 *
 * Wire shapes (`Folder`, `Page`) are imported from the generated OpenAPI
 * types — snake_case end-to-end per `docs/platform/api-discipline.md`.
 * The `FileNode` UI type is a discriminated union that merges the two
 * primitives into a single tree-node shape; its fields keep snake_case
 * to match wire convention (no rename shim).
 */

import { BaseApiClient } from "./api-client";
import { freshIdempotencyKey } from "./idempotency";
import type { Folder, Page } from "./generated/api/models";

// ============================================================================
// Types
// ============================================================================

/**
 * Content type for files in the file tree.
 * - 'document': Regular page/document
 */
export type FileContentType = "document";

/**
 * Icon can be an emoji or a file URL. Stored on `Folder.icon` /
 * `Page.icon` as JSONB; the wire ships it through unchanged.
 */
export interface IconObject {
  type: "emoji" | "file";
  emoji?: string;
  url?: string;
}

/**
 * FileNode represents a single item in the file system. Discriminated
 * on `type`: `'folder'` (container) vs `'file'` (page). Fields mirror
 * the wire convention (snake_case).
 */
export interface FileNode {
  id: string;
  name: string;
  type: "folder" | "file";
  content_type?: FileContentType;
  parent_id: string | null;
  icon: IconObject | null;
  position: number;
  created_at: string;
  updated_at: string;
}

/**
 * FileTreeNode is a FileNode with nested children. Used when the API
 * returns a pre-built tree.
 */
export interface FileTreeNode extends FileNode {
  children: FileTreeNode[];
}

// ============================================================================
// Request Types — snake_case per platform API discipline.
// ============================================================================

export interface CreateFolderRequest {
  name: string;
  parent_id?: string;
  /** Owning matter (work_item) — nests this folder inside that matter. */
  matter_id?: string;
  icon?: IconObject;
  is_personal?: boolean;
}

export interface CreateFileRequest {
  title: string;
  folder_id?: string;
  /** Owning matter (work_item) — nests this note directly under that matter. */
  matter_id?: string;
  icon?: IconObject;
  is_personal?: boolean;
}

export interface UpdateFolderRequest {
  name?: string;
  icon?: IconObject | null;
}

export interface UpdateFileRequest {
  title?: string;
  icon?: IconObject | null;
}

export interface MoveNodeRequest {
  parent_id?: string | null;
  position?: number;
}

// ============================================================================
// Response Types
// ============================================================================

export interface FileNodesResponse {
  data: FileNode[];
  meta: {
    total: number;
  };
}

export interface FileTreeResponse {
  tree: FileTreeNode[];
}

// ============================================================================
// API Client
// ============================================================================

class FileSystemApiClient extends BaseApiClient {
  // ============================================================================
  // File System Tree Endpoints
  // ============================================================================

  /**
   * Get flat list of all file nodes (folders + files).
   * Use this for client-side tree building with virtualization support.
   * @param scope - 'personal' for user's private files, 'team' for all files (default)
   */
  async getNodes(
    includeArchived = false,
    scope?: "personal" | "team",
  ): Promise<FileNodesResponse> {
    const params = new URLSearchParams();
    if (includeArchived) params.set("include_archived", "true");
    if (scope) params.set("scope", scope);
    const query = params.toString();
    return this.request<FileNodesResponse>(
      `/file_system/nodes${query ? `?${query}` : ""}`,
    );
  }

  /**
   * Get pre-built hierarchical tree structure.
   * Use this for simple file explorers.
   * @param scope - 'personal' for user's private files, 'team' for all files (default)
   */
  async getTree(
    includeArchived = false,
    scope?: "personal" | "team",
  ): Promise<FileTreeResponse> {
    const params = new URLSearchParams();
    if (includeArchived) params.set("include_archived", "true");
    if (scope) params.set("scope", scope);
    const query = params.toString();
    return this.request<FileTreeResponse>(
      `/file_system/tree${query ? `?${query}` : ""}`,
    );
  }

  // ============================================================================
  // Folder CRUD
  // ============================================================================

  async createFolder(
    request: CreateFolderRequest,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<{ folder: FileNode }> {
    const response = await this.request<{ folder: Folder }>("/folders", {
      method: "POST",
      body: JSON.stringify(request),
      headers: { "Idempotency-Key": idempotencyKey },
    });
    return {
      folder: this.mapFolderToNode(response.folder),
    };
  }

  async updateFolder(
    id: string,
    request: UpdateFolderRequest,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<{ folder: FileNode }> {
    const response = await this.request<{ folder: Folder }>(`/folders/${id}`, {
      method: "PUT",
      body: JSON.stringify(request),
      headers: { "Idempotency-Key": idempotencyKey },
    });
    return {
      folder: this.mapFolderToNode(response.folder),
    };
  }

  async moveFolder(
    id: string,
    request: MoveNodeRequest,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<{ folder: FileNode }> {
    const response = await this.request<{ folder: Folder }>(
      `/folders/${id}/move`,
      {
        method: "PUT",
        body: JSON.stringify(request),
        headers: { "Idempotency-Key": idempotencyKey },
      },
    );
    return {
      folder: this.mapFolderToNode(response.folder),
    };
  }

  async deleteFolder(
    id: string,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<void> {
    return this.request<void>(`/folders/${id}`, {
      method: "DELETE",
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }

  async restoreFolder(
    id: string,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<{ folder: FileNode }> {
    const response = await this.request<{ folder: Folder }>(
      `/folders/${id}/restore`,
      {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
      },
    );
    return {
      folder: this.mapFolderToNode(response.folder),
    };
  }

  // ============================================================================
  // File (Page) CRUD
  // ============================================================================

  async createFile(
    request: CreateFileRequest,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<{ file: FileNode }> {
    const response = await this.request<{ page: Page }>("/pages", {
      method: "POST",
      body: JSON.stringify({
        title: request.title,
        folder_id: request.folder_id,
        matter_id: request.matter_id,
        icon: request.icon,
        is_personal: request.is_personal,
      }),
      headers: { "Idempotency-Key": idempotencyKey },
    });
    return {
      file: this.mapPageToNode(response.page),
    };
  }

  async updateFile(
    id: string,
    request: UpdateFileRequest,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<{ file: FileNode }> {
    const response = await this.request<{ page: Page }>(`/pages/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        title: request.title,
        icon: request.icon,
      }),
      headers: { "Idempotency-Key": idempotencyKey },
    });
    return {
      file: this.mapPageToNode(response.page),
    };
  }

  async moveFile(
    id: string,
    request: MoveNodeRequest,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<{ file: FileNode }> {
    const response = await this.request<{ page: Page }>(`/pages/${id}/move`, {
      method: "PUT",
      body: JSON.stringify({
        folder_id: request.parent_id,
        position: request.position,
      }),
      headers: { "Idempotency-Key": idempotencyKey },
    });
    return {
      file: this.mapPageToNode(response.page),
    };
  }

  async deleteFile(
    id: string,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<void> {
    return this.request<void>(`/pages/${id}`, {
      method: "DELETE",
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }

  async restoreFile(
    id: string,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<{ file: FileNode }> {
    const response = await this.request<{ page: Page }>(
      `/pages/${id}/restore`,
      {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
      },
    );
    return {
      file: this.mapPageToNode(response.page),
    };
  }

  // ============================================================================
  // Matter subtree — folders + notes that live inside a matter (work_item).
  // ============================================================================

  /** Folders owned by a matter (`GET /v1/folders?matter_id=`). */
  async listFoldersByMatter(matterId: string): Promise<FileNode[]> {
    const res = await this.request<{ data: Folder[] }>(
      `/folders?matter_id=${matterId}`,
    );
    return res.data.map((f) => this.mapFolderToNode(f));
  }

  /** Notes owned directly by a matter (`GET /v1/pages?matter_id=`). */
  async listPagesByMatter(matterId: string): Promise<FileNode[]> {
    const res = await this.request<{ data: Page[] }>(
      `/pages?matter_id=${matterId}`,
    );
    return res.data.map((p) => this.mapPageToNode(p));
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private mapFolderToNode(folder: Folder): FileNode {
    return {
      id: folder.id,
      name: folder.name,
      type: "folder",
      parent_id: folder.parent_id ?? null,
      icon: (folder.icon as IconObject | null) ?? null,
      position: folder.position,
      created_at: folder.created_at,
      updated_at: folder.updated_at,
    };
  }

  private mapPageToNode(page: Page): FileNode {
    return {
      id: page.id,
      name: page.title || "Untitled",
      type: "file",
      parent_id: page.folder_id ?? null,
      icon: (page.icon as IconObject | null) ?? null,
      position: page.position,
      created_at: page.created_at,
      updated_at: page.updated_at,
    };
  }
}

export const fileSystemApi = new FileSystemApiClient();
