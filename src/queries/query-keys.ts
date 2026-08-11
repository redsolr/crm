export const queryKeys = {
  // Auth
  auth: {
    all: ["auth"] as const,
    session: () => [...queryKeys.auth.all, "session"] as const,
  },

  // Knowledge Graph
  knowledgeGraph: {
    all: ["knowledgeGraph"] as const,
    view: (filters?: Record<string, unknown>) =>
      [...queryKeys.knowledgeGraph.all, "view", filters ?? {}] as const,
    entity: (entity_id: string) =>
      [...queryKeys.knowledgeGraph.all, "entity", entity_id] as const,
  },

  // Legal documents (paginated court-ready documents — platform /api/legal/documents)
  legalDocuments: {
    all: ["legalDocuments"] as const,
    list: (workspaceId: string, matterId?: string) =>
      [...queryKeys.legalDocuments.all, "list", workspaceId, matterId ?? null] as const,
    detail: (documentId: string) =>
      [...queryKeys.legalDocuments.all, documentId] as const,
  },

  // Legal Library (Thai CCC corpus + Deka cases — sandbox/platform legal API)
  legal: {
    all: ["legal"] as const,
    codes: () => [...queryKeys.legal.all, "codes"] as const,
    sections: (code: string, q: string) =>
      [...queryKeys.legal.all, "sections", code, q] as const,
    section: (code: string, no: string) =>
      [...queryKeys.legal.all, "section", code, no] as const,
    search: (q: string) => [...queryKeys.legal.all, "search", q] as const,
  },

  // Workspace
  organizations: {
    all: ["organizations"] as const,
    list: () => [...queryKeys.organizations.all, "list"] as const,
    detail: (id: string) => [...queryKeys.organizations.all, id] as const,
  },

  // Workflows + workflow states — workspace-scoped on the platform.
  workflows: {
    all: ["workflows"] as const,
    byWorkspace: (workspaceId: string) =>
      [...queryKeys.workflows.all, "workspace", workspaceId] as const,
    states: (workflowId: string) =>
      [...queryKeys.workflows.all, workflowId, "states"] as const,
  },

  workspaces: {
    all: ["workspaces"] as const,
    detail: (workspaceId: string) =>
      [...queryKeys.workspaces.all, workspaceId] as const,
  },

  // Seat invites (own-the-invite-flow arc)
  invites: {
    all: ["invites"] as const,
  },

  // Agent memories (ChatGPT-memory arc)
  memories: {
    all: ["memories"] as const,
  },

  // Chat
  chats: {
    all: ["chats"] as const,
    list: (folder_id?: string) =>
      [...queryKeys.chats.all, "list", { folder_id }] as const,
    detail: (chatId: string) => [...queryKeys.chats.all, chatId] as const,
    messages: (chatId: string) =>
      [...queryKeys.chats.all, chatId, "messages"] as const,
    branches: (chatId: string) =>
      [...queryKeys.chats.all, chatId, "branches"] as const,
    branchTree: (chatId: string) =>
      [...queryKeys.chats.all, chatId, "tree"] as const,
    history: (filters?: Record<string, unknown>) =>
      [...queryKeys.chats.all, "history", filters] as const,
  },

  // File system
  fileSystem: {
    all: ["fileSystem"] as const,
    nodes: (scope?: string) =>
      [...queryKeys.fileSystem.all, "nodes", { scope }] as const,
    tree: (scope?: string) =>
      [...queryKeys.fileSystem.all, "tree", { scope }] as const,
  },

  // Pages / Documents
  pages: {
    all: ["pages"] as const,
    detail: (pageId: string) => [...queryKeys.pages.all, pageId] as const,
  },

  // Blocks
  blocks: {
    all: ["blocks"] as const,
    byParent: (parentType: string, parent_id: string) =>
      [...queryKeys.blocks.all, parentType, parent_id] as const,
  },

  // Work items
  workItems: {
    all: ["workItems"] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.workItems.all, "list", filters] as const,
    detail: (id: string) => [...queryKeys.workItems.all, id] as const,
  },

  // Epics
  epics: {
    all: ["epics"] as const,
    byProject: (project_id: string) =>
      [...queryKeys.epics.all, "project", project_id] as const,
    detail: (id: string) => [...queryKeys.epics.all, id] as const,
  },

  // Iterations
  iterations: {
    all: ["iterations"] as const,
    byWorkspace: (workspace_id: string) =>
      [...queryKeys.iterations.all, "workspace", workspace_id] as const,
    detail: (id: string) => [...queryKeys.iterations.all, id] as const,
  },

  // Labels
  labels: {
    all: ["labels"] as const,
    byProject: (project_id: string) =>
      [...queryKeys.labels.all, "project", project_id] as const,
  },

  // Folder views (board, backlog, calendar, timeline)
  folderViews: {
    all: ["folderViews"] as const,
    board: (folder_id: string) =>
      [...queryKeys.folderViews.all, "board", folder_id] as const,
    backlog: (folder_id: string) =>
      [...queryKeys.folderViews.all, "backlog", folder_id] as const,
    calendar: (folder_id: string, start: string, end: string) =>
      [...queryKeys.folderViews.all, "calendar", folder_id, start, end] as const,
    timeline: (folder_id: string) =>
      [...queryKeys.folderViews.all, "timeline", folder_id] as const,
  },

  // Saved views (/api/views) — explicit, user-created saved query specs
  // (filters + groupBy) over a surface. Distinct from folderViews above
  // (which are per-folder implicit view_settings).
  savedViews: {
    all: ["savedViews"] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.savedViews.all, "list", filters ?? {}] as const,
  },

  // Source / Kanban / Timeline
  sources: {
    all: ["sources"] as const,
    detail: (spaceId: string, sourceId: string) =>
      [...queryKeys.sources.all, spaceId, sourceId] as const,
    items: (sourceId: string) =>
      [...queryKeys.sources.all, sourceId, "items"] as const,
    views: (spaceId: string, sourceId: string) =>
      [...queryKeys.sources.all, spaceId, sourceId, "views"] as const,
  },

  // Instructions
  instructions: {
    all: ["instructions"] as const,
    byFolder: (folder_id: string) =>
      [...queryKeys.instructions.all, "folder", folder_id] as const,
    inherited: (folder_id: string) =>
      [...queryKeys.instructions.all, "inherited", folder_id] as const,
    templates: () => [...queryKeys.instructions.all, "templates"] as const,
  },

  // Reminders
  reminders: {
    all: ["reminders"] as const,
    list: () => [...queryKeys.reminders.all, "list"] as const,
  },

  // Usage
  usage: {
    all: ["usage"] as const,
    summary: (account_id: string) =>
      [...queryKeys.usage.all, "summary", account_id] as const,
    organizationSummary: (organization_id: string) =>
      [...queryKeys.usage.all, "organization", organization_id] as const,
    billing: (account_id: string) =>
      [...queryKeys.usage.all, "billing", account_id] as const,
    limit: (account_id: string, type?: string) =>
      [...queryKeys.usage.all, "limit", account_id, type] as const,
  },

  // Key Findings
  findings: {
    all: ["findings"] as const,
    byChatId: (chatId: string) =>
      [...queryKeys.findings.all, "chat", chatId] as const,
  },

  // /api/responses — LLM-native reasoning front door.
  responses: {
    all: ["responses"] as const,
    founderBrief: (horizon: "this_week") =>
      [...queryKeys.responses.all, "founder_brief", horizon] as const,
  },

  // Hypotheses
  hypotheses: {
    all: ["hypotheses"] as const,
    byPage: (pageId: string) =>
      [...queryKeys.hypotheses.all, "page", pageId] as const,
  },

  // Account members
  accountMembers: {
    all: ["accountMembers"] as const,
    list: (account_id: string) =>
      [...queryKeys.accountMembers.all, "list", account_id] as const,
  },

  // Organization invite links
  inviteLinks: {
    all: ["inviteLinks"] as const,
    list: (organization_id: string) =>
      [...queryKeys.inviteLinks.all, "list", organization_id] as const,
  },

  // Teams
  teams: {
    all: ["teams"] as const,
    byOrg: (orgId: string) => [...queryKeys.teams.all, "org", orgId] as const,
    members: (teamId: string) =>
      [...queryKeys.teams.all, teamId, "members"] as const,
  },

  // Permission groups
  groups: {
    all: ["groups"] as const,
    list: () => [...queryKeys.groups.all, "list"] as const,
    detail: (id: string) => [...queryKeys.groups.all, id] as const,
    members: (id: string) => [...queryKeys.groups.all, id, "members"] as const,
    policies: (id: string) =>
      [...queryKeys.groups.all, id, "policies"] as const,
  },

  // Favorites
  favorites: {
    all: ["favorites"] as const,
    list: () => [...queryKeys.favorites.all, "list"] as const,
  },

  // Research chats
  researchChats: {
    all: ["researchChats"] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.researchChats.all, "list", filters] as const,
  },

  // Subscriptions
  subscriptions: {
    all: ["subscriptions"] as const,
    plans: () => [...queryKeys.subscriptions.all, "plans"] as const,
    organization: (organization_id: string) =>
      [...queryKeys.subscriptions.all, "organization", organization_id] as const,
  },

  // Sharing
  sharing: {
    all: ["sharing"] as const,
    resource: (resourceType: string, resourceId: string) =>
      [...queryKeys.sharing.all, "resource", resourceType, resourceId] as const,
    summary: (resourceType: string, resourceId: string) =>
      [...queryKeys.sharing.all, "summary", resourceType, resourceId] as const,
  },
  // Plugins / Packs
  plugins: {
    all: ["plugins"] as const,
    marketplace: (filters?: Record<string, unknown>) =>
      [...queryKeys.plugins.all, "marketplace", filters] as const,
    detail: (slug: string) => [...queryKeys.plugins.all, "detail", slug] as const,
    installed: () => [...queryKeys.plugins.all, "installed"] as const,
    versions: (pluginId: string) =>
      [...queryKeys.plugins.all, pluginId, "versions"] as const,
    reviews: (pluginId: string) =>
      [...queryKeys.plugins.all, pluginId, "reviews"] as const,
  },

  // Matter intake loop — communication threads, intake jobs, document
  // families (matter-intake-loop spec § 4, slice 6).
  matterIntake: {
    all: ["matterIntake"] as const,
    inbox: () => [...queryKeys.matterIntake.all, "inbox"] as const,
    // The Communications activity's combined explorer feed — every thread
    // in the workspace, one no-filter request.
    allThreads: () => [...queryKeys.matterIntake.all, "all_threads"] as const,
    thread: (threadId: string) =>
      [...queryKeys.matterIntake.all, "thread", threadId] as const,
    threadsForMatter: (workItemId: string) =>
      [...queryKeys.matterIntake.all, "matter_threads", workItemId] as const,
    communications: (threadId: string) =>
      [...queryKeys.matterIntake.all, "communications", threadId] as const,
    communicationAttachments: (communicationId: string) =>
      [...queryKeys.matterIntake.all, "comm_attachments", communicationId] as const,
    threadAttachments: (threadId: string) =>
      [...queryKeys.matterIntake.all, "thread_attachments", threadId] as const,
    threadFindings: (threadId: string) =>
      [...queryKeys.matterIntake.all, "thread_findings", threadId] as const,
    clientTokens: (threadId: string) =>
      [...queryKeys.matterIntake.all, "client_tokens", threadId] as const,
    job: (jobId: string) =>
      [...queryKeys.matterIntake.all, "job", jobId] as const,
    latestJobForThread: (threadId: string) =>
      [...queryKeys.matterIntake.all, "latest_job", threadId] as const,
    documentFamilies: (workItemId: string) =>
      [...queryKeys.matterIntake.all, "doc_families", workItemId] as const,
  },

  // Public client chat (anonymous, token-scoped) — `/m/[token]`.
  publicMatterChat: {
    all: ["publicMatterChat"] as const,
    thread: (token: string) =>
      [...queryKeys.publicMatterChat.all, "thread", token] as const,
  },

  // Morning digest (ambient-digest arc)
  digest: {
    all: ["digest"] as const,
    latest: () => [...queryKeys.digest.all, "latest"] as const,
  },

  // Sales (workspace template scope)
  sales: {
    all: ["sales"] as const,
    workflows: (workspaceId: string) =>
      [...queryKeys.sales.all, "workflows", workspaceId] as const,
    workflowStates: (workflowId: string) =>
      [...queryKeys.sales.all, "workflow", workflowId, "states"] as const,
    workItemTypes: (workspaceId: string) =>
      [...queryKeys.sales.all, "work_item_types", workspaceId] as const,
    attributeDefinitions: (workItemTypeId: string) =>
      [
        ...queryKeys.sales.all,
        "attribute_definitions",
        workItemTypeId,
      ] as const,
    attributeValues: (workItemId: string) =>
      [...queryKeys.sales.all, "attribute_values", workItemId] as const,
    childItems: (parentId: string) =>
      [...queryKeys.sales.all, "children", parentId] as const,
  },
} as const;
