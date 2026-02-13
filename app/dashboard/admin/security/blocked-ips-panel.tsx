"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

interface BlockedIp {
  ip: string;
  expiresAt: number;
  reason: string;
}

export function BlockedIpsPanel() {
  const [blockedIps, setBlockedIps] = useState<BlockedIp[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchBlockedIps() {
    try {
      const res = await fetch("/api/admin/security?type=blocked-ips");
      if (res.ok) {
        const data = await res.json();
        setBlockedIps(data.blockedIps || []);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchBlockedIps();
  }, []);

  async function handleUnblock(ip: string) {
    try {
      const res = await fetch("/api/admin/security", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unblock-ip", ip }),
      });
      if (res.ok) {
        setBlockedIps((prev) => prev.filter((b) => b.ip !== ip));
      }
    } catch {
      // Silently fail
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground py-4">Loading...</p>;
  }

  if (blockedIps.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">No IPs currently blocked.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="pb-2 pr-4 font-medium">IP Address</th>
            <th className="pb-2 pr-4 font-medium">Expires</th>
            <th className="pb-2 pr-4 font-medium">Reason</th>
            <th className="pb-2 font-medium">Action</th>
          </tr>
        </thead>
        <tbody>
          {blockedIps.map((entry) => (
            <tr key={entry.ip} className="border-b last:border-0">
              <td className="py-2 pr-4 font-mono text-xs">{entry.ip}</td>
              <td className="py-2 pr-4 text-muted-foreground whitespace-nowrap">
                {new Date(entry.expiresAt).toLocaleString()}
              </td>
              <td className="py-2 pr-4 text-xs max-w-xs truncate">{entry.reason}</td>
              <td className="py-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleUnblock(entry.ip)}
                >
                  Unblock
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
