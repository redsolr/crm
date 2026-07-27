"use server";

import { workos, clientId } from "@/lib/workos";
import { saveSession } from "@workos-inc/authkit-nextjs";

export async function completeSignup(
  formData: FormData,
): Promise<{ error?: string }> {
  const email = formData.get("email") as string;
  const fullName = (formData.get("fullName") as string) || "";
  const password = formData.get("password") as string;

  if (!password) {
    return { error: "Password is required" };
  }

  const [firstName, ...rest] = fullName.trim().split(" ");
  const lastName = rest.join(" ") || undefined;

  try {
    // Update user with password and name
    // Find the user by email first
    const { data: users } = await workos.userManagement.listUsers({
      email,
    });

    if (users.length === 0) {
      return { error: "Account not found" };
    }

    const user = users[0];

    // Update user details
    await workos.userManagement.updateUser({
      userId: user.id,
      firstName: firstName || undefined,
      lastName,
      password,
    });

    // Authenticate with the new password
    const authResponse = await workos.userManagement.authenticateWithPassword({
      clientId,
      email,
      password,
    });

    await saveSession(authResponse, "/complete-signup");

    return {};
  } catch (err: unknown) {
    console.error("[auth/complete-signup] failed to complete signup", err);
    const message =
      err instanceof Error ? err.message : "Failed to complete signup";
    if (message.includes("password")) {
      return { error: "Password does not meet requirements" };
    }
    return { error: "Something went wrong. Please try again." };
  }
}
