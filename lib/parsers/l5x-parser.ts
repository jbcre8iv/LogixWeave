import { XMLParser } from "fast-xml-parser";
import type {
  ParsedL5XData,
  ParsedTag,
  ParsedIOModule,
  ParsedRoutine,
  L5XRoot,
  L5XTag,
  L5XProgram,
  L5XRoutine,
  L5XModule,
} from "./types";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  parseAttributeValue: false,
});

function ensureArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function getDescription(desc: string | { "#text"?: string } | undefined): string | undefined {
  if (!desc) return undefined;
  if (typeof desc === "string") return desc;
  return desc["#text"];
}

function parseTag(tag: L5XTag, scope: string): ParsedTag {
  return {
    name: tag["@_Name"] || "",
    dataType: tag["@_DataType"] || "Unknown",
    scope,
    description: getDescription(tag.Description),
    aliasFor: tag["@_AliasFor"],
    usage: tag["@_Usage"],
    radix: tag["@_Radix"],
    externalAccess: tag["@_ExternalAccess"],
    dimensions: tag["@_Dimensions"],
    value: tag.Data ? JSON.stringify(tag.Data) : undefined,
  };
}

function parseRoutine(routine: L5XRoutine, programName: string): ParsedRoutine {
  let rungCount: number | undefined;

  if (routine.RLLContent?.Rung) {
    const rungs = ensureArray(routine.RLLContent.Rung);
    rungCount = rungs.length;
  }

  return {
    name: routine["@_Name"] || "",
    programName,
    type: routine["@_Type"] || "Unknown",
    description: getDescription(routine.Description),
    rungCount,
  };
}

function parseModule(module: L5XModule): ParsedIOModule {
  const slot = module["@_Slot"];
  return {
    name: module["@_Name"] || "",
    catalogNumber: module["@_CatalogNumber"],
    parentModule: module["@_ParentModule"],
    slot: slot ? parseInt(slot, 10) : undefined,
    connectionInfo: module.Communications
      ? { communications: module.Communications }
      : undefined,
  };
}

export function parseL5X(xmlContent: string): ParsedL5XData {
  const result: ParsedL5XData = {
    tags: [],
    modules: [],
    routines: [],
    metadata: {},
  };

  try {
    const parsed: L5XRoot = parser.parse(xmlContent);

    const content = parsed.RSLogix5000Content;
    if (!content) {
      throw new Error("Invalid L5X file: missing RSLogix5000Content");
    }

    // Extract metadata
    result.metadata.targetType = content["@_TargetType"];
    result.metadata.exportDate = content["@_ExportDate"];

    const controller = content.Controller;
    if (!controller) {
      throw new Error("Invalid L5X file: missing Controller");
    }

    result.metadata.projectName = controller["@_Name"];
    result.metadata.processorType = controller["@_ProcessorType"];
    result.metadata.softwareRevision = controller["@_SoftwareRevision"];

    // Parse controller-scoped tags
    const controllerTags = ensureArray(controller.Tags?.Tag);
    for (const tag of controllerTags) {
      result.tags.push(parseTag(tag, "Controller"));
    }

    // Parse programs and their tags/routines
    const programs = ensureArray(controller.Programs?.Program);
    for (const program of programs) {
      const programName = program["@_Name"] || "Unknown";

      // Program-scoped tags
      const programTags = ensureArray(program.Tags?.Tag);
      for (const tag of programTags) {
        result.tags.push(parseTag(tag, programName));
      }

      // Program routines
      const routines = ensureArray(program.Routines?.Routine);
      for (const routine of routines) {
        result.routines.push(parseRoutine(routine, programName));
      }
    }

    // Parse I/O modules
    const modules = ensureArray(controller.Modules?.Module);
    for (const module of modules) {
      result.modules.push(parseModule(module));
    }

    return result;
  } catch (error) {
    console.error("L5X parsing error:", error);
    throw error;
  }
}

export async function parseL5XFile(file: File): Promise<ParsedL5XData> {
  const content = await file.text();
  return parseL5X(content);
}
