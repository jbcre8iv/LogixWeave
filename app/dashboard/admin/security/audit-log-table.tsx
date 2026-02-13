"use client";

import { Badge } from "@/components/ui/badge";

interface AuditEntry {
  id: string;
  admin_email: string;
  action: string;
  target_id: string | null;
  target_email: string | null;
  created_at: string;
}

const actionLabels: Record<string, string> = {
  user_deleted: "Deleted user",
  user_disabled: "Disabled user",
  user_enabled: "Enabled user",
  ip_unblocked: "Unblocked IP",
};

export function AuditLogTable({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">No audit log entries.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="pb-2 pr-4 font-medium">Time</th>
            <th className="pb-2 pr-4 font-medium">Admin</th>
            <th className="pb-2 pr-4 font-medium">Action</th>
            <th className="pb-2 font-medium">Target</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id} className="border-b last:border-0">
              <td className="py-2 pr-4 whitespace-nowrap text-muted-foreground">
                {new Date(entry.created_at).toLocaleString()}
              </td>
              <td className="py-2 pr-4 text-xs">{entry.admin_email}</td>
              <td className="py-2 pr-4">
                <Badge variant="outline">
                  {actionLabels[entry.action] || entry.action}
                </Badge>
              </td>
              <td className="py-2 text-xs font-mono">
                {entry.target_email || entry.target_id || "--"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
