import { Suspense } from "react";
import { CompleteSignupForm } from "./CompleteSignupForm";

export default function CompleteSignupPage() {
  return (
    <Suspense>
      <CompleteSignupForm />
    </Suspense>
  );
}
