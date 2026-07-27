"use client";

import { LoginCard } from "@/components/auth/LoginCard";
import { emailPasswordLogin } from "./actions";

export default function LoginPage() {
  return <LoginCard login={emailPasswordLogin} redirectTo="/sales" />;
}
