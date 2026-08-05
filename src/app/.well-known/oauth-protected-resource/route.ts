/**
 * Bare-path variant of the RFC 9728 metadata — some MCP clients fetch
 * `/.well-known/oauth-protected-resource` without the resource path
 * suffix. Same document as the /mcp-suffixed route.
 */

export { GET, OPTIONS } from "./mcp/route";
