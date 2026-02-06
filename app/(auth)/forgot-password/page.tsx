import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { Logo } from "@/components/ui/logo";

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex flex-col items-center bg-background p-4 pt-8 sm:justify-center sm:pt-4">
      <Link href="/" className="mb-6">
        <Logo size="md" />
      </Link>
      <ForgotPasswordForm />
    </div>
  );
}
