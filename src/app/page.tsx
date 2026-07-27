import { redirect } from "next/navigation";

/**
 * Deliberately dumb landing (ADR-001): crm-web is an internal tool with
 * no marketing surface. "/" goes straight to the pipeline; ProtectedRoute
 * in the (app) layout bounces unauthenticated visitors to /login.
 */
export default function Home() {
  redirect("/sales");
}
