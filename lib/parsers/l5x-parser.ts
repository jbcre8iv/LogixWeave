import { XMLParser } from "fast-xml-parser";
import type {
  ParsedL5XData,
  ParsedTag,
  ParsedIOModule,
  ParsedRoutine,
  ParsedRung,
  ParsedTagReference,
  ParsedUDT,
  ParsedUDTMember,
  ParsedAOI,
  ParsedAOIParameter,
  ParsedAOILocalTag,
  L5XRoot,
  L5XTag,
  L5XProgram,
  L5XRoutine,
  L5XRung,
  L5XModule,
  L5XUDT,
  L5XUDTMember,
  L5XAOI,
  L5XAOIParameter,
  L5XAOILocalTag,
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

function extractTagReferences(rungText: string): string[] {
  if (!rungText) return [];

  // Pattern to match tag references in ladder logic
  // Tags can contain letters, numbers, underscores, and array brackets
  // Common patterns: TagName, TagName.Member, TagName[0], Local:1:I.Data[0]
  const tagPattern = /(?<![a-zA-Z0-9_])([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+)*(?:\[[^\]]+\])?(?:\.[A-Za-z0-9_]+)*)/g;

  const matches = rungText.match(tagPattern) || [];

  // Filter out instruction names (common ladder logic instructions)
  const instructions = new Set([
    'XIC', 'XIO', 'OTE', 'OTL', 'OTU', 'ONS', 'OSR', 'OSF',
    'TON', 'TOF', 'RTO', 'CTU', 'CTD', 'RES', 'ADD', 'SUB',
    'MUL', 'DIV', 'MOD', 'NEG', 'ABS', 'SQR', 'CPT', 'MOV',
    'MVM', 'CLR', 'SWPB', 'AND', 'OR', 'XOR', 'NOT', 'CMP',
    'EQU', 'NEQ', 'GRT', 'GEQ', 'LES', 'LEQ', 'LIM', 'MEQ',
    'JSR', 'RET', 'SBR', 'JMP', 'LBL', 'MCR', 'AFI', 'NOP',
    'TND', 'UID', 'UIE', 'SFR', 'SFP', 'EOT', 'EVENT', 'MSG',
    'GSV', 'SSV', 'PSC', 'PFL', 'IOT', 'PCMD', 'PDET', 'ABL',
    'ACB', 'ACL', 'AHL', 'ARD', 'ARL', 'AWA', 'AWT', 'COP',
    'CPS', 'FLL', 'AVE', 'SRT', 'STD', 'SIZE', 'FAL', 'FSC',
    'FBC', 'DDT', 'DTR', 'PID', 'PIDE', 'PMUL', 'SCRV', 'PI',
    'POSP', 'RMPS', 'SRTP', 'LDLG', 'FGEN', 'TOT', 'DEDT',
    'D2SD', 'D3SD', 'DERV', 'HPF', 'LPF', 'NTCH', 'LDL2',
    'SOC', 'UPDN', 'INTG', 'RESD', 'HLL', 'RLIM', 'SNEG',
    'MAVE', 'MSTD', 'MINC', 'MAXC', 'SCL', 'SETD', 'BAND',
    'BNOT', 'BOR', 'BXOR', 'MVMT', 'BTDT', 'DFF', 'JKFF',
    'OSRI', 'OSFI', 'TONR', 'TOFR', 'RTOR', 'CTUD',
  ]);

  const uniqueTags = [...new Set(matches)].filter(tag => {
    const baseTag = tag.split('.')[0].split('[')[0].toUpperCase();
    return !instructions.has(baseTag);
  });

  return uniqueTags;
}

function determineUsageType(rungText: string, tagName: string): "read" | "write" | "both" {
  if (!rungText || !tagName) return "read";

  // Escape special regex characters in tag name
  const escapedTag = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Check for write operations (output instructions typically)
  const writePatterns = [
    new RegExp(`OTE\\s*\\(\\s*${escapedTag}`, 'i'),
    new RegExp(`OTL\\s*\\(\\s*${escapedTag}`, 'i'),
    new RegExp(`OTU\\s*\\(\\s*${escapedTag}`, 'i'),
    new RegExp(`MOV\\s*\\([^,]+,\\s*${escapedTag}`, 'i'),
    new RegExp(`ADD\\s*\\([^,]+,[^,]+,\\s*${escapedTag}`, 'i'),
    new RegExp(`SUB\\s*\\([^,]+,[^,]+,\\s*${escapedTag}`, 'i'),
    new RegExp(`MUL\\s*\\([^,]+,[^,]+,\\s*${escapedTag}`, 'i'),
    new RegExp(`DIV\\s*\\([^,]+,[^,]+,\\s*${escapedTag}`, 'i'),
    new RegExp(`COP\\s*\\([^,]+,\\s*${escapedTag}`, 'i'),
    new RegExp(`FLL\\s*\\([^,]+,\\s*${escapedTag}`, 'i'),
    new RegExp(`CLR\\s*\\(\\s*${escapedTag}`, 'i'),
  ];

  // Check for read operations (input instructions typically)
  const readPatterns = [
    new RegExp(`XIC\\s*\\(\\s*${escapedTag}`, 'i'),
    new RegExp(`XIO\\s*\\(\\s*${escapedTag}`, 'i'),
    new RegExp(`EQU\\s*\\(\\s*${escapedTag}`, 'i'),
    new RegExp(`NEQ\\s*\\(\\s*${escapedTag}`, 'i'),
    new RegExp(`GRT\\s*\\(\\s*${escapedTag}`, 'i'),
    new RegExp(`GEQ\\s*\\(\\s*${escapedTag}`, 'i'),
    new RegExp(`LES\\s*\\(\\s*${escapedTag}`, 'i'),
    new RegExp(`LEQ\\s*\\(\\s*${escapedTag}`, 'i'),
  ];

  const isWrite = writePatterns.some(p => p.test(rungText));
  const isRead = readPatterns.some(p => p.test(rungText));

  if (isWrite && isRead) return "both";
  if (isWrite) return "write";
  return "read";
}

function parseRung(
  rung: L5XRung,
  routineName: string,
  programName: string
): { parsedRung: ParsedRung; tagRefs: ParsedTagReference[] } {
  const number = parseInt(rung["@_Number"] || "0", 10);
  const comment = getDescription(rung.Comment);
  const content = getDescription(rung.Text) || "";
  const tagReferences = extractTagReferences(content);

  const tagRefs: ParsedTagReference[] = tagReferences.map(tagName => ({
    tagName,
    routineName,
    programName,
    rungNumber: number,
    usageType: determineUsageType(content, tagName),
  }));

  return {
    parsedRung: {
      number,
      routineName,
      programName,
      content,
      comment,
      tagReferences,
    },
    tagRefs,
  };
}

function parseUDTMember(member: L5XUDTMember): ParsedUDTMember {
  return {
    name: member["@_Name"] || "",
    dataType: member["@_DataType"] || "Unknown",
    dimension: member["@_Dimension"],
    radix: member["@_Radix"],
    externalAccess: member["@_ExternalAccess"],
    description: getDescription(member.Description),
  };
}

function parseUDT(udt: L5XUDT): ParsedUDT {
  const members = ensureArray(udt.Members?.Member).map(parseUDTMember);

  return {
    name: udt["@_Name"] || "",
    description: getDescription(udt.Description),
    familyType: udt["@_Family"],
    members,
  };
}

function parseAOIParameter(param: L5XAOIParameter): ParsedAOIParameter {
  return {
    name: param["@_Name"] || "",
    dataType: param["@_DataType"] || "Unknown",
    usage: (param["@_Usage"] as "Input" | "Output" | "InOut") || "Input",
    required: param["@_Required"] === "true",
    visible: param["@_Visible"] !== "false",
    externalAccess: param["@_ExternalAccess"],
    description: getDescription(param.Description),
    defaultValue: getDescription(param.DefaultValue),
  };
}

function parseAOILocalTag(localTag: L5XAOILocalTag): ParsedAOILocalTag {
  return {
    name: localTag["@_Name"] || "",
    dataType: localTag["@_DataType"] || "Unknown",
    radix: localTag["@_Radix"],
    externalAccess: localTag["@_ExternalAccess"],
    description: getDescription(localTag.Description),
  };
}

function parseAOI(aoi: L5XAOI): ParsedAOI {
  const parameters = ensureArray(aoi.Parameters?.Parameter).map(parseAOIParameter);
  const localTags = ensureArray(aoi.LocalTags?.LocalTag).map(parseAOILocalTag);
  const routines = ensureArray(aoi.Routines?.Routine).map(r => parseRoutine(r, aoi["@_Name"] || "AOI"));

  return {
    name: aoi["@_Name"] || "",
    description: getDescription(aoi.Description),
    revision: aoi["@_Revision"],
    vendor: aoi["@_Vendor"],
    executePrescan: aoi["@_ExecutePrescan"] === "true",
    executePostscan: aoi["@_ExecutePostscan"] === "true",
    executeEnableInFalse: aoi["@_ExecuteEnableInFalse"] === "true",
    createdDate: aoi["@_CreatedDate"],
    createdBy: aoi["@_CreatedBy"],
    editedDate: aoi["@_EditedDate"],
    editedBy: aoi["@_EditedBy"],
    parameters,
    localTags,
    routines,
  };
}

export function parseL5X(xmlContent: string): ParsedL5XData {
  const result: ParsedL5XData = {
    tags: [],
    modules: [],
    routines: [],
    rungs: [],
    tagReferences: [],
    udts: [],
    aois: [],
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

    // Parse User Defined Types (UDTs)
    const dataTypes = ensureArray(controller.DataTypes?.DataType);
    for (const dataType of dataTypes) {
      // Only parse UDTs that have members (not predefined types)
      if (dataType.Members) {
        result.udts.push(parseUDT(dataType));
      }
    }

    // Parse Add-On Instructions (AOIs)
    const aois = ensureArray(controller.AddOnInstructionDefinitions?.AddOnInstructionDefinition);
    for (const aoi of aois) {
      result.aois.push(parseAOI(aoi));
    }

    // Parse programs and their tags/routines/rungs
    const programs = ensureArray(controller.Programs?.Program);
    for (const program of programs) {
      const programName = program["@_Name"] || "Unknown";

      // Program-scoped tags
      const programTags = ensureArray(program.Tags?.Tag);
      for (const tag of programTags) {
        result.tags.push(parseTag(tag, programName));
      }

      // Program routines and rungs
      const routines = ensureArray(program.Routines?.Routine);
      for (const routine of routines) {
        const routineName = routine["@_Name"] || "Unknown";
        result.routines.push(parseRoutine(routine, programName));

        // Parse rungs for ladder logic routines
        if (routine.RLLContent?.Rung) {
          const rungs = ensureArray(routine.RLLContent.Rung) as L5XRung[];
          for (const rung of rungs) {
            const { parsedRung, tagRefs } = parseRung(rung, routineName, programName);
            result.rungs.push(parsedRung);
            result.tagReferences.push(...tagRefs);
          }
        }
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
