import type {
  ManualSection,
  ProjectData,
  CoverContent,
  TocContent,
  NarrativeContent,
  TasksContent,
  IoContent,
  ProgramsContent,
  TagDatabaseContent,
  UdtContent,
  AoiContent,
  CrossReferenceContent,
  ProjectHealthContent,
  ManualConfig,
  SectionType,
} from "./types";

export function buildCoverSection(data: ProjectData): ManualSection {
  const content: CoverContent = {
    type: "cover",
    projectName: data.projectName,
    processorType: data.metadata.processorType,
    softwareRevision: data.metadata.softwareRevision,
    exportDate: data.metadata.exportDate,
    generatedDate: new Date().toISOString(),
  };
  return { id: "cover", title: "Cover Page", content };
}

export function buildTocSection(sections: ManualSection[]): ManualSection {
  const entries = sections
    .filter((s) => s.id !== "cover" && s.id !== "toc")
    .map((s) => ({ title: s.title, sectionId: s.id }));
  const content: TocContent = { type: "toc", entries };
  return { id: "toc", title: "Table of Contents", content };
}

export function buildExecutiveSummary(data: ProjectData): ManualSection {
  const programNames = [...new Set(data.routines.map((r) => r.program_name))];
  const taskTypes = [...new Set(data.tasks.map((t) => t.type))];

  const stats: Record<string, number | string> = {
    programs: programNames.length,
    routines: data.routines.length,
    tags: data.tags.length,
    ioModules: data.modules.length,
    udts: data.udts.length,
    aois: data.aois.length,
    tasks: data.tasks.length,
    rungs: data.rungs.length,
    taskTypes: taskTypes.join(", ") || "None",
  };

  const content: NarrativeContent = { type: "narrative", stats };
  return { id: "executiveSummary", title: "Executive Summary", content };
}

export function buildSystemArchitectureSection(data: ProjectData): ManualSection {
  const tasks = data.tasks.map((t) => ({
    name: t.name,
    type: t.type,
    rate: t.rate ?? undefined,
    priority: t.priority,
    watchdog: t.watchdog ?? undefined,
    description: t.description ?? undefined,
    scheduledPrograms: t.scheduled_programs,
  }));

  const content: TasksContent = { type: "tasks", tasks };
  return { id: "systemArchitecture", title: "System Architecture", content };
}

export function buildIoSection(data: ProjectData): ManualSection {
  const modules = data.modules.map((m) => ({
    name: m.name,
    catalogNumber: m.catalog_number ?? undefined,
    parentModule: m.parent_module ?? undefined,
    slot: m.slot ?? undefined,
  }));

  const content: IoContent = { type: "io", modules };
  return { id: "ioConfiguration", title: "I/O Configuration", content };
}

export function buildProgramsSection(data: ProjectData): ManualSection {
  // Group routines by program
  const programMap = new Map<string, typeof data.routines>();
  for (const routine of data.routines) {
    const existing = programMap.get(routine.program_name) || [];
    existing.push(routine);
    programMap.set(routine.program_name, existing);
  }

  const programs = [...programMap.entries()].map(([name, routines]) => ({
    name,
    routines: routines.map((r) => ({
      name: r.name,
      type: r.type,
      rungCount: r.rung_count ?? undefined,
      description: r.description ?? undefined,
    })),
  }));

  const content: ProgramsContent = { type: "programs", programs };
  return { id: "programsRoutines", title: "Programs & Routines", content };
}

export function buildTagDatabaseSection(data: ProjectData): ManualSection {
  const controllerTags = data.tags
    .filter((t) => t.scope === "Controller" && !t.alias_for)
    .map((t) => ({
      name: t.name,
      dataType: t.data_type,
      description: t.description ?? undefined,
      usage: t.usage ?? undefined,
      radix: t.radix ?? undefined,
    }));

  // Group program-scoped tags
  const programTagMap = new Map<string, typeof controllerTags>();
  for (const tag of data.tags) {
    if (tag.scope !== "Controller" && !tag.alias_for) {
      const existing = programTagMap.get(tag.scope) || [];
      existing.push({
        name: tag.name,
        dataType: tag.data_type,
        description: tag.description ?? undefined,
        usage: tag.usage ?? undefined,
        radix: tag.radix ?? undefined,
      });
      programTagMap.set(tag.scope, existing);
    }
  }

  const programTags = [...programTagMap.entries()].map(([programName, tags]) => ({
    programName,
    tags,
  }));

  const aliasTags = data.tags
    .filter((t) => t.alias_for)
    .map((t) => ({
      name: t.name,
      aliasFor: t.alias_for!,
      dataType: t.data_type,
      description: t.description ?? undefined,
    }));

  const content: TagDatabaseContent = {
    type: "tagDatabase",
    controllerTags,
    programTags,
    aliasTags,
  };
  return { id: "tagDatabase", title: "Tag Database", content };
}

export function buildUdtsSection(data: ProjectData): ManualSection {
  const udts = data.udts.map((u) => ({
    name: u.name,
    description: u.description ?? undefined,
    familyType: u.family_type ?? undefined,
    members: (u.parsed_udt_members || []).map((m) => ({
      name: m.name,
      dataType: m.data_type,
      description: m.description ?? undefined,
    })),
  }));

  const content: UdtContent = { type: "udts", udts };
  return { id: "udts", title: "User-Defined Types", content };
}

export function buildAoisSection(data: ProjectData): ManualSection {
  const aois = data.aois.map((a) => ({
    name: a.name,
    description: a.description ?? undefined,
    revision: a.revision ?? undefined,
    vendor: a.vendor ?? undefined,
    parameters: (a.parsed_aoi_parameters || []).map((p) => ({
      name: p.name,
      dataType: p.data_type,
      usage: p.usage,
      description: p.description ?? undefined,
    })),
    localTags: (a.parsed_aoi_local_tags || []).map((t) => ({
      name: t.name,
      dataType: t.data_type,
      description: t.description ?? undefined,
    })),
  }));

  const content: AoiContent = { type: "aois", aois };
  return { id: "aois", title: "Add-On Instructions", content };
}

export function buildCrossReferenceSection(data: ProjectData): ManualSection {
  // Aggregate tag references
  const refMap = new Map<string, {
    totalReferences: number;
    readCount: number;
    writeCount: number;
    bothCount: number;
    programs: Set<string>;
  }>();

  for (const ref of data.tagReferences) {
    const existing = refMap.get(ref.tag_name) || {
      totalReferences: 0,
      readCount: 0,
      writeCount: 0,
      bothCount: 0,
      programs: new Set<string>(),
    };
    existing.totalReferences++;
    if (ref.usage_type === "read") existing.readCount++;
    else if (ref.usage_type === "write") existing.writeCount++;
    else existing.bothCount++;
    existing.programs.add(ref.program_name);
    refMap.set(ref.tag_name, existing);
  }

  // Top 20 most referenced tags
  const topTags = [...refMap.entries()]
    .sort((a, b) => b[1].totalReferences - a[1].totalReferences)
    .slice(0, 20)
    .map(([name, info]) => ({
      name,
      totalReferences: info.totalReferences,
      readCount: info.readCount,
      writeCount: info.writeCount,
      bothCount: info.bothCount,
      programsUsedIn: [...info.programs],
    }));

  // Tags referenced in multiple programs
  const multiProgramTags = [...refMap.entries()]
    .filter(([, info]) => info.programs.size > 1)
    .sort((a, b) => b[1].programs.size - a[1].programs.size)
    .map(([name, info]) => ({
      name,
      programs: [...info.programs],
    }));

  const content: CrossReferenceContent = { type: "crossReference", topTags, multiProgramTags };
  return { id: "crossReference", title: "Cross-Reference Summary", content };
}

export function buildProjectHealthSection(data: ProjectData): ManualSection {
  // --- Unused tags ---
  const referencedTags = new Set(data.tagReferences.map((r) => r.tag_name));
  const unusedTags = data.tags
    .filter((t) => !referencedTags.has(t.name) && !t.alias_for)
    .map((t) => ({ name: t.name, dataType: t.data_type, scope: t.scope }));

  // --- Comment coverage per routine ---
  const routineRungMap = new Map<string, { commented: number; total: number; programName: string }>();
  for (const rung of data.rungs) {
    const key = `${rung.program_name}/${rung.routine_name}`;
    const existing = routineRungMap.get(key) || { commented: 0, total: 0, programName: rung.program_name };
    existing.total++;
    if (rung.comment) existing.commented++;
    routineRungMap.set(key, existing);
  }

  const commentCoverage = [...routineRungMap.entries()].map(([key, info]) => {
    const routineName = key.split("/")[1];
    return {
      routineName,
      programName: info.programName,
      commented: info.commented,
      total: info.total,
      coverage: info.total > 0 ? Math.round((info.commented / info.total) * 100) : 0,
    };
  });

  const totalRungs = data.rungs.length;
  const commentedRungs = data.rungs.filter((r) => r.comment).length;
  const overallCommentCoverage = totalRungs > 0 ? Math.round((commentedRungs / totalRungs) * 100) : 0;

  // --- Health score computation (mirrors lib/health-scores.ts) ---
  const totalTags = data.tags.length;
  const tagEfficiency = totalTags > 0
    ? Math.max(0, Math.round(100 - (unusedTags.length / totalTags) * 200))
    : 100;
  const documentation = overallCommentCoverage;
  const tagUsage = totalTags > 0
    ? Math.min(100, Math.round((data.tagReferences.length / totalTags) * 20))
    : 0;

  // Task configuration score (only when tasks exist)
  let taskConfig: number | undefined;
  if (data.tasks.length > 0) {
    let score = 100;
    const emptyTasks = data.tasks.filter((t) => !t.scheduled_programs || t.scheduled_programs.length === 0);
    score -= Math.min(40, emptyTasks.length * 20);

    const scheduledProgramNames = new Set(data.tasks.flatMap((t) => t.scheduled_programs || []));
    const allProgramNames = new Set(data.routines.map((r) => r.program_name));
    const orphanedPrograms = [...allProgramNames].filter((p) => !scheduledProgramNames.has(p));
    score -= Math.min(50, orphanedPrograms.length * 25);

    const periodicTasks = data.tasks.filter((t) => t.type === "PERIODIC");
    for (const pt of periodicTasks) {
      if (pt.rate !== null && pt.rate !== undefined && (pt.rate < 1 || pt.rate > 30000)) {
        score -= 15;
      }
    }
    for (const t of data.tasks) {
      if (t.watchdog !== null && t.watchdog !== undefined && t.watchdog > 5000) {
        score -= 10;
      }
    }
    taskConfig = Math.max(0, Math.min(100, score));
  }

  // Overall score (weight model matches lib/health-scores.ts)
  let overall: number;
  if (taskConfig !== undefined) {
    overall = Math.round(tagEfficiency * 0.3 + documentation * 0.3 + tagUsage * 0.2 + taskConfig * 0.2);
  } else {
    overall = Math.round(tagEfficiency * 0.4 + documentation * 0.35 + tagUsage * 0.25);
  }

  // --- Generate findings ---
  const findings: ProjectHealthContent["findings"] = [];

  // Tag efficiency findings
  if (unusedTags.length > 0) {
    const pct = totalTags > 0 ? Math.round((unusedTags.length / totalTags) * 100) : 0;
    findings.push({
      severity: unusedTags.length > totalTags * 0.3 ? "error" : "warning",
      category: "Tag Efficiency",
      title: `${unusedTags.length} unused tag${unusedTags.length === 1 ? "" : "s"} detected (${pct}% of total)`,
      description: "Tags with no read, write, or read/write references in any routine. These may be obsolete or indicate incomplete logic.",
      items: unusedTags.slice(0, 10).map((t) => `${t.name} (${t.dataType}, ${t.scope})`),
    });
  } else {
    findings.push({
      severity: "info",
      category: "Tag Efficiency",
      title: "All tags are referenced in project logic",
      description: "No unused tags detected. Tag database is clean.",
    });
  }

  // Documentation findings
  if (overallCommentCoverage < 25) {
    findings.push({
      severity: "error",
      category: "Documentation",
      title: `Comment coverage critically low at ${overallCommentCoverage}%`,
      description: "Less than 25% of rungs have comments. This makes the project difficult to maintain and troubleshoot.",
      items: commentCoverage
        .filter((r) => r.coverage === 0 && r.total > 0)
        .slice(0, 10)
        .map((r) => `${r.programName}/${r.routineName} — 0% (${r.total} rungs)`),
    });
  } else if (overallCommentCoverage < 50) {
    findings.push({
      severity: "warning",
      category: "Documentation",
      title: `Comment coverage below target at ${overallCommentCoverage}%`,
      description: "Less than 50% of rungs have comments. Increasing coverage improves maintainability.",
      items: commentCoverage
        .filter((r) => r.coverage < 25 && r.total > 3)
        .slice(0, 10)
        .map((r) => `${r.programName}/${r.routineName} — ${r.coverage}% (${r.total} rungs)`),
    });
  } else {
    findings.push({
      severity: "info",
      category: "Documentation",
      title: `Comment coverage at ${overallCommentCoverage}%`,
      description: "Rung-level documentation meets minimum recommended threshold.",
    });
  }

  // Task configuration findings
  if (data.tasks.length > 0) {
    const emptyTasks = data.tasks.filter((t) => !t.scheduled_programs || t.scheduled_programs.length === 0);
    if (emptyTasks.length > 0) {
      findings.push({
        severity: "warning",
        category: "Task Configuration",
        title: `${emptyTasks.length} task${emptyTasks.length === 1 ? "" : "s"} with no scheduled programs`,
        description: "Tasks without scheduled programs consume scan time but execute no logic.",
        items: emptyTasks.map((t) => `${t.name} (${t.type})`),
      });
    }

    const scheduledProgramNames = new Set(data.tasks.flatMap((t) => t.scheduled_programs || []));
    const allProgramNames = new Set(data.routines.map((r) => r.program_name));
    const orphanedPrograms = [...allProgramNames].filter((p) => !scheduledProgramNames.has(p));
    if (orphanedPrograms.length > 0) {
      findings.push({
        severity: "error",
        category: "Task Configuration",
        title: `${orphanedPrograms.length} program${orphanedPrograms.length === 1 ? "" : "s"} not scheduled in any task`,
        description: "Programs not assigned to a task will never execute. This may indicate misconfiguration or orphaned code.",
        items: orphanedPrograms,
      });
    }

    for (const t of data.tasks) {
      if (t.watchdog !== null && t.watchdog !== undefined && t.watchdog > 5000) {
        findings.push({
          severity: "warning",
          category: "Task Configuration",
          title: `Task "${t.name}" has high watchdog timer (${t.watchdog}ms)`,
          description: "Watchdog timers above 5000ms may delay fault detection. Verify this is intentional for the task's scan requirements.",
        });
      }
    }

    const periodicTasks = data.tasks.filter((t) => t.type === "PERIODIC");
    for (const pt of periodicTasks) {
      if (pt.rate !== null && pt.rate !== undefined && (pt.rate < 1 || pt.rate > 30000)) {
        findings.push({
          severity: "warning",
          category: "Task Configuration",
          title: `Periodic task "${pt.name}" has unusual rate (${pt.rate}ms)`,
          description: "Periodic task rates outside 1–30000ms range may indicate a configuration error.",
        });
      }
    }
  } else {
    findings.push({
      severity: "info",
      category: "Task Configuration",
      title: "No tasks defined in project",
      description: "Task configuration scoring is not applicable. The project may use default continuous task execution.",
    });
  }

  // Tag usage findings
  if (tagUsage < 30) {
    findings.push({
      severity: "warning",
      category: "Tag Usage",
      title: "Low tag reference density",
      description: `Only ${data.tagReferences.length} cross-references found across ${totalTags} tags. This may indicate incomplete logic or a partial project export.`,
    });
  }

  const content: ProjectHealthContent = {
    type: "projectHealth",
    healthScore: {
      overall,
      tagEfficiency,
      documentation,
      tagUsage,
      ...(taskConfig !== undefined && { taskConfig }),
    },
    findings,
    unusedTagCount: unusedTags.length,
    unusedTags: unusedTags.slice(0, 100),
    commentCoverage,
    overallCommentCoverage,
  };
  return { id: "projectHealth", title: "Project Health", content };
}

/**
 * Build all structural (non-AI) sections based on config.
 */
export function buildAllSections(data: ProjectData, config: ManualConfig): ManualSection[] {
  const sections: ManualSection[] = [];

  if (config.sections.cover) {
    sections.push(buildCoverSection(data));
  }

  if (config.sections.executiveSummary) {
    sections.push(buildExecutiveSummary(data));
  }

  if (config.sections.systemArchitecture) {
    sections.push(buildSystemArchitectureSection(data));
  }

  if (config.sections.ioConfiguration) {
    sections.push(buildIoSection(data));
  }

  if (config.sections.programsRoutines) {
    sections.push(buildProgramsSection(data));
  }

  if (config.sections.tagDatabase) {
    sections.push(buildTagDatabaseSection(data));
  }

  if (config.sections.udts) {
    sections.push(buildUdtsSection(data));
  }

  if (config.sections.aois) {
    sections.push(buildAoisSection(data));
  }

  if (config.sections.crossReference) {
    sections.push(buildCrossReferenceSection(data));
  }

  if (config.sections.projectHealth) {
    sections.push(buildProjectHealthSection(data));
  }

  // Insert TOC after cover (or at the beginning)
  const tocIndex = sections.findIndex((s) => s.id === "cover") + 1;
  sections.splice(tocIndex, 0, buildTocSection(sections));

  return sections;
}
