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
 * The AI's own identity for writes it performs (Ask panel tool calls
 * and the /mcp agent door). Machine writes must be visibly
 * machine-attributed in timelines and `created_by` — never blended
 * into a human actor.
 */
export const AGENT_ACTOR_ID = "agent_claude";
export const AGENT_ACTOR_NAME = "Claude (agent)";
