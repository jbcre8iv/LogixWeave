"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import * as XLSX from "xlsx";

export interface ExportSheet {
  name: string;
  data: string[][];
}

interface ExportXLSXButtonProps {
  sheets: ExportSheet[];
  filename: string;
}

export function ExportXLSXButton({ sheets, filename }: ExportXLSXButtonProps) {
  const handleExport = () => {
    const workbook = XLSX.utils.book_new();

    for (const sheet of sheets) {
      const worksheet = XLSX.utils.aoa_to_sheet(sheet.data);
      XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
    }

    XLSX.writeFile(workbook, filename);
  };

  return (
    <Button variant="outline" size="sm" onClick={handleExport}>
      <Download className="mr-2 h-4 w-4" />
      Export XLSX
    </Button>
  );
}
