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
