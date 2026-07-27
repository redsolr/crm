"use client";

import { useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { completeSignup } from "./actions";

export function CompleteSignupForm() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const name = searchParams.get("name") || "";

  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ password?: string }>({});
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    const password = formData.get("password") as string;
    if (!password) {
      setFieldErrors({ password: "Password is required" });
      return;
    }
    if (password.length < 8) {
      setFieldErrors({ password: "Password must be at least 8 characters" });
      return;
    }

    setFieldErrors({});
    setError("");
    startTransition(async () => {
      const result = await completeSignup(formData);
      if (result.error) {
        setError(result.error);
      } else {
        window.location.href = "/sales";
      }
    });
  }

  return (
    <>
      <h1 className="text-ctx-primary text-[26px] font-bold mb-8 leading-snug">
        Finish creating your account
      </h1>

      <form action={handleSubmit} className="space-y-4">
        <input type="hidden" name="email" value={email} />

        <div>
          <label className="ctx-label">Email</label>
          <input
            type="text"
            value={email}
            readOnly
            className="ctx-input bg-ctx-soft text-ctx-muted"
          />
        </div>

        <div>
          <label className="ctx-label">Full name</label>
          <input
            name="fullName"
            type="text"
            defaultValue={name}
            className="ctx-input"
          />
        </div>

        <PasswordInput
          name="password"
          label="Create backup password"
          showStrength
          error={fieldErrors.password || error || undefined}
          onChange={() => {
            setFieldErrors({});
            setError("");
          }}
          testId="complete-password-input"
        />

        <SubmitButton
          isPending={isPending}
          label="Create account"
          pendingLabel="Creating account..."
          data-testid="complete-submit"
        />
      </form>
    </>
  );
}
