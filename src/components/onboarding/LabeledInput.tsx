"use client";

import { IconCheckCircle } from "@/components/icons";

interface LabeledInputProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  maxLength?: number;
  autoFocus?: boolean;
  className?: string;
  hint?: string;
  /** Show a green check when the value passes validation (default: non-empty after trim) */
  showValid?: boolean;
  /** Custom validator — return true if value is valid. Defaults to `value.trim().length > 0` */
  isValid?: (value: string) => boolean;
}

export function LabeledInput({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  autoFocus,
  className,
  hint,
  showValid = false,
  isValid,
}: LabeledInputProps) {
  const valid = showValid && (isValid ? isValid(value) : value.trim().length > 0);

  return (
    <div>
      <label className="ctx-label">{label}</label>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          autoFocus={autoFocus}
          className={`ctx-input ${showValid ? "pr-10" : ""} ${className ?? ""}`}
        />
        {valid && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500">
            <IconCheckCircle className="w-5 h-5" />
          </span>
        )}
      </div>
      {hint && <p className="mt-1 text-xs text-ctx-muted">{hint}</p>}
    </div>
  );
}
