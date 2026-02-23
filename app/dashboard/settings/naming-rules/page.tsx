import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
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
        <h1 className="text-2xl sm:text-3xl font-bold">Naming Rules</h1>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No team found. Please create or join a team first.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isAdmin = membership.role === "owner" || membership.role === "admin";

  // Get rule sets with their nested rules
  const { data: ruleSets } = await supabase
    .from("naming_rule_sets")
    .select("*, naming_rules(*)")
    .eq("organization_id", membership.organization_id)
    .order("is_default", { ascending: false })
    .order("name");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Naming Rules</h1>
        <p className="text-muted-foreground">
          Organize rules into named sets that can be assigned per-project. The default set is used when a project has no specific assignment.
        </p>
      </div>

      <NamingRulesManager ruleSets={ruleSets || []} isAdmin={isAdmin} />
    </div>
  );
}
