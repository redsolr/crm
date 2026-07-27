"use client";

import { useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { FieldError } from "@/components/auth/FieldError";
import { confirmLinkAccount } from "./actions";

export function LinkAccountForm() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const provider = searchParams.get("provider") || "Google";

  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError("");
    startTransition(async () => {
      const result = await confirmLinkAccount(formData);
      if (result.error) {
        setError(result.error);
      } else {
        window.location.href = "/sales";
      }
    });
  }

  return (
    <>
      <h1 className="text-ctx-primary text-[24px] font-bold mb-4 leading-snug">
        Confirm your credentials to link your {provider} account
      </h1>
      <p className="text-ctx-body text-[14px] leading-relaxed mb-8">
        Your {provider} account{" "}
        <strong className="text-ctx-primary">{email}</strong> matches an
        existing Jurisimus account.
      </p>

      <form action={handleSubmit} className="space-y-4">
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="provider" value={provider} />

        <div>
          <label className="ctx-label">Confirm password</label>
          <input
            name="password"
            type="password"
            autoFocus
            className={`ctx-input ${error ? "ctx-input-error" : ""}`}
            data-testid="link-password-input"
          />
          {error && <FieldError message={error} />}
        </div>

        <div className="flex items-center justify-between pt-2">
          <Link
            href="/login"
            className="text-ctx-purple text-[14px] font-semibold"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isPending}
            className="landing-gradient-btn px-8 py-2.5 text-white font-semibold text-[14px] rounded-full transition-all cursor-pointer disabled:opacity-60"
            data-testid="link-submit"
          >
            {isPending ? "Linking..." : "Continue"}
          </button>
        </div>
      </form>
    </>
  );
}
