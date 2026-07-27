export function AuthDivider() {
  return (
    <div className="auth-divider relative my-6">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t border-ctx-line" />
      </div>
      <div className="relative flex justify-center text-xs">
        <span className="text-ctx-muted px-3 bg-white uppercase tracking-wider font-medium">
          or
        </span>
      </div>
    </div>
  );
}
