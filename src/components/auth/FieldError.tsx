interface FieldErrorProps {
  message: string;
  testId?: string;
}

export function FieldError({ message, testId }: FieldErrorProps) {
  return (
    <p
      className="field-error flex items-center gap-1.5 mt-1.5 text-[13px] font-semibold"
      style={{ color: "#e53e3e" }}
      data-testid={testId}
    >
      <svg
        className="w-3.5 h-3.5 shrink-0"
        viewBox="0 0 16 16"
        fill="currentColor"
      >
        <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm-.75 3.75a.75.75 0 011.5 0v4a.75.75 0 01-1.5 0v-4zM8 12a1 1 0 110-2 1 1 0 010 2z" />
      </svg>
      {message}
    </p>
  );
}
