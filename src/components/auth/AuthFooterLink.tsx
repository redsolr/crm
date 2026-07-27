import Link from "next/link";

interface AuthFooterLinkProps {
  text: string;
  linkText: string;
  href: string;
}

export function AuthFooterLink({ text, linkText, href }: AuthFooterLinkProps) {
  return (
    <div className="auth-footer-link bg-ctx-soft mt-6 text-center rounded-xl py-3.5">
      <span className="text-ctx-body text-[14px]">
        {text}{" "}
        <Link href={href} className="text-ctx-purple font-semibold">
          {linkText}
        </Link>
      </span>
    </div>
  );
}
