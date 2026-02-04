import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { Logo } from "@/components/ui/logo";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <Link href="/" className="mb-8">
        <Logo size="md" />
      </Link>
      <LoginForm />
    </div>
  );
}
