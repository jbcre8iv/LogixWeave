import Link from "next/link";
import { SignupForm } from "@/components/auth/signup-form";
import { Logo } from "@/components/ui/logo";

export default function SignupPage() {
  return (
    <div className="min-h-screen flex flex-col items-center bg-background p-4 pt-8 sm:justify-center sm:pt-4">
      <Link href="/" className="mb-6">
        <Logo size="md" />
      </Link>
      <SignupForm />
    </div>
  );
}
