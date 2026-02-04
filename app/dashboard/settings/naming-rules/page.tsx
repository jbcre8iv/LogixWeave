import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NamingRulesManager } from "@/components/tools/naming-rules-manager";

export default async function NamingRulesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // Get user's organization and role
  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Naming Rules</h1>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No organization found. Please create or join an organization first.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isAdmin = membership.role === "owner" || membership.role === "admin";

  // Get existing naming rules
  const { data: rules } = await supabase
    .from("naming_rules")
    .select("*")
    .eq("organization_id", membership.organization_id)
    .order("name");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Naming Rules</h1>
        <p className="text-muted-foreground">
          Configure tag naming conventions for your organization
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tag Naming Convention Rules</CardTitle>
          <CardDescription>
            Define regex patterns to validate tag names across all projects.
            These rules help maintain consistent naming conventions in your PLC programs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NamingRulesManager rules={rules || []} isAdmin={isAdmin} />
        </CardContent>
      </Card>
    </div>
  );
}
