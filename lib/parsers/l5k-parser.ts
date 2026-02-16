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
} from "./types";
import { extractTagReferences, determineUsageType } from "./l5x-parser";

/**
 * Extract all top-level blocks matching `KEYWORD ... END_KEYWORD` from text.
 * Handles nesting by tracking depth of same-keyword blocks.
 */
function extractBlocks(text: string, keyword: string): string[] {
  const blocks: string[] = [];
  const openPattern = new RegExp(`\\b${keyword}\\b`, "g");
  const endKeyword = `END_${keyword}`;

  let match: RegExpExecArray | null;
  while ((match = openPattern.exec(text)) !== null) {
    // Make sure this isn't an END_ prefix
    const prefixStart = match.index - 4;
    if (prefixStart >= 0 && text.substring(prefixStart, match.index) === "END_") {
      continue;
    }

    let depth = 1;
    let pos = match.index + keyword.length;
    const startPos = match.index;

    while (pos < text.length && depth > 0) {
      // Look for next END_KEYWORD or KEYWORD occurrence
      const nextEnd = text.indexOf(endKeyword, pos);
      const nextOpenSearch = text.substring(pos);
      const nextOpenMatch = new RegExp(`\\b${keyword}\\b`).exec(nextOpenSearch);
      const nextOpen = nextOpenMatch
        ? pos + nextOpenMatch.index
        : -1;

      // Check that nextOpen isn't actually an END_ match
      let validNextOpen = nextOpen;
      if (validNextOpen !== -1) {
        const openPrefixStart = validNextOpen - 4;
        if (openPrefixStart >= 0 && text.substring(openPrefixStart, validNextOpen) === "END_") {
          validNextOpen = -1;
        }
      }

      if (nextEnd === -1) {
        // No closing found, take rest of text
        break;
      }

      if (validNextOpen !== -1 && validNextOpen < nextEnd) {
        // Found a nested open before the close
        depth++;
        pos = validNextOpen + keyword.length;
      } else {
        // Found a close
        depth--;
        if (depth === 0) {
          blocks.push(text.substring(startPos, nextEnd + endKeyword.length));
        }
        pos = nextEnd + endKeyword.length;
      }
    }
  }

  return blocks;
}

/**
 * Parse `(Key := Value, Key := "quoted value", ...)` into a key-value map.
 * Handles quoted strings with escaped quotes, numeric values, and booleans.
 */
function parseAttributes(attrString: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  if (!attrString) return attrs;

  // Remove outer parentheses if present
  let s = attrString.trim();
  if (s.startsWith("(")) s = s.substring(1);
  if (s.endsWith(")")) s = s.substring(0, s.length - 1);

  let pos = 0;
  while (pos < s.length) {
    // Skip whitespace and commas
    while (pos < s.length && (s[pos] === " " || s[pos] === "," || s[pos] === "\t" || s[pos] === "\n" || s[pos] === "\r")) {
      pos++;
    }
    if (pos >= s.length) break;

    // Read key (until :=)
    const assignIdx = s.indexOf(":=", pos);
    if (assignIdx === -1) break;

    const key = s.substring(pos, assignIdx).trim();
    pos = assignIdx + 2;

    // Skip whitespace after :=
    while (pos < s.length && (s[pos] === " " || s[pos] === "\t")) {
      pos++;
    }

    let value: string;
    if (pos < s.length && s[pos] === '"') {
      // Quoted string - read until unescaped closing quote
      pos++; // skip opening quote
      let valueChars = "";
      while (pos < s.length) {
        if (s[pos] === '"') {
          // Check for escaped quote (doubled quote or backslash-quote)
          if (pos + 1 < s.length && s[pos + 1] === '"') {
            valueChars += '"';
            pos += 2;
          } else {
            pos++; // skip closing quote
            break;
          }
        } else if (s[pos] === "\\" && pos + 1 < s.length && s[pos + 1] === '"') {
          valueChars += '"';
          pos += 2;
        } else {
          valueChars += s[pos];
          pos++;
        }
      }
      value = valueChars;
    } else {
      // Unquoted value - read until comma or end, respecting nested parens
      let depth = 0;
      const start = pos;
      while (pos < s.length) {
        if (s[pos] === "(") depth++;
        else if (s[pos] === ")") {
          if (depth === 0) break;
          depth--;
        } else if (s[pos] === "," && depth === 0) break;
        pos++;
      }
      value = s.substring(start, pos).trim();
    }

    if (key) {
      attrs[key] = value;
    }
  }

  return attrs;
}

/**
 * Extract the name and attribute string from a block header line.
 * E.g., `CONTROLLER MyCtrl (ProcessorType := "1756-L75", ...)` → { name: "MyCtrl", attrs: "ProcessorType := ..." }
 */
function parseBlockHeader(blockText: string, keyword: string): { name: string; attrString: string } {
  // Find the keyword and extract the rest of the first logical "line" (up to the first block or newline after attrs)
  const keywordIdx = blockText.indexOf(keyword);
  if (keywordIdx === -1) return { name: "", attrString: "" };

  const afterKeyword = blockText.substring(keywordIdx + keyword.length).trimStart();

  // Name is the first token (could be followed by whitespace, paren, or newline)
  const nameMatch = afterKeyword.match(/^(\S+)/);
  const name = nameMatch ? nameMatch[1] : "";

  // Find attribute parentheses after the name
  const afterName = afterKeyword.substring(name.length);
  const parenStart = afterName.indexOf("(");
  if (parenStart === -1) return { name, attrString: "" };

  // Find matching closing paren, accounting for nested parens and quoted strings
  let depth = 0;
  let inQuote = false;
  let pos = parenStart;
  while (pos < afterName.length) {
    const ch = afterName[pos];
    if (inQuote) {
      if (ch === '"') inQuote = false;
      else if (ch === "\\" && pos + 1 < afterName.length) pos++; // skip escaped char
    } else {
      if (ch === '"') inQuote = true;
      else if (ch === "(") depth++;
      else if (ch === ")") {
        depth--;
        if (depth === 0) {
          return { name, attrString: afterName.substring(parenStart + 1, pos) };
        }
      }
    }
    pos++;
  }

  // If we didn't find matching close, return what we have
  return { name, attrString: afterName.substring(parenStart + 1) };
}

function parseL5KController(controllerBlock: string): ParsedL5XData["metadata"] {
  const { name, attrString } = parseBlockHeader(controllerBlock, "CONTROLLER");
  const attrs = parseAttributes(attrString);

  return {
    projectName: name,
    processorType: attrs["ProcessorType"],
    softwareRevision: attrs["Major"] ? `${attrs["Major"]}.${attrs["Minor"] || "0"}` : undefined,
    targetType: "Controller",
    targetName: name,
  };
}

function parseL5KTags(tagBlock: string, scope: string): ParsedTag[] {
  const tags: ParsedTag[] = [];

  // Remove the TAG / END_TAG wrapper
  let content = tagBlock;
  const tagStart = content.indexOf("TAG");
  if (tagStart !== -1) {
    content = content.substring(tagStart + 3);
  }
  const endIdx = content.lastIndexOf("END_TAG");
  if (endIdx !== -1) {
    content = content.substring(0, endIdx);
  }

  // Split by lines and reassemble tag declarations (which may span multiple lines)
  // Each tag declaration ends with a semicolon at the end
  const lines = content.split("\n");
  let currentDecl = "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    currentDecl += (currentDecl ? " " : "") + trimmed;

    // Check if the declaration is complete (ends with semicolon)
    if (trimmed.endsWith(";")) {
      const tag = parseTagDeclaration(currentDecl, scope);
      if (tag) {
        tags.push(tag);
      }
      currentDecl = "";
    }
  }

  return tags;
}

/**
 * Parse a single tag declaration line like:
 * `MyTag : DINT (Radix := Decimal, ExternalAccess := Read/Write) := 0;`
 * `MyAlias : BOOL (AliasFor := SomeTag, Description := "A tag");`
 */
function parseTagDeclaration(decl: string, scope: string): ParsedTag | null {
  // Remove trailing semicolon
  let s = decl.trim();
  if (s.endsWith(";")) s = s.substring(0, s.length - 1).trim();
  if (!s) return null;

  // Split on first `:` to get name (but not `:=`)
  const colonIdx = findTagColon(s);
  if (colonIdx === -1) return null;

  const name = s.substring(0, colonIdx).trim();
  const rest = s.substring(colonIdx + 1).trim();

  // Extract data type: everything before the first `(` or `:=`
  let dataType = "";
  let afterType = rest;

  // Find where data type ends (at `(` or `:=` or end)
  const parenPos = findUnquotedChar(rest, "(");
  const assignPos = rest.indexOf(":=");

  let typeEndPos: number;
  if (parenPos !== -1 && (assignPos === -1 || parenPos < assignPos)) {
    typeEndPos = parenPos;
  } else if (assignPos !== -1) {
    typeEndPos = assignPos;
  } else {
    typeEndPos = rest.length;
  }

  dataType = rest.substring(0, typeEndPos).trim();
  afterType = rest.substring(typeEndPos);

  // Handle array types like `DINT[10]` — the dimension is part of the type declaration
  let dimensions: string | undefined;
  const dimMatch = dataType.match(/^(\w+)\[(.+)\]$/);
  if (dimMatch) {
    dataType = dimMatch[1];
    dimensions = dimMatch[2];
  }

  // Extract attributes if present
  let attrs: Record<string, string> = {};
  if (afterType.startsWith("(")) {
    // Find matching closing paren
    let depth = 0;
    let inQuote = false;
    let pos = 0;
    while (pos < afterType.length) {
      const ch = afterType[pos];
      if (inQuote) {
        if (ch === '"') inQuote = false;
        else if (ch === "\\" && pos + 1 < afterType.length) pos++;
      } else {
        if (ch === '"') inQuote = true;
        else if (ch === "(") depth++;
        else if (ch === ")") {
          depth--;
          if (depth === 0) {
            attrs = parseAttributes(afterType.substring(0, pos + 1));
            afterType = afterType.substring(pos + 1).trim();
            break;
          }
        }
      }
      pos++;
    }
  }

  // Extract initial value if present (after `:=`)
  let value: string | undefined;
  if (afterType.startsWith(":=")) {
    value = afterType.substring(2).trim();
  }

  return {
    name,
    dataType: dataType || "Unknown",
    scope,
    description: attrs["Description"],
    value,
    aliasFor: attrs["AliasFor"],
    usage: attrs["Usage"],
    radix: attrs["Radix"],
    externalAccess: attrs["ExternalAccess"],
    dimensions: dimensions || attrs["Dimension"],
  };
}

/**
 * Find the first `:` that is a type separator (not part of `:=`).
 */
function findTagColon(s: string): number {
  for (let i = 0; i < s.length; i++) {
    if (s[i] === ":" && (i + 1 >= s.length || s[i + 1] !== "=")) {
      return i;
    }
  }
  return -1;
}

function findUnquotedChar(s: string, ch: string): number {
  let inQuote = false;
  for (let i = 0; i < s.length; i++) {
    if (inQuote) {
      if (s[i] === '"') inQuote = false;
      else if (s[i] === "\\" && i + 1 < s.length) i++;
    } else {
      if (s[i] === '"') inQuote = true;
      else if (s[i] === ch) return i;
    }
  }
  return -1;
}

function parseL5KModules(controllerBlock: string): ParsedIOModule[] {
  const modules: ParsedIOModule[] = [];
  const moduleBlocks = extractBlocks(controllerBlock, "MODULE");

  for (const block of moduleBlocks) {
    const { name, attrString } = parseBlockHeader(block, "MODULE");
    const attrs = parseAttributes(attrString);

    modules.push({
      name,
      catalogNumber: attrs["CatalogNumber"],
      parentModule: attrs["ParentModule"],
      slot: attrs["Slot"] ? parseInt(attrs["Slot"], 10) : undefined,
    });
  }

  return modules;
}

function parseL5KDataTypes(controllerBlock: string): ParsedUDT[] {
  const udts: ParsedUDT[] = [];
  const dtBlocks = extractBlocks(controllerBlock, "DATATYPE");

  for (const block of dtBlocks) {
    const { name, attrString } = parseBlockHeader(block, "DATATYPE");
    const attrs = parseAttributes(attrString);

    const members = parseL5KMembers(block);

    // Only include UDTs that have members (not predefined types)
    if (members.length > 0) {
      udts.push({
        name,
        description: attrs["Description"],
        familyType: attrs["FamilyType"],
        members,
      });
    }
  }

  return udts;
}

function parseL5KMembers(datatypeBlock: string): ParsedUDTMember[] {
  const members: ParsedUDTMember[] = [];

  // Members are MEMBER lines inside DATATYPE blocks
  const lines = datatypeBlock.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    const memberMatch = trimmed.match(/^MEMBER\s+(\S+)\s*\(/);
    if (memberMatch) {
      const memberName = memberMatch[1];
      // Extract the attribute parens
      const parenStart = trimmed.indexOf("(");
      let attrStr = "";
      if (parenStart !== -1) {
        // Find matching close paren
        let depth = 0;
        let inQuote = false;
        for (let i = parenStart; i < trimmed.length; i++) {
          const ch = trimmed[i];
          if (inQuote) {
            if (ch === '"') inQuote = false;
            else if (ch === "\\" && i + 1 < trimmed.length) i++;
          } else {
            if (ch === '"') inQuote = true;
            else if (ch === "(") depth++;
            else if (ch === ")") {
              depth--;
              if (depth === 0) {
                attrStr = trimmed.substring(parenStart + 1, i);
                break;
              }
            }
          }
        }
      }

      const attrs = parseAttributes(attrStr);
      members.push({
        name: memberName,
        dataType: attrs["DataType"] || "Unknown",
        dimension: attrs["Dimension"],
        radix: attrs["Radix"],
        externalAccess: attrs["ExternalAccess"],
        description: attrs["Description"],
      });
    }
  }

  return members;
}

/**
 * Split routine content into individual rung bodies by finding `N:` markers.
 * Returns the text after each `N:` up to the next `N:` or `END_ROUTINE`.
 */
function splitRungs(routineContent: string): string[] {
  const sections: string[] = [];
  const lines = routineContent.split("\n");
  let current: string[] = [];
  let inRung = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("N:")) {
      if (inRung && current.length > 0) {
        sections.push(current.join("\n"));
      }
      // Start new rung, capture text after "N:"
      current = [trimmed.substring(2)];
      inRung = true;
    } else if (inRung) {
      if (trimmed === "END_ROUTINE" || trimmed.startsWith("END_ROUTINE")) {
        if (current.length > 0) {
          sections.push(current.join("\n"));
        }
        inRung = false;
        current = [];
      } else {
        current.push(trimmed);
      }
    }
  }

  // Flush last rung
  if (inRung && current.length > 0) {
    sections.push(current.join("\n"));
  }

  return sections;
}

function parseL5KRungs(
  routineContent: string,
  routineName: string,
  programName: string
): { parsedRungs: ParsedRung[]; tagRefs: ParsedTagReference[] } {
  const parsedRungs: ParsedRung[] = [];
  const tagRefs: ParsedTagReference[] = [];

  // Split content by N: rung markers and parse each one
  // We use split + manual processing instead of dotall regex for compatibility
  const rungSections = splitRungs(routineContent);
  let rungNumber = 0;

  for (const rungBody of rungSections) {
    const trimmedBody = rungBody.trim();
    if (!trimmedBody) continue;

    // Extract optional comment in [brackets] (may span multiple lines)
    let comment: string | undefined;
    let bodyAfterComment = trimmedBody;
    const commentMatch = trimmedBody.match(/^\[([\s\S]+?)\]\s*/);
    if (commentMatch) {
      comment = commentMatch[1].trim();
      bodyAfterComment = trimmedBody.substring(commentMatch[0].length);
    }

    // The ladder text is everything remaining (remove trailing semicolon)
    let content = bodyAfterComment.trim();
    if (content.endsWith(";")) {
      content = content.substring(0, content.length - 1).trim();
    }

    const tagReferences = extractTagReferences(content);

    const refs: ParsedTagReference[] = tagReferences.map((tagName) => ({
      tagName,
      routineName,
      programName,
      rungNumber,
      usageType: determineUsageType(content, tagName),
    }));

    parsedRungs.push({
      number: rungNumber,
      routineName,
      programName,
      content,
      comment,
      tagReferences,
    });

    tagRefs.push(...refs);
    rungNumber++;
  }

  return { parsedRungs, tagRefs };
}

function parseL5KRoutines(
  programBlock: string,
  programName: string
): { routines: ParsedRoutine[]; rungs: ParsedRung[]; tagRefs: ParsedTagReference[] } {
  const routines: ParsedRoutine[] = [];
  const allRungs: ParsedRung[] = [];
  const allTagRefs: ParsedTagReference[] = [];

  const routineBlocks = extractBlocks(programBlock, "ROUTINE");

  for (const block of routineBlocks) {
    const { name, attrString } = parseBlockHeader(block, "ROUTINE");
    const attrs = parseAttributes(attrString);
    const routineType = attrs["Type"] || "Unknown";

    const { parsedRungs, tagRefs } = parseL5KRungs(block, name, programName);

    routines.push({
      name,
      programName,
      type: routineType,
      description: attrs["Description"],
      rungCount: parsedRungs.length > 0 ? parsedRungs.length : undefined,
    });

    allRungs.push(...parsedRungs);
    allTagRefs.push(...tagRefs);
  }

  return { routines, rungs: allRungs, tagRefs: allTagRefs };
}

function parseL5KPrograms(controllerBlock: string): {
  tags: ParsedTag[];
  routines: ParsedRoutine[];
  rungs: ParsedRung[];
  tagRefs: ParsedTagReference[];
} {
  const tags: ParsedTag[] = [];
  const routines: ParsedRoutine[] = [];
  const rungs: ParsedRung[] = [];
  const tagRefs: ParsedTagReference[] = [];

  const programBlocks = extractBlocks(controllerBlock, "PROGRAM");

  for (const block of programBlocks) {
    const { name: programName } = parseBlockHeader(block, "PROGRAM");

    // Parse program-scoped tags
    const tagBlocks = extractBlocks(block, "TAG");
    for (const tagBlock of tagBlocks) {
      tags.push(...parseL5KTags(tagBlock, programName));
    }

    // Parse routines
    const result = parseL5KRoutines(block, programName);
    routines.push(...result.routines);
    rungs.push(...result.rungs);
    tagRefs.push(...result.tagRefs);
  }

  return { tags, routines, rungs, tagRefs };
}

function parseL5KAOIs(controllerBlock: string): ParsedAOI[] {
  const aois: ParsedAOI[] = [];
  const aoiBlocks = extractBlocks(controllerBlock, "ADD_ON_INSTRUCTION_DEFINITION");

  for (const block of aoiBlocks) {
    const { name, attrString } = parseBlockHeader(block, "ADD_ON_INSTRUCTION_DEFINITION");
    const attrs = parseAttributes(attrString);

    const parameters = parseL5KAOIParameters(block);
    const localTags = parseL5KAOILocalTags(block);

    // Parse routines within the AOI
    const { routines } = parseL5KRoutines(block, name);

    aois.push({
      name,
      description: attrs["Description"],
      revision: attrs["Revision"],
      vendor: attrs["Vendor"],
      executePrescan: attrs["ExecutePrescan"] === "true",
      executePostscan: attrs["ExecutePostscan"] === "true",
      executeEnableInFalse: attrs["ExecuteEnableInFalse"] === "true",
      createdDate: attrs["CreatedDate"],
      createdBy: attrs["CreatedBy"],
      editedDate: attrs["EditedDate"],
      editedBy: attrs["EditedBy"],
      parameters,
      localTags,
      routines,
    });
  }

  return aois;
}

function parseL5KAOIParameters(aoiBlock: string): ParsedAOIParameter[] {
  const params: ParsedAOIParameter[] = [];
  const paramBlocks = extractBlocks(aoiBlock, "PARAMETERS");

  for (const block of paramBlocks) {
    // Parameters are declared as: name : DataType (attrs);
    const lines = block.split("\n");
    let currentDecl = "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === "PARAMETERS" || trimmed === "END_PARAMETERS") continue;

      currentDecl += (currentDecl ? " " : "") + trimmed;

      if (trimmed.endsWith(";")) {
        const param = parseAOIParamDeclaration(currentDecl);
        if (param) params.push(param);
        currentDecl = "";
      }
    }
  }

  return params;
}

function parseAOIParamDeclaration(decl: string): ParsedAOIParameter | null {
  let s = decl.trim();
  if (s.endsWith(";")) s = s.substring(0, s.length - 1).trim();
  if (!s) return null;

  const colonIdx = findTagColon(s);
  if (colonIdx === -1) return null;

  const name = s.substring(0, colonIdx).trim();
  const rest = s.substring(colonIdx + 1).trim();

  // Data type before `(`
  const parenPos = findUnquotedChar(rest, "(");
  const dataType = parenPos !== -1
    ? rest.substring(0, parenPos).trim()
    : rest.trim();

  let attrs: Record<string, string> = {};
  if (parenPos !== -1) {
    let depth = 0;
    let inQuote = false;
    let pos = parenPos;
    while (pos < rest.length) {
      const ch = rest[pos];
      if (inQuote) {
        if (ch === '"') inQuote = false;
        else if (ch === "\\" && pos + 1 < rest.length) pos++;
      } else {
        if (ch === '"') inQuote = true;
        else if (ch === "(") depth++;
        else if (ch === ")") {
          depth--;
          if (depth === 0) {
            attrs = parseAttributes(rest.substring(parenPos, pos + 1));
            break;
          }
        }
      }
      pos++;
    }
  }

  return {
    name,
    dataType: dataType || "Unknown",
    usage: (attrs["Usage"] as "Input" | "Output" | "InOut") || "Input",
    required: attrs["Required"] === "true",
    visible: attrs["Visible"] !== "false",
    externalAccess: attrs["ExternalAccess"],
    description: attrs["Description"],
    defaultValue: attrs["DefaultValue"],
  };
}

function parseL5KAOILocalTags(aoiBlock: string): ParsedAOILocalTag[] {
  const localTags: ParsedAOILocalTag[] = [];
  const ltBlocks = extractBlocks(aoiBlock, "LOCAL_TAGS");

  for (const block of ltBlocks) {
    const lines = block.split("\n");
    let currentDecl = "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === "LOCAL_TAGS" || trimmed === "END_LOCAL_TAGS") continue;

      currentDecl += (currentDecl ? " " : "") + trimmed;

      if (trimmed.endsWith(";")) {
        const tag = parseLocalTagDeclaration(currentDecl);
        if (tag) localTags.push(tag);
        currentDecl = "";
      }
    }
  }

  return localTags;
}

function parseLocalTagDeclaration(decl: string): ParsedAOILocalTag | null {
  let s = decl.trim();
  if (s.endsWith(";")) s = s.substring(0, s.length - 1).trim();
  if (!s) return null;

  const colonIdx = findTagColon(s);
  if (colonIdx === -1) return null;

  const name = s.substring(0, colonIdx).trim();
  const rest = s.substring(colonIdx + 1).trim();

  const parenPos = findUnquotedChar(rest, "(");
  const dataType = parenPos !== -1
    ? rest.substring(0, parenPos).trim()
    : rest.trim();

  let attrs: Record<string, string> = {};
  if (parenPos !== -1) {
    let depth = 0;
    let inQuote = false;
    let pos = parenPos;
    while (pos < rest.length) {
      const ch = rest[pos];
      if (inQuote) {
        if (ch === '"') inQuote = false;
        else if (ch === "\\" && pos + 1 < rest.length) pos++;
      } else {
        if (ch === '"') inQuote = true;
        else if (ch === "(") depth++;
        else if (ch === ")") {
          depth--;
          if (depth === 0) {
            attrs = parseAttributes(rest.substring(parenPos, pos + 1));
            break;
          }
        }
      }
      pos++;
    }
  }

  return {
    name,
    dataType: dataType || "Unknown",
    radix: attrs["Radix"],
    externalAccess: attrs["ExternalAccess"],
    description: attrs["Description"],
  };
}

/**
 * Main entry point: parse L5K text content into ParsedL5XData.
 */
export function parseL5K(textContent: string): ParsedL5XData {
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
    // Extract the CONTROLLER block (the main container)
    const controllerBlocks = extractBlocks(textContent, "CONTROLLER");
    if (controllerBlocks.length === 0) {
      throw new Error("Invalid L5K file: missing CONTROLLER block");
    }
    const controllerBlock = controllerBlocks[0];

    // Parse controller metadata
    result.metadata = parseL5KController(controllerBlock);

    // Parse controller-scoped tags (TAG blocks directly inside CONTROLLER, not inside PROGRAM)
    // We need to find TAG blocks that are direct children of CONTROLLER, not nested in PROGRAM
    const tagBlocks = extractBlocks(controllerBlock, "TAG");
    const programBlocks = extractBlocks(controllerBlock, "PROGRAM");

    // Filter out TAG blocks that are inside PROGRAM blocks
    for (const tagBlock of tagBlocks) {
      const tagStart = controllerBlock.indexOf(tagBlock);
      let isInsideProgram = false;
      for (const progBlock of programBlocks) {
        const progStart = controllerBlock.indexOf(progBlock);
        const progEnd = progStart + progBlock.length;
        if (tagStart > progStart && tagStart < progEnd) {
          isInsideProgram = true;
          break;
        }
      }
      if (!isInsideProgram) {
        result.tags.push(...parseL5KTags(tagBlock, "Controller"));
      }
    }

    // Parse data types (UDTs)
    result.udts = parseL5KDataTypes(controllerBlock);

    // Parse AOIs
    result.aois = parseL5KAOIs(controllerBlock);

    // Parse programs (including their tags, routines, rungs)
    const programData = parseL5KPrograms(controllerBlock);
    result.tags.push(...programData.tags);
    result.routines.push(...programData.routines);
    result.rungs.push(...programData.rungs);
    result.tagReferences.push(...programData.tagRefs);

    // Parse I/O modules
    result.modules = parseL5KModules(controllerBlock);

    return result;
  } catch (error) {
    console.error("L5K parsing error:", error);
    throw error;
  }
}
