import Link from "next/link";
import { SignupForm } from "@/components/auth/signup-form";
import { Logo } from "@/components/ui/logo";

export default function SignupPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <Link href="/" className="mb-8">
        <Logo size="md" />
      </Link>
      <SignupForm />
    </div>
  );
}
