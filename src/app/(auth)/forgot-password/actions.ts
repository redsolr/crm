"use server";

import { workos } from "@/lib/workos";

export async function sendPasswordReset(
  formData: FormData,
): Promise<{ error?: string }> {
  const email = formData.get("email") as string;

  if (!email) {
    return { error: "Email is required" };
  }

  try {
    await workos.userManagement.createPasswordReset({
      email,
    });
    return {};
  } catch (err) {
    // Always show success to avoid email enumeration — but log for ops debugging.
    console.warn(
      "[auth/forgot-password] non-critical: createPasswordReset failed (response intentionally hidden to prevent enumeration)",
      err,
    );
    return {};
  }
}
