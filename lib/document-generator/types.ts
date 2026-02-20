// Project Manual Document Generator — Type definitions

export interface ManualConfig {
  sections: {
    cover: boolean;
    executiveSummary: boolean;
    systemArchitecture: boolean;
    ioConfiguration: boolean;
    programsRoutines: boolean;
    tagDatabase: boolean;
    udts: boolean;
    aois: boolean;
    crossReference: boolean;
    projectHealth: boolean;
  };
  detailLevel: "standard" | "comprehensive"; // standard = data only, comprehensive = with AI narratives
  format: "markdown" | "pdf" | "docx";
  aiLanguage?: string;
}

export type SectionType =
  | "cover"
  | "toc"
  | "executiveSummary"
  | "systemArchitecture"
  | "ioConfiguration"
  | "programsRoutines"
  | "tagDatabase"
  | "udts"
  | "aois"
  | "crossReference"
  | "projectHealth";

export interface ManualSection {
  id: SectionType;
  title: string;
  content: SectionContent;
}

// Content variants for different section types
export type SectionContent =
  | CoverContent
  | TocContent
  | NarrativeContent
  | TasksContent
  | IoContent
  | ProgramsContent
  | TagDatabaseContent
  | UdtContent
  | AoiContent
  | CrossReferenceContent
  | ProjectHealthContent;

export interface CoverContent {
  type: "cover";
  projectName: string;
  processorType?: string;
  softwareRevision?: string;
  exportDate?: string;
  generatedDate: string;
}

export interface TocContent {
  type: "toc";
  entries: Array<{ title: string; sectionId: SectionType }>;
}

export interface NarrativeContent {
  type: "narrative";
  narrative?: string; // AI-generated narrative
  stats: Record<string, number | string>;
}

export interface TasksContent {
  type: "tasks";
  narrative?: string;
  tasks: Array<{
    name: string;
    type: string;
    rate?: number;
    priority: number;
    watchdog?: number;
    description?: string;
    scheduledPrograms: string[];
  }>;
}

export interface IoContent {
  type: "io";
  modules: Array<{
    name: string;
    catalogNumber?: string;
    parentModule?: string;
    slot?: number;
  }>;
}

export interface ProgramsContent {
  type: "programs";
  programs: Array<{
    name: string;
    narrative?: string;
    routines: Array<{
      name: string;
      type: string;
      rungCount?: number;
      description?: string;
      summary?: string; // AI-generated routine summary
    }>;
  }>;
}

export interface TagDatabaseContent {
  type: "tagDatabase";
  controllerTags: Array<TagEntry>;
  programTags: Array<{
    programName: string;
    tags: Array<TagEntry>;
  }>;
  aliasTags: Array<{
    name: string;
    aliasFor: string;
    dataType: string;
    description?: string;
  }>;
}

export interface TagEntry {
  name: string;
  dataType: string;
  description?: string;
  usage?: string;
  radix?: string;
}

export interface UdtContent {
  type: "udts";
  udts: Array<{
    name: string;
    description?: string;
    familyType?: string;
    members: Array<{
      name: string;
      dataType: string;
      description?: string;
    }>;
  }>;
}

export interface AoiContent {
  type: "aois";
  aois: Array<{
    name: string;
    description?: string;
    revision?: string;
    vendor?: string;
    parameters: Array<{
      name: string;
      dataType: string;
      usage: string;
      description?: string;
    }>;
    localTags: Array<{
      name: string;
      dataType: string;
      description?: string;
    }>;
  }>;
}

export interface CrossReferenceContent {
  type: "crossReference";
  topTags: Array<{
    name: string;
    totalReferences: number;
    readCount: number;
    writeCount: number;
    bothCount: number;
    programsUsedIn: string[];
  }>;
  multiProgramTags: Array<{
    name: string;
    programs: string[];
  }>;
}

export interface ProjectHealthContent {
  type: "projectHealth";
  healthScore: {
    overall: number;
    tagEfficiency: number;
    documentation: number;
    tagUsage: number;
    taskConfig?: number;
  };
  findings: Array<{
    severity: "error" | "warning" | "info";
    category: string;
    title: string;
    description: string;
    items?: string[];
  }>;
  unusedTagCount: number;
  unusedTags: Array<{ name: string; dataType: string; scope: string }>;
  commentCoverage: Array<{
    routineName: string;
    programName: string;
    commented: number;
    total: number;
    coverage: number;
  }>;
  overallCommentCoverage: number;
}

export interface ManualDocument {
  metadata: {
    projectName: string;
    projectId: string;
    generatedAt: string;
    config: ManualConfig;
  };
  sections: ManualSection[];
}

export interface GenerationProgress {
  stage: "fetching" | "building" | "narrating" | "complete" | "error";
  message: string;
  current: number;
  total: number;
}

// Data shape returned by the data fetcher
export interface ProjectData {
  projectName: string;
  metadata: {
    processorType?: string;
    softwareRevision?: string;
    exportDate?: string;
  };
  tags: Array<{
    name: string;
    data_type: string;
    scope: string;
    description: string | null;
    usage: string | null;
    radix: string | null;
    alias_for: string | null;
  }>;
  routines: Array<{
    name: string;
    program_name: string;
    type: string;
    description: string | null;
    rung_count: number | null;
  }>;
  rungs: Array<{
    routine_name: string;
    program_name: string;
    number: number;
    content: string;
    comment: string | null;
  }>;
  modules: Array<{
    name: string;
    catalog_number: string | null;
    parent_module: string | null;
    slot: number | null;
  }>;
  udts: Array<{
    name: string;
    description: string | null;
    family_type: string | null;
    parsed_udt_members: Array<{
      name: string;
      data_type: string;
      description: string | null;
    }>;
  }>;
  aois: Array<{
    name: string;
    description: string | null;
    revision: string | null;
    vendor: string | null;
    parsed_aoi_parameters: Array<{
      name: string;
      data_type: string;
      usage: string;
      description: string | null;
    }>;
    parsed_aoi_local_tags: Array<{
      name: string;
      data_type: string;
      description: string | null;
    }>;
  }>;
  tasks: Array<{
    name: string;
    type: string;
    rate: number | null;
    priority: number;
    watchdog: number | null;
    description: string | null;
    scheduled_programs: string[];
  }>;
  tagReferences: Array<{
    tag_name: string;
    routine_name: string;
    program_name: string;
    rung_number: number;
    usage_type: string;
  }>;
}
