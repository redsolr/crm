import { ReactNode } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div data-app="">
      <ProtectedRoute>{children}</ProtectedRoute>
    </div>
  );
}
