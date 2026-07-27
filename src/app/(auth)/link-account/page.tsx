import { Suspense } from "react";
import { LinkAccountForm } from "./LinkAccountForm";

export default function LinkAccountPage() {
  return (
    <Suspense>
      <LinkAccountForm />
    </Suspense>
  );
}
