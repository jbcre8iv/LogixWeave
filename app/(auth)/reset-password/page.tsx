import Link from "next/link";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Logo } from "@/components/ui/logo";

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex flex-col items-center bg-background p-4 pt-8 sm:justify-center sm:pt-4">
      <Link href="/" className="mb-6">
        <Logo size="md" />
      </Link>
      <ResetPasswordForm />
    </div>
  );
}
