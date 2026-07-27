"use client";

interface SubmitButtonProps {
  isPending: boolean;
  label: string;
  pendingLabel: string;
  className?: string;
  onClick?: () => void;
  type?: "submit" | "button";
  "data-testid"?: string;
}

export function SubmitButton({
  isPending,
  label,
  pendingLabel,
  className = "",
  onClick,
  type = "submit",
  "data-testid": testId,
}: SubmitButtonProps) {
  return (
    <button
      type={type}
      disabled={isPending}
      onClick={onClick}
      className={`auth-submit-btn landing-gradient-btn w-full py-3.5 text-white font-semibold text-[15px] rounded-full transition-all cursor-pointer disabled:opacity-60 ${className}`}
      data-testid={testId}
    >
      {isPending ? pendingLabel : label}
    </button>
  );
}
