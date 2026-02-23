import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, Activity, Ban, ClipboardList } from "lucide-react";
import Link from "next/link";
import { SecurityEventsTable } from "./security-events-table";
import { BlockedIpsPanel } from "./blocked-ips-panel";
import { AuditLogTable } from "./audit-log-table";

export default async function SecurityDashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_platform_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_platform_admin) redirect("/dashboard");

  const serviceSupabase = createServiceClient();
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [totalResult, highCriticalResult, recentEventsResult, auditResult] = await Promise.all([
    serviceSupabase
      .from("security_events")
      .select("id", { count: "exact", head: true })
      .gte("created_at", twentyFourHoursAgo),
    serviceSupabase
      .from("security_events")
      .select("id", { count: "exact", head: true })
      .gte("created_at", twentyFourHoursAgo)
      .in("severity", ["high", "critical"]),
    serviceSupabase
      .from("security_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50),
    serviceSupabase
      .from("admin_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const totalEvents = totalResult.count || 0;
  const highCriticalCount = highCriticalResult.count || 0;
  const recentEvents = recentEventsResult.data || [];
  const auditEntries = auditResult.data || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-primary" />
            <h1 className="text-2xl sm:text-3xl font-bold">Security Dashboard</h1>
          </div>
          <p className="text-muted-foreground">
            Monitor security events and manage threat response
          </p>
        </div>
        <Link href="/dashboard/admin">
          <Badge variant="outline" className="cursor-pointer hover:bg-accent">
            Back to Admin
          </Badge>
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Events (24h)</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              <Activity className="h-6 w-6 text-muted-foreground" />
              {totalEvents}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>High/Critical (24h)</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              <ShieldAlert className="h-6 w-6 text-destructive" />
              <span className={highCriticalCount > 0 ? "text-destructive" : ""}>
                {highCriticalCount}
              </span>
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Blocked IPs</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              <Ban className="h-6 w-6 text-muted-foreground" />
              <BlockedIpsCount />
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Security Events Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Security Events</CardTitle>
          <CardDescription>Last 50 events across all severity levels</CardDescription>
        </CardHeader>
        <CardContent>
          <SecurityEventsTable events={recentEvents} />
        </CardContent>
      </Card>

      {/* Blocked IPs */}
      <Card>
        <CardHeader>
          <CardTitle>Blocked IPs</CardTitle>
          <CardDescription>Currently auto-blocked IP addresses</CardDescription>
        </CardHeader>
        <CardContent>
          <BlockedIpsPanel />
        </CardContent>
      </Card>

      {/* Admin Audit Log */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Admin Audit Log
          </CardTitle>
          <CardDescription>Recent administrative actions</CardDescription>
        </CardHeader>
        <CardContent>
          <AuditLogTable entries={auditEntries} />
        </CardContent>
      </Card>
    </div>
  );
}

function BlockedIpsCount() {
  // This renders on the server - blocked IPs are in-memory on the server
  // For a client-fetched count, we'd use the API. Here we show "0" as default
  // since in-memory state is per-instance. The panel below fetches via API.
  return <span>--</span>;
}
