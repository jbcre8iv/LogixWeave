"use client";

import { Badge } from "@/components/ui/badge";

interface SecurityEvent {
  id: string;
  event_type: string;
  severity: string;
  ip_address: string | null;
  user_email: string | null;
  description: string;
  created_at: string;
}

const severityColors: Record<string, string> = {
  low: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  critical: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

export function SecurityEventsTable({ events }: { events: SecurityEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">No security events recorded.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="pb-2 pr-4 font-medium">Time</th>
            <th className="pb-2 pr-4 font-medium">Severity</th>
            <th className="pb-2 pr-4 font-medium">Type</th>
            <th className="pb-2 pr-4 font-medium">IP</th>
            <th className="pb-2 pr-4 font-medium">User</th>
            <th className="pb-2 font-medium">Description</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.id} className="border-b last:border-0">
              <td className="py-2 pr-4 whitespace-nowrap text-muted-foreground">
                {new Date(event.created_at).toLocaleString()}
              </td>
              <td className="py-2 pr-4">
                <Badge variant="secondary" className={severityColors[event.severity] || ""}>
                  {event.severity}
                </Badge>
              </td>
              <td className="py-2 pr-4 whitespace-nowrap font-mono text-xs">
                {event.event_type}
              </td>
              <td className="py-2 pr-4 font-mono text-xs">
                {event.ip_address || "--"}
              </td>
              <td className="py-2 pr-4 text-xs">
                {event.user_email || "--"}
              </td>
              <td className="py-2 text-xs max-w-xs truncate">
                {event.description}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
