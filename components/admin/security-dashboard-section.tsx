"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldAlert, Activity, Ban, ChevronDown, ClipboardList } from "lucide-react";
import { SecurityEventsTable } from "@/app/dashboard/admin/security/security-events-table";
import { BlockedIpsPanel } from "@/app/dashboard/admin/security/blocked-ips-panel";
import { AuditLogTable } from "@/app/dashboard/admin/security/audit-log-table";

interface SummaryStats {
  totalEvents24h: number;
  highCriticalCount: number;
  blockedIpsCount: number;
}

interface SecurityEvent {
  id: string;
  event_type: string;
  severity: string;
  ip_address: string | null;
  user_email: string | null;
  description: string;
  created_at: string;
}

interface AuditEntry {
  id: string;
  admin_email: string;
  action: string;
  target_id: string | null;
  target_email: string | null;
  created_at: string;
}

export function SecurityDashboardSection() {
  const [expanded, setExpanded] = useState(false);
  const [stats, setStats] = useState<SummaryStats | null>(null);
  const [events, setEvents] = useState<SecurityEvent[] | null>(null);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[] | null>(null);
  const [detailLoaded, setDetailLoaded] = useState(false);

  // Fetch summary stats on mount
  useEffect(() => {
    fetch("/api/admin/security?type=summary")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setStats(data);
      })
      .catch(() => {});
  }, []);

  // Fetch detail data on first expand
  const loadDetails = useCallback(() => {
    if (detailLoaded) return;
    setDetailLoaded(true);

    Promise.all([
      fetch("/api/admin/security").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/admin/security?type=audit").then((r) => (r.ok ? r.json() : null)),
    ]).then(([eventsData, auditData]) => {
      if (eventsData?.data) setEvents(eventsData.data);
      if (auditData?.data) setAuditEntries(auditData.data);
    }).catch(() => {});
  }, [detailLoaded]);

  function handleToggle() {
    if (!expanded) loadDetails();
    setExpanded((prev) => !prev);
  }

  return (
    <div className="space-y-4">
      <Card
        className="cursor-pointer transition-colors hover:bg-accent/50"
        onClick={handleToggle}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-primary" />
              Security Dashboard
            </CardTitle>
            <ChevronDown
              className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${
                expanded ? "rotate-180" : ""
              }`}
            />
          </div>
          <CardDescription>
            Monitor security events, blocked IPs, and admin audit logs
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex gap-6 text-sm">
            <div className="flex items-center gap-1.5">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Events (24h):</span>
              <span className="font-semibold">
                {stats ? stats.totalEvents24h : "--"}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <ShieldAlert className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">High/Critical:</span>
              <span
                className={`font-semibold ${
                  stats && stats.highCriticalCount > 0 ? "text-destructive" : ""
                }`}
              >
                {stats ? stats.highCriticalCount : "--"}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Ban className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Blocked IPs:</span>
              <span className="font-semibold">
                {stats ? stats.blockedIpsCount : "--"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {expanded && (
        <div className="space-y-4 pl-1">
          <Card>
            <CardHeader>
              <CardTitle>Recent Security Events</CardTitle>
              <CardDescription>Last 50 events across all severity levels</CardDescription>
            </CardHeader>
            <CardContent>
              {events === null ? (
                <p className="text-sm text-muted-foreground py-4">Loading...</p>
              ) : (
                <SecurityEventsTable events={events} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Blocked IPs</CardTitle>
              <CardDescription>Currently auto-blocked IP addresses</CardDescription>
            </CardHeader>
            <CardContent>
              <BlockedIpsPanel />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                Admin Audit Log
              </CardTitle>
              <CardDescription>Recent administrative actions</CardDescription>
            </CardHeader>
            <CardContent>
              {auditEntries === null ? (
                <p className="text-sm text-muted-foreground py-4">Loading...</p>
              ) : (
                <AuditLogTable entries={auditEntries} />
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
