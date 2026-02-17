"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, ChevronDown, FileSpreadsheet, FileText } from "lucide-react";
import * as XLSX from "xlsx";
import { getTimestampSuffix } from "@/lib/utils";

export interface ExportSheet {
  name: string;
  data: string[][];
}

interface ExportXLSXButtonProps {
  sheets: ExportSheet[];
  filename: string;
}

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function ExportXLSXButton({ sheets, filename }: ExportXLSXButtonProps) {
  const baseFilename = filename.replace(/\.[^.]+$/, "");

  const handleExportXLSX = () => {
    const workbook = XLSX.utils.book_new();
    for (const sheet of sheets) {
      const worksheet = XLSX.utils.aoa_to_sheet(sheet.data);
      XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
    }
    XLSX.writeFile(workbook, `${baseFilename}_${getTimestampSuffix()}.xlsx`);
  };

  const handleExportCSV = () => {
    const rows: string[][] = [];
    for (const sheet of sheets) {
      rows.push([`=== ${sheet.name.toUpperCase()} ===`]);
      rows.push(...sheet.data);
      rows.push([]);
    }
    const csvContent = rows.map((row) => row.map(escapeCSV).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    downloadBlob(blob, `${baseFilename}_${getTimestampSuffix()}.csv`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="mr-2 h-4 w-4" />
          Export
          <ChevronDown className="ml-2 h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleExportXLSX}>
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Export as XLSX
          <span className="ml-2 text-xs text-muted-foreground">Multi-sheet</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportCSV}>
          <FileText className="mr-2 h-4 w-4" />
          Export as CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
