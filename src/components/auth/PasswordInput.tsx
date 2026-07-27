"use client";

import { useState } from "react";
import { FieldError } from "./FieldError";

interface PasswordInputProps {
  name?: string;
  label?: string;
  showStrength?: boolean;
  error?: string;
  onChange?: () => void;
  testId?: string;
  rightLabel?: React.ReactNode;
}

type Strength = "too-weak" | "weak" | "fair" | "strong";

function getStrength(password: string): {
  level: Strength;
  label: string;
  color: string;
  bars: number;
} {
  if (!password) return { level: "too-weak", label: "", color: "", bars: 0 };

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 10) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (password.length >= 14) score++;

  if (score <= 1)
    return { level: "too-weak", label: "Too weak", color: "#e53e3e", bars: 1 };
  if (score <= 2)
    return { level: "weak", label: "Weak", color: "#e53e3e", bars: 1 };
  if (score <= 3)
    return { level: "fair", label: "Fair", color: "#d69e2e", bars: 2 };
  return { level: "strong", label: "Strong", color: "#38a169", bars: 3 };
}

function getHint(password: string): string | null {
  if (!password) return null;
  if (password.length < 10) {
    return "Your password needs to be at least 10 characters. Use multiple words and phrases to make it more secure.";
  }
  if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return "Add uppercase letters and numbers to make your password stronger.";
  }
  return null;
}

const BAR_INACTIVE = "#e3e8ee";

export function PasswordInput({
  name = "password",
  label = "Password",
  showStrength = false,
  error,
  onChange,
  testId = "password-input",
  rightLabel,
}: PasswordInputProps) {
  const [value, setValue] = useState("");
  const [visible, setVisible] = useState(false);

  const strength = showStrength ? getStrength(value) : null;
  const hint = showStrength ? getHint(value) : null;
  const hasError = !!error;

  return (
    <div>
      {/* Label row */}
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-ctx-primary text-[13px] font-semibold">
          {label}
        </label>
        {showStrength && strength && strength.label ? (
          <span
            className="text-[13px] font-semibold"
            style={{ color: strength.color }}
          >
            {strength.label}
          </span>
        ) : (
          rightLabel || null
        )}
      </div>

      {/* Input with toggle */}
      <div className="relative">
        <input
          name={name}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            onChange?.();
          }}
          className={`ctx-input w-full pl-4 pr-10 py-2.5 rounded-lg text-[15px] focus:ring-2 focus:ring-[#FF385C]/20 ${hasError ? "ctx-input-error" : ""}`}
          data-testid={testId}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="text-ctx-muted absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
          tabIndex={-1}
          data-testid={`${testId}-toggle`}
        >
          {visible ? (
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              viewBox="0 0 24 24"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
              <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
              <path d="M14.12 14.12a3 3 0 11-4.24-4.24" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          ) : (
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              viewBox="0 0 24 24"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>

      {/* Strength bars */}
      {showStrength && value.length > 0 && strength && (
        <div
          className="flex gap-1 mt-2"
          data-testid={`${testId}-strength-bars`}
        >
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-[3px] flex-1 rounded-full transition-colors"
              style={{
                background: i <= strength.bars ? strength.color : BAR_INACTIVE,
              }}
            />
          ))}
        </div>
      )}

      {/* Strength hint */}
      {showStrength && value.length > 0 && hint && (
        <p
          className="flex items-start gap-1.5 mt-1.5 text-[13px] font-semibold"
          style={{ color: strength?.color }}
        >
          <svg
            className="w-3.5 h-3.5 shrink-0 mt-0.5"
            viewBox="0 0 16 16"
            fill="currentColor"
          >
            <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm-.75 3.75a.75.75 0 011.5 0v4a.75.75 0 01-1.5 0v-4zM8 12a1 1 0 110-2 1 1 0 010 2z" />
          </svg>
          {hint}
        </p>
      )}

      {/* External error */}
      {error && <FieldError message={error} />}
    </div>
  );
}
