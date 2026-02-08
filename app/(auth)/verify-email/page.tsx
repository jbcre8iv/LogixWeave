"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Loader2 } from "lucide-react";

export default function VerifyEmailPage() {
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  const handleResend = async () => {
    setIsResending(true);
    setResendMessage(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.email) {
      setResendMessage("Unable to resend. Please try signing up again.");
      setIsResending(false);
      return;
    }

    const { error } = await supabase.auth.resend({
      type: "signup",
      email: user.email,
    });

    if (error) {
      setResendMessage(error.message);
    } else {
      setResendMessage("Verification email sent! Check your inbox.");
    }

    setIsResending(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center bg-background p-4 pt-8 sm:justify-center sm:pt-4">
      <Link href="/" className="mb-6">
        <Logo size="md" />
      </Link>
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-2">
            <Mail className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Verify your email</CardTitle>
          <CardDescription>
            We sent a verification link to your email address. Click the link to activate your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {resendMessage && (
            <div className="bg-muted text-sm p-3 rounded-md text-center">
              {resendMessage}
            </div>
          )}
          <Button
            variant="outline"
            className="w-full"
            onClick={handleResend}
            disabled={isResending}
          >
            {isResending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Resend verification email
          </Button>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Link href="/login" className="text-sm text-primary hover:underline">
            Back to login
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
