/**
 * Single-tenant stubs for the standalone CRM backend (strangler swap).
 *
 * The platform modeled the CRM as one `sales-pipeline`-templated
 * workspace per product; standalone there is exactly ONE universe, so
 * the workspace is a static constant rather than a table. The
 * workspaces family (swap step 3) serves it verbatim; records stamp it
 * so wire shapes stay identical for the untouched frontend.
 */
export const CRM_WORKSPACE_ID = "ws_crm";

/** Placeholder actor until standalone WorkOS auth lands (swap step 6). */
export const LOCAL_ACTOR_ID = "usr_local";

/**
 * Machine identities for agent writes — visibly machine-attributed in
 * timelines and `created_by`, never blended into a human actor. TWO
 * distinct agents exist (founder 2026-08-02): the `/mcp` door is
 * Claude (the founder's coding/ops tool), while the in-app Ask panel
 * is the GPT-powered assistant end users touch. Timelines name
 * whichever actually wrote.
 */
export const MCP_AGENT_ACTOR = {
  id: "agent_claude",
  name: "Claude (agent)",
} as const;

export const ASK_AGENT_ACTOR = {
  id: "agent_ask",
  name: "Ask assistant",
} as const;
