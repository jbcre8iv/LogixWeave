export interface PartialExportInfo {
  hasPartialExports: boolean;
  allPartial: boolean;
  fileBreakdown: { controller: number; program: number; routine: number };
  partialFiles: Array<{ targetType: string; targetName: string | null }>;
}

/**
 * Analyzes an array of project files to determine whether any are partial exports
 * (Program- or Routine-level). Null target_type (old files, L5K) is treated as
 * non-partial to avoid false positives.
 */
export function analyzeExportTypes(
  files: Array<{ target_type: string | null; target_name: string | null }>
): PartialExportInfo {
  const breakdown = { controller: 0, program: 0, routine: 0 };
  const partialFiles: PartialExportInfo["partialFiles"] = [];

  for (const file of files) {
    const tt = file.target_type?.toLowerCase() ?? null;
    if (tt === "program") {
      breakdown.program++;
      partialFiles.push({ targetType: "Program", targetName: file.target_name });
    } else if (tt === "routine") {
      breakdown.routine++;
      partialFiles.push({ targetType: "Routine", targetName: file.target_name });
    } else {
      // null, "controller", or anything else counts as controller (full export)
      breakdown.controller++;
    }
  }

  const hasPartialExports = partialFiles.length > 0;
  const allPartial = hasPartialExports && breakdown.controller === 0;

  return { hasPartialExports, allPartial, fileBreakdown: breakdown, partialFiles };
}
