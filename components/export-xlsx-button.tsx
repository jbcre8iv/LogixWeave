"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, ChevronDown, FileSpreadsheet, FileText, FileImage } from "lucide-react";
import * as XLSX from "xlsx";
import { getTimestampSuffix } from "@/lib/utils";
import { useState } from "react";

export interface ExportSheet {
  name: string;
  data: string[][];
}

interface ExportXLSXButtonProps {
  sheets: ExportSheet[];
  filename: string;
  pdfTargetId?: string;
  pdfFilename?: string;
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

export function ExportXLSXButton({ sheets, filename, pdfTargetId, pdfFilename }: ExportXLSXButtonProps) {
  const [exporting, setExporting] = useState(false);
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

  const handleExportPDF = async () => {
    if (!pdfTargetId) return;
    const target = document.getElementById(pdfTargetId);
    if (!target) return;

    setExporting(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");
      const { addPdfBranding } = await import("@/lib/pdf-branding");

      const canvas = await html2canvas(target, {
        scale: 2,
        useCORS: true,
        backgroundColor: null,
      });

      const imgData = canvas.toDataURL("image/png");
      const doc = new jsPDF({ orientation: "landscape", format: "letter", unit: "mm" });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;
      const topMargin = 22; // space for logo branding
      const bottomMargin = 18; // space for footer branding
      const availableWidth = pageWidth - margin * 2;
      const availableHeight = pageHeight - topMargin - bottomMargin;

      const imgAspect = canvas.width / canvas.height;
      let imgWidth = availableWidth;
      let imgHeight = imgWidth / imgAspect;

      if (imgHeight > availableHeight) {
        imgHeight = availableHeight;
        imgWidth = imgHeight * imgAspect;
      }

      const x = (pageWidth - imgWidth) / 2;
      const y = topMargin + (availableHeight - imgHeight) / 2;
      doc.addImage(imgData, "PNG", x, y, imgWidth, imgHeight);

      await addPdfBranding(doc);

      const pdfBase = (pdfFilename || baseFilename).replace(/\.[^.]+$/, "");
      doc.save(`${pdfBase}_${getTimestampSuffix()}.pdf`);
    } finally {
      setExporting(false);
    }
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
        {pdfTargetId && (
          <DropdownMenuItem onClick={handleExportPDF} disabled={exporting}>
            <FileImage className="mr-2 h-4 w-4" />
            {exporting ? "Exporting..." : "Export as PDF"}
            <span className="ml-2 text-xs text-muted-foreground">Snapshot</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
