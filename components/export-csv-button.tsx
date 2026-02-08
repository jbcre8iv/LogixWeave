"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

interface ExportCSVButtonProps {
  data: string[][];
  filename: string;
}

export function ExportCSVButton({ data, filename }: ExportCSVButtonProps) {
  const handleExport = () => {
    const csvContent = data
      .map((row) => row.map(escapeCSV).join(","))
      .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Button variant="outline" size="sm" onClick={handleExport}>
      <Download className="mr-2 h-4 w-4" />
      Export CSV
    </Button>
  );
}
