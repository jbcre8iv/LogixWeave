import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and preferences
        </p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
            <CardDescription>Your account details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Email</label>
              <p className="text-sm">{user?.email}</p>
            </div>
            {profile?.full_name && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Name</label>
                <p className="text-sm">{profile.full_name}</p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-muted-foreground">Member since</label>
              <p className="text-sm">
                {profile?.created_at
                  ? new Date(profile.created_at).toLocaleDateString()
                  : "Unknown"}
              </p>
            </div>
          </CardContent>
        </Card>

        {membership && (
          <Card>
            <CardHeader>
              <CardTitle>Organization</CardTitle>
              <CardDescription>Your workspace details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Organization Name
                </label>
                <p className="text-sm">
                  {(membership.organizations as unknown as { name: string })?.name || "Unknown"}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Role</label>
                <p className="text-sm capitalize">{membership.role}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
