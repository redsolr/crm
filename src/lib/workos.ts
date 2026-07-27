import { WorkOS } from "@workos-inc/node";

let _workos: WorkOS | null = null;

export function getWorkOS() {
  if (!_workos) {
    _workos = new WorkOS(process.env.WORKOS_API_KEY);
  }
  return _workos;
}

/** @deprecated Use getWorkOS() instead — kept for existing imports */
export const workos = new Proxy({} as WorkOS, {
  get(_, prop) {
    return (getWorkOS() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export const clientId = process.env.WORKOS_CLIENT_ID!;
export const redirectUri = process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI!;
