import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ProfileForm } from "@/components/settings/profile-form";
import { SignOutButton } from "@/components/settings/sign-out-button";
import { ChangePasswordForm } from "@/components/settings/change-password-form";
import { AILanguageSelector } from "@/components/settings/ai-language-selector";
import { Sparkles, ScrollText, ChevronRight } from "lucide-react";
import Link from "next/link";

export default async function SettingsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user?.id)
    .single();

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role, organizations(name)")
    .eq("user_id", user?.id)
    .single();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm md:text-base">
          Manage your account and preferences
        </p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Your personal information</CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileForm
              firstName={profile?.first_name || null}
              lastName={profile?.last_name || null}
              email={user?.email || ""}
              role={(user?.user_metadata?.role as string) || null}
            />
            <div className="mt-4 pt-4 border-t">
              <Label className="text-muted-foreground">Member since</Label>
              <p className="text-sm mt-1">
                {profile?.created_at
                  ? new Date(profile.created_at).toLocaleDateString()
                  : "Unknown"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              AI Preferences
            </CardTitle>
            <CardDescription>Customize your AI experience</CardDescription>
          </CardHeader>
          <CardContent>
            <AILanguageSelector currentLanguage={profile?.ai_language || "en"} />
          </CardContent>
        </Card>

        <Link href="/dashboard/settings/naming-rules" className="block group">
          <Card className="transition-colors hover:bg-accent/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ScrollText className="h-5 w-5 text-primary" />
                    Naming Rules
                  </CardTitle>
                  <CardDescription className="mt-1.5">
                    Configure tag naming conventions for your organization
                  </CardDescription>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
              </div>
            </CardHeader>
          </Card>
        </Link>

        {/* Organization section hidden for now - uncomment when team features are needed
        {membership && (
          <Card>
            <CardHeader>
              <CardTitle>Organization</CardTitle>
              <CardDescription>Your workspace details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-muted-foreground">Organization Name</Label>
                <p className="text-sm mt-1">
                  {(membership.organizations as unknown as { name: string })?.name || "Unknown"}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">Role</Label>
                <p className="text-sm mt-1 capitalize">{membership.role}</p>
              </div>
            </CardContent>
          </Card>
        )}
        */}

        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Manage your account</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ChangePasswordForm />
            <div className="border-t pt-4">
              <SignOutButton />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
