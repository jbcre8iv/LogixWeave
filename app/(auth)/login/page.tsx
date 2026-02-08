import { Suspense } from "react";
import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { Logo } from "@/components/ui/logo";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center bg-background p-4 pt-8 sm:justify-center sm:pt-4">
      <Link href="/" className="mb-6">
        <Logo size="md" />
      </Link>
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
