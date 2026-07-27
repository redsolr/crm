"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { FieldError } from "@/components/auth/FieldError";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { sendPasswordReset } from "./actions";

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    const emailValue = formData.get("email") as string;
    if (!emailValue) {
      setError("Email is required");
      return;
    }
    setError("");
    setEmail(emailValue);
    startTransition(async () => {
      const result = await sendPasswordReset(formData);
      if (result.error) {
        setError(result.error);
      } else {
        setSent(true);
      }
    });
  }

  if (sent) {
    return (
      <>
        <h1 className="text-ctx-primary text-[26px] font-bold mb-3">
          Check your email
        </h1>
        <p className="text-ctx-body text-[14px] leading-relaxed mb-4">
          If <strong className="text-ctx-primary">{email}</strong> matches an
          email address we have on file, we&apos;ve sent you an email with a
          link to reset your password.
        </p>
        <p className="text-ctx-body text-[14px] leading-relaxed mb-6">
          If you haven&apos;t received the email in 5 minutes, check your spam
          folder,{" "}
          <button
            onClick={() => setSent(false)}
            className="text-ctx-purple font-semibold underline"
          >
            resend
          </button>
          , or{" "}
          <button
            onClick={() => {
              setSent(false);
              setEmail("");
            }}
            className="text-ctx-purple font-semibold underline"
          >
            try a different email address
          </button>
          .
        </p>
        <div className="text-center">
          <Link
            href="/login"
            className="text-ctx-purple text-[14px] font-semibold"
          >
            Return to login
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <h1 className="text-ctx-primary text-[26px] font-bold mb-3">
        Reset your password
      </h1>
      <p className="text-ctx-body text-[14px] leading-relaxed mb-8">
        Enter the email address associated with your account and we&apos;ll send
        you a link to reset your password.
      </p>

      <form action={handleSubmit} className="space-y-4">
        <div>
          <label className="ctx-label">Email</label>
          <input
            name="email"
            type="text"
            className={`ctx-input ${error ? "ctx-input-error" : ""}`}
            data-testid="forgot-email-input"
          />
          {error && <FieldError message={error} />}
        </div>

        <SubmitButton
          isPending={isPending}
          label="Continue"
          pendingLabel="Sending..."
        />
      </form>

      <div className="mt-6 text-center">
        <Link
          href="/login"
          className="text-ctx-purple text-[14px] font-semibold"
        >
          Return to login
        </Link>
      </div>
    </>
  );
}
