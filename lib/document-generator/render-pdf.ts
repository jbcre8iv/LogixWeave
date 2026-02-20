import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { addPdfBranding } from "@/lib/pdf-branding";
import { getTimestampSuffix } from "@/lib/utils";
import type {
  ManualDocument,
  CoverContent,
  TocContent,
  NarrativeContent,
  TasksContent,
  ProgramsContent,
  TagDatabaseContent,
  CrossReferenceContent,
  ProjectHealthContent,
} from "./types";

const PAGE_MARGIN = 20;
const TOP_MARGIN = 25; // Extra clearance below the LogixWeave logo (logo occupies ~y6–y18)
const CONTENT_WIDTH = 170; // 210mm - 2*20mm
const LINE_HEIGHT = 6;

/**
 * Render a ManualDocument to PDF and trigger download.
 */
export async function renderPdf(document: ManualDocument): Promise<void> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = TOP_MARGIN;

  const FOOTER_RESERVE = 35; // Reserve 35mm at bottom for page number + branding

  const checkPageBreak = (needed: number) => {
    if (y + needed > pageHeight - FOOTER_RESERVE) {
      doc.addPage();
      y = TOP_MARGIN;
    }
  };

  const addHeading = (text: string, level: 1 | 2 | 3) => {
    const sizes = { 1: 18, 2: 13, 3: 11 };
    const spacing = { 1: 10, 2: 7, 3: 5 };
    checkPageBreak(spacing[level] + 10);
    y += spacing[level];
    doc.setFontSize(sizes[level]);
    doc.setFont("helvetica", "bold");
    doc.text(text, PAGE_MARGIN, y);
    y += sizes[level] * 0.45 + 2;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
  };

  const addParagraph = (text: string) => {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(text, CONTENT_WIDTH);
    for (const line of lines) {
      checkPageBreak(LINE_HEIGHT);
      doc.text(line, PAGE_MARGIN, y);
      y += LINE_HEIGHT;
    }
    y += 2;
  };

  const addTable = (headers: string[], rows: string[][]) => {
    if (rows.length === 0) return;
    checkPageBreak(20);
    autoTable(doc, {
      startY: y,
      head: [headers],
      body: rows,
      margin: { top: TOP_MARGIN, left: PAGE_MARGIN, right: PAGE_MARGIN, bottom: FOOTER_RESERVE },
      styles: { fontSize: 8, cellPadding: 2, overflow: "linebreak" },
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 247, 250] },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 5;
  };

  // Track section start pages for TOC
  const sectionStartPages = new Map<string, number>();
  let tocPageNum = 0;
  let tocEntries: TocContent["entries"] = [];

  // Render each section
  for (const section of document.sections) {
    const content = section.content;

    switch (content.type) {
      case "cover": {
        const c = content as CoverContent;
        y = pageHeight * 0.3;
        doc.setFontSize(28);
        doc.setFont("helvetica", "bold");
        const titleLines = doc.splitTextToSize(c.projectName, CONTENT_WIDTH);
        for (const line of titleLines) {
          doc.text(line, pageWidth / 2, y, { align: "center" });
          y += 12;
        }
        y += 5;
        doc.setFontSize(16);
        doc.setFont("helvetica", "normal");
        doc.text("Project Manual", pageWidth / 2, y, { align: "center" });
        y += 10;
        doc.setFontSize(10);
        doc.setTextColor(120, 120, 120);
        doc.text("Complete as-built documentation, analysis, and health assessment", pageWidth / 2, y, { align: "center" });
        doc.setTextColor(0, 0, 0);
        y += 15;
        doc.setFontSize(11);
        const date = new Date(c.generatedDate).toLocaleDateString();
        if (c.processorType) {
          doc.text(`Processor: ${c.processorType}`, pageWidth / 2, y, { align: "center" });
          y += 7;
        }
        if (c.softwareRevision) {
          doc.text(`Software Revision: ${c.softwareRevision}`, pageWidth / 2, y, { align: "center" });
          y += 7;
        }
        doc.text(`Generated: ${date}`, pageWidth / 2, y, { align: "center" });
        doc.addPage();
        y = TOP_MARGIN;
        break;
      }

      case "toc": {
        // Reserve a blank page — we'll render the TOC after all content is laid out
        const c = content as TocContent;
        tocPageNum = doc.getNumberOfPages();
        tocEntries = c.entries;
        doc.addPage();
        y = TOP_MARGIN;
        break;
      }

      case "narrative": {
        const c = content as NarrativeContent;
        addHeading(section.title, 1);
        sectionStartPages.set(section.id, doc.getNumberOfPages());
        if (c.narrative) addParagraph(c.narrative);
        const labels: Record<string, string> = {
          programs: "Programs", routines: "Routines", tags: "Tags",
          ioModules: "I/O Modules", udts: "User-Defined Types", aois: "Add-On Instructions",
          tasks: "Tasks", rungs: "Rungs", taskTypes: "Task Types",
        };
        addTable(
          ["Metric", "Count"],
          Object.entries(c.stats).map(([key, value]) => [labels[key] || key, value.toString()])
        );
        break;
      }

      case "tasks": {
        const c = content as TasksContent;
        addHeading("System Architecture", 1);
        sectionStartPages.set(section.id, doc.getNumberOfPages());
        if (c.narrative) addParagraph(c.narrative);
        if (c.tasks.length > 0) {
          addHeading("Task Configuration", 2);
          addTable(
            ["Task Name", "Type", "Rate (ms)", "Priority", "Watchdog (ms)"],
            c.tasks.map((t) => [t.name, t.type, t.rate?.toString() ?? "-", t.priority.toString(), t.watchdog?.toString() ?? "-"])
          );
          addHeading("Program Execution Order", 2);
          for (const task of c.tasks) {
            if (task.scheduledPrograms.length > 0) {
              addParagraph(`${task.name} (${task.type}): ${task.scheduledPrograms.join(" \u2192 ")}`);
            }
          }
        } else {
          addParagraph("No tasks defined in this project.");
        }
        break;
      }

      case "io":
        addHeading("I/O Configuration", 1);
        sectionStartPages.set(section.id, doc.getNumberOfPages());
        if (content.modules.length > 0) {
          addTable(
            ["Module Name", "Catalog Number", "Parent Module", "Slot"],
            content.modules.map((m) => [m.name, m.catalogNumber || "-", m.parentModule || "-", m.slot?.toString() ?? "-"])
          );
        } else {
          addParagraph("No I/O modules found in this project.");
        }
        break;

      case "programs": {
        const c = content as ProgramsContent;
        addHeading("Programs & Routines", 1);
        sectionStartPages.set(section.id, doc.getNumberOfPages());
        for (const program of c.programs) {
          addHeading(program.name, 2);
          if (program.narrative) addParagraph(program.narrative);
          addTable(
            ["Routine", "Type", "Rungs", "Description"],
            program.routines.map((r) => [r.name, r.type, r.rungCount?.toString() ?? "-", r.description || r.summary || "-"])
          );
          const summarized = program.routines.filter((r) => r.summary);
          if (summarized.length > 0) {
            addHeading("Routine Summaries", 3);
            for (const r of summarized) {
              addParagraph(`${r.name}: ${r.summary}`);
            }
          }
        }
        break;
      }

      case "tagDatabase": {
        const c = content as TagDatabaseContent;
        addHeading("Tag Database", 1);
        sectionStartPages.set(section.id, doc.getNumberOfPages());
        if (c.controllerTags.length > 0) {
          addHeading("Controller-Scoped Tags", 2);
          addTable(
            ["Name", "Data Type", "Description", "Usage", "Radix"],
            c.controllerTags.map((t) => [t.name, t.dataType, t.description || "-", t.usage || "-", t.radix || "-"])
          );
        }
        for (const group of c.programTags) {
          addHeading(`${group.programName} Tags`, 2);
          addTable(
            ["Name", "Data Type", "Description", "Usage", "Radix"],
            group.tags.map((t) => [t.name, t.dataType, t.description || "-", t.usage || "-", t.radix || "-"])
          );
        }
        if (c.aliasTags.length > 0) {
          addHeading("Alias Tags", 2);
          addTable(
            ["Alias Name", "Points To", "Data Type", "Description"],
            c.aliasTags.map((t) => [t.name, t.aliasFor, t.dataType, t.description || "-"])
          );
        }
        break;
      }

      case "udts":
        addHeading("User-Defined Types", 1);
        sectionStartPages.set(section.id, doc.getNumberOfPages());
        if (content.udts.length > 0) {
          for (const udt of content.udts) {
            addHeading(udt.name, 2);
            if (udt.description) addParagraph(udt.description);
            if (udt.familyType) addParagraph(`Family: ${udt.familyType}`);
            if (udt.members.length > 0) {
              addTable(
                ["Member", "Data Type", "Description"],
                udt.members.map((m) => [m.name, m.dataType, m.description || "-"])
              );
            }
          }
        } else {
          addParagraph("No user-defined types found in this project.");
        }
        break;

      case "aois":
        addHeading("Add-On Instructions", 1);
        sectionStartPages.set(section.id, doc.getNumberOfPages());
        if (content.aois.length > 0) {
          for (const aoi of content.aois) {
            addHeading(aoi.name, 2);
            if (aoi.description) addParagraph(aoi.description);
            if (aoi.revision) addParagraph(`Revision: ${aoi.revision}`);
            if (aoi.vendor) addParagraph(`Vendor: ${aoi.vendor}`);
            if (aoi.parameters.length > 0) {
              addHeading("Parameters", 3);
              addTable(
                ["Parameter", "Data Type", "Usage", "Description"],
                aoi.parameters.map((p) => [p.name, p.dataType, p.usage, p.description || "-"])
              );
            }
            if (aoi.localTags.length > 0) {
              addHeading("Local Tags", 3);
              addTable(
                ["Name", "Data Type", "Description"],
                aoi.localTags.map((t) => [t.name, t.dataType, t.description || "-"])
              );
            }
          }
        } else {
          addParagraph("No add-on instructions found in this project.");
        }
        break;

      case "crossReference": {
        const c = content as CrossReferenceContent;
        addHeading("Cross-Reference Summary", 1);
        sectionStartPages.set(section.id, doc.getNumberOfPages());
        if (c.topTags.length > 0) {
          addHeading("Most Referenced Tags", 2);
          addTable(
            ["Tag Name", "Total Refs", "Read", "Write", "R/W", "Programs"],
            c.topTags.map((t) => [t.name, t.totalReferences.toString(), t.readCount.toString(), t.writeCount.toString(), t.bothCount.toString(), t.programsUsedIn.join(", ")])
          );
        }
        if (c.multiProgramTags.length > 0) {
          addHeading("Tags Across Multiple Programs", 2);
          addTable(
            ["Tag Name", "Programs"],
            c.multiProgramTags.slice(0, 30).map((t) => [t.name, t.programs.join(", ")])
          );
        }
        break;
      }

      case "projectHealth": {
        const c = content as ProjectHealthContent;
        addHeading("Project Health", 1);
        sectionStartPages.set(section.id, doc.getNumberOfPages());

        // Health score breakdown
        const hs = c.healthScore;
        addHeading("Health Score", 2);
        addParagraph(`Overall Score: ${hs.overall}/100`);
        const scoreRows: string[][] = [
          ["Tag Efficiency", `${hs.tagEfficiency}/100`],
          ["Documentation", `${hs.documentation}/100`],
          ["Tag Usage", `${hs.tagUsage}/100`],
        ];
        if (hs.taskConfig !== undefined) {
          scoreRows.push(["Task Configuration", `${hs.taskConfig}/100`]);
        }
        addTable(["Metric", "Score"], scoreRows);

        // Findings
        if (c.findings.length > 0) {
          addHeading("Findings", 2);
          const severityLabel: Record<string, string> = { error: "CRITICAL", warning: "WARNING", info: "OK" };
          for (const finding of c.findings) {
            addHeading(`[${severityLabel[finding.severity]}] ${finding.category}`, 3);
            addParagraph(finding.title);
            addParagraph(finding.description);
            if (finding.items && finding.items.length > 0) {
              for (const item of finding.items) {
                addParagraph(`  \u2022 ${item}`);
              }
            }
          }
        }

        // Comment coverage
        if (c.commentCoverage.length > 0) {
          addHeading("Comment Coverage by Routine", 2);
          addTable(
            ["Program", "Routine", "Commented", "Total", "Coverage"],
            c.commentCoverage.map((e) => [e.programName, e.routineName, e.commented.toString(), e.total.toString(), `${e.coverage}%`])
          );
        }

        // Unused tags
        if (c.unusedTags.length > 0) {
          addHeading("Unused Tags", 2);
          addTable(
            ["Name", "Data Type", "Scope"],
            c.unusedTags.map((t) => [t.name, t.dataType, t.scope])
          );
        }
        break;
      }
    }
  }

  // Render TOC on reserved page with section page numbers
  if (tocPageNum > 0 && tocEntries.length > 0) {
    doc.setPage(tocPageNum);
    let tocY = TOP_MARGIN + 10;
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Table of Contents", PAGE_MARGIN, tocY);
    tocY += 12;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    for (let i = 0; i < tocEntries.length; i++) {
      const entry = tocEntries[i];
      const actualPage = sectionStartPages.get(entry.sectionId);
      const displayPage = actualPage ? actualPage - 1 : 0; // cover = page 1, content page numbers start at 2
      const title = `${i + 1}. ${entry.title}`;
      const pageRef = `${displayPage}`;

      doc.text(title, PAGE_MARGIN, tocY);
      doc.setTextColor(120, 120, 120);
      doc.text(pageRef, pageWidth - PAGE_MARGIN, tocY, { align: "right" });
      doc.setTextColor(0, 0, 0);
      tocY += 8;
    }
  }

  // Branding and page numbers
  await addPdfBranding(doc);
  addPageNumbers(doc);

  const safeName = document.metadata.projectName.replace(/[^a-zA-Z0-9]/g, "_");
  doc.save(`${safeName}_Manual_${getTimestampSuffix()}.pdf`);
}

function addPageNumbers(doc: jsPDF) {
  const totalPages = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let i = 2; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150, 150, 150);
    // Place page number above the branding line (branding is at pageHeight - 10)
    doc.text(`Page ${i - 1} of ${totalPages - 1}`, pageWidth - PAGE_MARGIN, pageHeight - 18, { align: "right" });
    doc.setTextColor(0, 0, 0);
  }
}
