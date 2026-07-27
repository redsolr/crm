"use server";

import { workos, clientId } from "@/lib/workos";
import { saveSession } from "@workos-inc/authkit-nextjs";

export async function createAccount(
  formData: FormData,
): Promise<{ error?: string }> {
  const email = formData.get("email") as string;
  const fullName = formData.get("fullName") as string;
  const password = formData.get("password") as string;

  if (!email || !fullName || !password) {
    return { error: "All fields are required" };
  }

  const [firstName, ...rest] = fullName.trim().split(" ");
  const lastName = rest.join(" ") || undefined;

  try {
    // Create the user in WorkOS
    await workos.userManagement.createUser({
      email,
      password,
      firstName,
      lastName,
    });

    // Authenticate immediately after creation
    const authResponse = await workos.userManagement.authenticateWithPassword({
      clientId,
      email,
      password,
    });

    // Save session cookie
    await saveSession(authResponse, "/signup");

    return {};
  } catch (err: unknown) {
    console.error("[auth/signup] failed to create account", err);
    const message =
      err instanceof Error ? err.message : "Account creation failed";

    if (message.includes("already exists") || message.includes("duplicate")) {
      return { error: "An account with this email already exists" };
    }
    if (message.includes("password")) {
      return { error: "Password does not meet requirements" };
    }

    return { error: "Something went wrong. Please try again." };
  }
}
