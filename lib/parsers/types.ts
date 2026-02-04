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
  metadata: {
    projectName?: string;
    processorType?: string;
    softwareRevision?: string;
    targetType?: string;
    exportDate?: string;
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

export interface L5XRoutine {
  "@_Name"?: string;
  "@_Type"?: string;
  Description?: string | { "#text"?: string };
  RLLContent?: {
    Rung?: unknown | unknown[];
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
    "@_ExportDate"?: string;
    Controller?: L5XController;
  };
}
