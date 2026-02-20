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
  QualityMetricsContent,
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

export function buildQualityMetricsSection(data: ProjectData): ManualSection {
  // Find unused tags (no references)
  const referencedTags = new Set(data.tagReferences.map((r) => r.tag_name));
  const unusedTags = data.tags
    .filter((t) => !referencedTags.has(t.name) && !t.alias_for)
    .map((t) => ({ name: t.name, dataType: t.data_type, scope: t.scope }));

  // Comment coverage per routine
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

  const content: QualityMetricsContent = {
    type: "qualityMetrics",
    unusedTagCount: unusedTags.length,
    unusedTags: unusedTags.slice(0, 100), // Limit for document size
    commentCoverage,
    overallCommentCoverage,
  };
  return { id: "qualityMetrics", title: "Quality Metrics", content };
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

  if (config.sections.qualityMetrics) {
    sections.push(buildQualityMetricsSection(data));
  }

  // Insert TOC after cover (or at the beginning)
  const tocIndex = sections.findIndex((s) => s.id === "cover") + 1;
  sections.splice(tocIndex, 0, buildTocSection(sections));

  return sections;
}
