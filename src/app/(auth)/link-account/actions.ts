"use server";

import { workos, clientId } from "@/lib/workos";
import { saveSession } from "@workos-inc/authkit-nextjs";

export async function confirmLinkAccount(
  formData: FormData,
): Promise<{ error?: string }> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!password) {
    return { error: "Password is required" };
  }

  try {
    // Verify credentials by authenticating
    const authResponse = await workos.userManagement.authenticateWithPassword({
      clientId,
      email,
      password,
    });

    // Save session
    await saveSession(authResponse, "/link-account");

    return {};
  } catch (err) {
    console.error("[auth/link-account] failed to authenticate with password", err);
    return { error: "Incorrect password. Please try again." };
  }
}
