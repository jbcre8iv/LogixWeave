import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileForm } from "@/components/settings/profile-form";
import { AvatarUpload } from "@/components/settings/avatar-upload";
import { Badge } from "@/components/ui/badge";
import { FolderOpen, FileText, Calendar, Building2 } from "lucide-react";
import { getDisplayName } from "@/lib/utils/display-name";

export default async function ProfilePage() {
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

  // Get user stats
  const { count: projectCount } = await supabase
    .from("projects")
    .select("*", { count: "exact", head: true })
    .eq("created_by", user?.id);

  const { count: sharedWithMeCount } = await supabase
    .from("project_shares")
    .select("*", { count: "exact", head: true })
    .eq("shared_with_user_id", user?.id)
    .not("accepted_at", "is", null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Profile</h1>
        <p className="text-muted-foreground text-sm md:text-base">
          View and manage your profile information
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Profile Card */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>Update your profile details</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-6 mb-6">
              <AvatarUpload
                avatarUrl={profile?.avatar_url || null}
                fullName={getDisplayName({
                  first_name: profile?.first_name,
                  last_name: profile?.last_name,
                  full_name: profile?.full_name,
                  email: user?.email,
                })}
                email={user?.email || ""}
              />
              <div className="space-y-1">
                <h3 className="text-xl font-semibold">
                  {getDisplayName({
                    first_name: profile?.first_name,
                    last_name: profile?.last_name,
                    full_name: profile?.full_name,
                  }) || "No name set"}
                </h3>
                <p className="text-muted-foreground">{user?.email}</p>
                {membership && (
                  <Badge variant="secondary" className="mt-2">
                    <Building2 className="h-3 w-3 mr-1" />
                    {(membership.organizations as unknown as { name: string })?.name}
                  </Badge>
                )}
              </div>
            </div>
            <ProfileForm
              firstName={profile?.first_name || null}
              lastName={profile?.last_name || null}
              email={user?.email || ""}
            />
          </CardContent>
        </Card>

        {/* Stats Card */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <FolderOpen className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{projectCount || 0}</p>
                  <p className="text-xs text-muted-foreground">Projects created</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                  <FileText className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{sharedWithMeCount || 0}</p>
                  <p className="text-xs text-muted-foreground">Shared with me</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Account Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Member since</span>
              </div>
              <p className="text-sm font-medium">
                {profile?.created_at
                  ? new Date(profile.created_at).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "Unknown"}
              </p>
              {membership && (
                <>
                  <div className="flex items-center gap-2 text-sm pt-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Role</span>
                  </div>
                  <p className="text-sm font-medium capitalize">{membership.role}</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
