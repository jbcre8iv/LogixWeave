"use client";

import { useState, useEffect, useCallback } from "react";
import Script from "next/script";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Eye, EyeOff, Mail } from "lucide-react";

const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

declare global {
  interface Window {
    onTurnstileSuccess?: (token: string) => void;
  }
}

export function SignupForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  const handleToken = useCallback((token: string) => {
    setCaptchaToken(token);
  }, []);

  useEffect(() => {
    window.onTurnstileSuccess = handleToken;
    return () => {
      delete window.onTurnstileSuccess;
    };
  }, [handleToken]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (turnstileSiteKey && !captchaToken) {
      setError("Please complete the verification challenge.");
      return;
    }

    setIsLoading(true);
    setError(null);

    const supabase = createClient();
    const fullName = `${firstName} ${lastName}`.trim();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          first_name: firstName,
          last_name: lastName,
          ...(role && { role }),
        },
        ...(captchaToken && { captchaToken }),
      },
    });

    if (error) {
      setError(error.message);
      setIsLoading(false);
      setCaptchaToken(null);
      return;
    }

    setEmailSent(true);
    setIsLoading(false);
  };

  if (emailSent) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-2">
            <Mail className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Check your email</CardTitle>
          <CardDescription>
            We sent a verification link to <strong>{email}</strong>. Click the link in the email to verify your account.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex flex-col space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            Didn&apos;t receive the email? Check your spam folder or{" "}
            <Link href="/login" className="text-primary hover:underline">
              try signing in
            </Link>
          </p>
        </CardFooter>
      </Card>
    );
  }

  return (
    <>
      {turnstileSiteKey && (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
          async
          defer
        />
      )}
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Create an account</CardTitle>
          <CardDescription>
            Enter your information to get started with LogixWeave
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSignup}>
          <CardContent className="space-y-4">
            {error && (
              <div className="bg-destructive/15 text-destructive text-sm p-3 rounded-md">
                {error}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  type="text"
                  placeholder="John"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  type="text"
                  placeholder="Doe"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Select value={role} onValueChange={setRole} disabled={isLoading}>
                <SelectTrigger id="role" className="w-full">
                  <SelectValue placeholder="Select your role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Controls Engineer">Controls Engineer</SelectItem>
                  <SelectItem value="Electrical Engineer">Electrical Engineer</SelectItem>
                  <SelectItem value="Maintenance Technician">Maintenance Technician</SelectItem>
                  <SelectItem value="Project Manager">Project Manager</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  disabled={isLoading}
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onMouseDown={() => setShowPassword(true)}
                  onMouseUp={() => setShowPassword(false)}
                  onMouseLeave={() => setShowPassword(false)}
                  onTouchStart={() => setShowPassword(true)}
                  onTouchEnd={() => setShowPassword(false)}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <Eye className="h-4 w-4" />
                  ) : (
                    <EyeOff className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            {turnstileSiteKey && (
              <div className="flex justify-center">
                <div
                  className="cf-turnstile"
                  data-sitekey={turnstileSiteKey}
                  data-callback="onTurnstileSuccess"
                />
              </div>
            )}
          </CardContent>
          <div className="px-6 pb-6" />
          <CardFooter className="flex flex-col space-y-4">
            <p className="text-xs text-muted-foreground text-center">
              By signing up, you agree to our{" "}
              <Link href="/legal" className="text-primary hover:underline">
                Terms & Privacy
              </Link>
            </p>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create account
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              Already have an account?{" "}
              <Link href="/login" className="text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </>
  );
}
