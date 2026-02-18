import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { logSecurityEvent } from "@/lib/security/monitor";
import { getClientIp } from "@/lib/security/get-client-ip";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    // Verify current user is platform admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("is_platform_admin")
      .eq("id", user.id)
      .single();

    if (!adminProfile?.is_platform_admin) {
      logSecurityEvent({
        eventType: "unauthorized_access",
        severity: "high",
        ip: getClientIp(request),
        userId: user.id,
        userEmail: user.email,
        description: "Non-admin attempted GET on admin analytics endpoint",
      });
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    // Use service client to access auth admin API
    const serviceSupabase = await createServiceClient();
    const { data: { users }, error } = await serviceSupabase.auth.admin.listUsers();

    if (error) {
      return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
    }

    // Aggregate role distribution from user metadata
    const roleCounts = new Map<string, number>();

    for (const u of users) {
      const role = u.user_metadata?.role;
      const label = typeof role === "string" && role.trim() !== "" ? role.trim() : "Not specified";
      roleCounts.set(label, (roleCounts.get(label) || 0) + 1);
    }

    const roleDistribution = Array.from(roleCounts.entries())
      .map(([role, count]) => ({ role, count }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({ roleDistribution, totalUsers: users.length });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
