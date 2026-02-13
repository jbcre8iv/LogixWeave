import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { unblockIp, getBlockedIps } from "@/lib/security/ip-blocklist";
import { logAdminAction } from "@/lib/audit";

async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_platform_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_platform_admin) return null;
  return user;
}

// GET: Fetch security events, blocked IPs, audit logs
export async function GET(request: Request) {
  try {
    const user = await verifyAdmin();
    if (!user) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "events";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "50", 10);
    const severity = searchParams.get("severity");

    const supabase = createServiceClient();

    if (type === "blocked-ips") {
      return NextResponse.json({ blockedIps: getBlockedIps() });
    }

    if (type === "audit") {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, count, error } = await supabase
        .from("admin_audit_log")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ data, totalCount: count || 0 });
    }

    if (type === "summary") {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const [totalResult, highCriticalResult] = await Promise.all([
        supabase
          .from("security_events")
          .select("id", { count: "exact", head: true })
          .gte("created_at", twentyFourHoursAgo),
        supabase
          .from("security_events")
          .select("id", { count: "exact", head: true })
          .gte("created_at", twentyFourHoursAgo)
          .in("severity", ["high", "critical"]),
      ]);

      return NextResponse.json({
        totalEvents24h: totalResult.count || 0,
        highCriticalCount: highCriticalResult.count || 0,
        blockedIpsCount: getBlockedIps().length,
      });
    }

    // Default: security events
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from("security_events")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (severity) {
      query = query.eq("severity", severity);
    }

    query = query.range(from, to);

    const { data, count, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data, totalCount: count || 0 });
  } catch (error) {
    console.error("Security API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST: Unblock an IP address
export async function POST(request: Request) {
  try {
    const user = await verifyAdmin();
    if (!user) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { action, ip } = await request.json();

    if (action === "unblock-ip" && ip) {
      const removed = unblockIp(ip);

      logAdminAction({
        adminId: user.id,
        adminEmail: user.email || "",
        action: "ip_unblocked",
        metadata: { ip, wasBlocked: removed },
      });

      return NextResponse.json({ success: true, removed });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Security API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
