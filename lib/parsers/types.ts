// L5X/L5K Parser Types

export interface ParsedTag {
  name: string;
  dataType: string;
  scope: string;
  description?: string;
  value?: string;
  aliasFor?: string;
  usage?: string;
  radix?: string;
  externalAccess?: string;
  dimensions?: string;
}

export interface ParsedRung {
  number: number;
  routineName: string;
  programName: string;
  content: string;
  comment?: string;
  tagReferences: string[];
}

export interface ParsedTagReference {
  tagName: string;
  routineName: string;
  programName: string;
  rungNumber: number;
  usageType: "read" | "write" | "both";
}

export interface ParsedUDT {
  name: string;
  description?: string;
  familyType?: string;
  members: ParsedUDTMember[];
}

export interface ParsedUDTMember {
  name: string;
  dataType: string;
  dimension?: string;
  radix?: string;
  externalAccess?: string;
  description?: string;
}

export interface ParsedAOI {
  name: string;
  description?: string;
  revision?: string;
  vendor?: string;
  executePrescan?: boolean;
  executePostscan?: boolean;
  executeEnableInFalse?: boolean;
  createdDate?: string;
  createdBy?: string;
  editedDate?: string;
  editedBy?: string;
  parameters: ParsedAOIParameter[];
  localTags: ParsedAOILocalTag[];
  routines: ParsedRoutine[];
}

export interface ParsedAOIParameter {
  name: string;
  dataType: string;
  usage: "Input" | "Output" | "InOut";
  required: boolean;
  visible: boolean;
  externalAccess?: string;
  description?: string;
  defaultValue?: string;
}

export interface ParsedAOILocalTag {
  name: string;
  dataType: string;
  radix?: string;
  externalAccess?: string;
  description?: string;
}

export interface ParsedTask {
  name: string;
  type: string;           // "CONTINUOUS" | "PERIODIC" | "EVENT"
  rate?: number;          // milliseconds (Periodic tasks)
  priority: number;       // 1-15
  watchdog?: number;      // ms
  inhibitTask?: boolean;
  disableUpdateOutputs?: boolean;
  description?: string;
  scheduledPrograms: string[];  // ordered list of program names
}

export interface ParsedIOModule {
  name: string;
  catalogNumber?: string;
  parentModule?: string;
  slot?: number;
  connectionInfo?: Record<string, unknown>;
}

export interface ParsedRoutine {
  name: string;
  programName: string;
  type: string;
  description?: string;
  rungCount?: number;
}

export interface ParsedL5XData {
  tags: ParsedTag[];
  modules: ParsedIOModule[];
  routines: ParsedRoutine[];
  rungs: ParsedRung[];
  tagReferences: ParsedTagReference[];
  udts: ParsedUDT[];
  aois: ParsedAOI[];
  tasks: ParsedTask[];
  metadata: {
    projectName?: string;
    processorType?: string;
    softwareRevision?: string;
    targetType?: string;
    targetName?: string;
    exportDate?: string;
  };
}

export interface L5XUDTMember {
  "@_Name"?: string;
  "@_DataType"?: string;
  "@_Dimension"?: string;
  "@_Radix"?: string;
  "@_ExternalAccess"?: string;
  Description?: string | { "#text"?: string };
}

export interface L5XUDT {
  "@_Name"?: string;
  "@_Family"?: string;
  Description?: string | { "#text"?: string };
  Members?: {
    Member?: L5XUDTMember | L5XUDTMember[];
  };
}

export interface L5XAOIParameter {
  "@_Name"?: string;
  "@_DataType"?: string;
  "@_Usage"?: string;
  "@_Required"?: string;
  "@_Visible"?: string;
  "@_ExternalAccess"?: string;
  DefaultValue?: string | { "#text"?: string };
  Description?: string | { "#text"?: string };
}

export interface L5XAOILocalTag {
  "@_Name"?: string;
  "@_DataType"?: string;
  "@_Radix"?: string;
  "@_ExternalAccess"?: string;
  Description?: string | { "#text"?: string };
}

export interface L5XAOI {
  "@_Name"?: string;
  "@_Revision"?: string;
  "@_Vendor"?: string;
  "@_ExecutePrescan"?: string;
  "@_ExecutePostscan"?: string;
  "@_ExecuteEnableInFalse"?: string;
  "@_CreatedDate"?: string;
  "@_CreatedBy"?: string;
  "@_EditedDate"?: string;
  "@_EditedBy"?: string;
  Description?: string | { "#text"?: string };
  Parameters?: {
    Parameter?: L5XAOIParameter | L5XAOIParameter[];
  };
  LocalTags?: {
    LocalTag?: L5XAOILocalTag | L5XAOILocalTag[];
  };
  Routines?: {
    Routine?: L5XRoutine | L5XRoutine[];
  };
}

export interface L5XTask {
  "@_Name"?: string;
  "@_Type"?: string;
  "@_Rate"?: string;
  "@_Priority"?: string;
  "@_Watchdog"?: string;
  "@_InhibitTask"?: string;
  "@_DisableUpdateOutputs"?: string;
  Description?: string | { "#text"?: string };
  ScheduledPrograms?: {
    ScheduledProgram?: { "@_Name"?: string } | { "@_Name"?: string }[];
  };
}

export interface L5XController {
  "@_Name"?: string;
  "@_ProcessorType"?: string;
  "@_SoftwareRevision"?: string;
  Tags?: {
    Tag?: L5XTag | L5XTag[];
  };
  Programs?: {
    Program?: L5XProgram | L5XProgram[];
  };
  Modules?: {
    Module?: L5XModule | L5XModule[];
  };
  DataTypes?: {
    DataType?: L5XUDT | L5XUDT[];
  };
  AddOnInstructionDefinitions?: {
    AddOnInstructionDefinition?: L5XAOI | L5XAOI[];
  };
  Tasks?: {
    Task?: L5XTask | L5XTask[];
  };
}

export interface L5XTag {
  "@_Name"?: string;
  "@_DataType"?: string;
  "@_Usage"?: string;
  "@_Radix"?: string;
  "@_ExternalAccess"?: string;
  "@_Dimensions"?: string;
  "@_AliasFor"?: string;
  Description?: string | { "#text"?: string };
  Data?: unknown;
}

export interface L5XProgram {
  "@_Name"?: string;
  Tags?: {
    Tag?: L5XTag | L5XTag[];
  };
  Routines?: {
    Routine?: L5XRoutine | L5XRoutine[];
  };
}

export interface L5XRung {
  "@_Number"?: string;
  "@_Type"?: string;
  Comment?: string | { "#text"?: string };
  Text?: string | { "#text"?: string };
}

export interface L5XRoutine {
  "@_Name"?: string;
  "@_Type"?: string;
  Description?: string | { "#text"?: string };
  RLLContent?: {
    Rung?: L5XRung | L5XRung[];
  };
}

export interface L5XModule {
  "@_Name"?: string;
  "@_CatalogNumber"?: string;
  "@_ParentModule"?: string;
  "@_Slot"?: string;
  Ports?: unknown;
  Communications?: unknown;
}

export interface L5XRoot {
  RSLogix5000Content?: {
    "@_TargetType"?: string;
    "@_TargetName"?: string;
    "@_ExportDate"?: string;
    Controller?: L5XController;
  };
}
