import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface ImportedTag {
  name: string;
  dataType: string;
  scope?: string;
  description?: string;
  value?: string;
  usage?: string;
  radix?: string;
  externalAccess?: string;
  dimensions?: string;
}

function parseCSV(content: string): ImportedTag[] {
  const lines = content.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) {
    throw new Error("CSV must have at least a header row and one data row");
  }

  // Parse header
  const headerLine = lines[0];
  const headers = headerLine.split(",").map((h) => h.trim().toLowerCase().replace(/['"]/g, ""));

  // Validate required headers
  const nameIndex = headers.findIndex((h) => h === "name" || h === "tagname" || h === "tag name");
  const typeIndex = headers.findIndex((h) => h === "datatype" || h === "data type" || h === "type");

  if (nameIndex === -1) {
    throw new Error("CSV must have a 'Name' column");
  }
  if (typeIndex === -1) {
    throw new Error("CSV must have a 'DataType' column");
  }

  // Find optional columns
  const scopeIndex = headers.findIndex((h) => h === "scope");
  const descIndex = headers.findIndex((h) => h === "description" || h === "desc");
  const valueIndex = headers.findIndex((h) => h === "value" || h === "default");
  const usageIndex = headers.findIndex((h) => h === "usage");
  const radixIndex = headers.findIndex((h) => h === "radix");
  const accessIndex = headers.findIndex((h) => h === "externalaccess" || h === "external access" || h === "access");
  const dimIndex = headers.findIndex((h) => h === "dimensions" || h === "dimension" || h === "dim");

  // Parse data rows
  const tags: ImportedTag[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Handle quoted values with commas
    const values: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        values.push(current.trim().replace(/^"|"$/g, ""));
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim().replace(/^"|"$/g, ""));

    const name = values[nameIndex];
    const dataType = values[typeIndex];

    if (!name || !dataType) continue;

    tags.push({
      name,
      dataType,
      scope: scopeIndex >= 0 ? values[scopeIndex] || "Controller" : "Controller",
      description: descIndex >= 0 ? values[descIndex] : undefined,
      value: valueIndex >= 0 ? values[valueIndex] : undefined,
      usage: usageIndex >= 0 ? values[usageIndex] : undefined,
      radix: radixIndex >= 0 ? values[radixIndex] : undefined,
      externalAccess: accessIndex >= 0 ? values[accessIndex] : undefined,
      dimensions: dimIndex >= 0 ? values[dimIndex] : undefined,
    });
  }

  return tags;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const content = await file.text();

    try {
      const tags = parseCSV(content);

      if (tags.length === 0) {
        return NextResponse.json({ error: "No valid tags found in CSV" }, { status: 400 });
      }

      return NextResponse.json({
        tags,
        count: tags.length,
      });
    } catch (parseError) {
      return NextResponse.json(
        { error: parseError instanceof Error ? parseError.message : "Failed to parse CSV" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Tag import error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
