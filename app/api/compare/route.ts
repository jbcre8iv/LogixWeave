import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SupabaseClient } from "@supabase/supabase-js";

interface ComparisonResult {
  tags: ReturnType<typeof compareTags>;
  routines: ReturnType<typeof compareRoutines>;
  modules: ReturnType<typeof compareModules>;
  summary: {
    totalChanges: number;
    tagsChanged: number;
    routinesChanged: number;
    modulesChanged: number;
  };
}

async function compareFiles(
  supabase: SupabaseClient,
  file1Id: string,
  file2Id: string,
  version1Id?: string | null,
  version2Id?: string | null
): Promise<ComparisonResult> {
  const [tags1, tags2, routines1, routines2, modules1, modules2] = await Promise.all([
    version1Id
      ? supabase.from("parsed_tags").select("name, data_type, scope, description").eq("version_id", version1Id)
      : supabase.from("parsed_tags").select("name, data_type, scope, description").eq("file_id", file1Id),
    version2Id
      ? supabase.from("parsed_tags").select("name, data_type, scope, description").eq("version_id", version2Id)
      : supabase.from("parsed_tags").select("name, data_type, scope, description").eq("file_id", file2Id),
    version1Id
      ? supabase.from("parsed_routines").select("name, program_name, type, description, rung_count").eq("version_id", version1Id)
      : supabase.from("parsed_routines").select("name, program_name, type, description, rung_count").eq("file_id", file1Id),
    version2Id
      ? supabase.from("parsed_routines").select("name, program_name, type, description, rung_count").eq("version_id", version2Id)
      : supabase.from("parsed_routines").select("name, program_name, type, description, rung_count").eq("file_id", file2Id),
    version1Id
      ? supabase.from("parsed_io_modules").select("name, catalog_number, parent_module, slot").eq("version_id", version1Id)
      : supabase.from("parsed_io_modules").select("name, catalog_number, parent_module, slot").eq("file_id", file1Id),
    version2Id
      ? supabase.from("parsed_io_modules").select("name, catalog_number, parent_module, slot").eq("version_id", version2Id)
      : supabase.from("parsed_io_modules").select("name, catalog_number, parent_module, slot").eq("file_id", file2Id),
  ]);

  const tagComparison = compareTags(tags1.data || [], tags2.data || []);
  const routineComparison = compareRoutines(routines1.data || [], routines2.data || []);
  const moduleComparison = compareModules(modules1.data || [], modules2.data || []);

  return {
    tags: tagComparison,
    routines: routineComparison,
    modules: moduleComparison,
    summary: {
      totalChanges:
        tagComparison.added.length + tagComparison.removed.length + tagComparison.modified.length +
        routineComparison.added.length + routineComparison.removed.length + routineComparison.modified.length +
        moduleComparison.added.length + moduleComparison.removed.length + moduleComparison.modified.length,
      tagsChanged: tagComparison.added.length + tagComparison.removed.length + tagComparison.modified.length,
      routinesChanged: routineComparison.added.length + routineComparison.removed.length + routineComparison.modified.length,
      modulesChanged: moduleComparison.added.length + moduleComparison.removed.length + moduleComparison.modified.length,
    },
  };
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const folder1Id = searchParams.get("folder1");
    const folder2Id = searchParams.get("folder2");

    // Folder comparison mode
    if (folder1Id && folder2Id) {
      return handleFolderComparison(supabase, folder1Id, folder2Id);
    }

    // File comparison mode
    const file1Id = searchParams.get("file1");
    const file2Id = searchParams.get("file2");
    const version1 = searchParams.get("v1");
    const version2 = searchParams.get("v2");

    if (!file1Id || !file2Id) {
      return NextResponse.json(
        { error: "Both file1 and file2 are required" },
        { status: 400 }
      );
    }

    // If comparing versions of the same file, get version IDs
    let version1Id: string | null = null;
    let version2Id: string | null = null;

    if (version1 && version2 && file1Id === file2Id) {
      const [v1Result, v2Result] = await Promise.all([
        supabase
          .from("file_versions")
          .select("id")
          .eq("file_id", file1Id)
          .eq("version_number", parseInt(version1))
          .single(),
        supabase
          .from("file_versions")
          .select("id")
          .eq("file_id", file2Id)
          .eq("version_number", parseInt(version2))
          .single(),
      ]);

      version1Id = v1Result.data?.id || null;
      version2Id = v2Result.data?.id || null;
    }

    const result = await compareFiles(supabase, file1Id, file2Id, version1Id, version2Id);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Compare error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function handleFolderComparison(
  supabase: SupabaseClient,
  folder1Id: string,
  folder2Id: string
) {
  // Fetch folder metadata
  const [folder1Result, folder2Result] = await Promise.all([
    supabase.from("project_folders").select("id, name, project_id").eq("id", folder1Id).single(),
    supabase.from("project_folders").select("id, name, project_id").eq("id", folder2Id).single(),
  ]);

  if (folder1Result.error || folder2Result.error) {
    return NextResponse.json({ error: "One or both folders not found" }, { status: 404 });
  }

  // Fetch all completed files in both folders
  const { data: allFiles } = await supabase
    .from("project_files")
    .select("id, file_name, folder_id")
    .in("folder_id", [folder1Id, folder2Id])
    .eq("parsing_status", "completed");

  const files = allFiles || [];
  const folder1Files = files.filter((f) => f.folder_id === folder1Id);
  const folder2Files = files.filter((f) => f.folder_id === folder2Id);

  // Match files by file_name
  const folder1Map = new Map(folder1Files.map((f) => [f.file_name, f]));
  const folder2Map = new Map(folder2Files.map((f) => [f.file_name, f]));

  const matchedPairs: Array<{ fileName: string; file1Id: string; file2Id: string }> = [];
  const unmatchedFiles: Array<{ fileName: string; fileId: string; side: "left" | "right" }> = [];

  for (const [name, file] of folder1Map) {
    const match = folder2Map.get(name);
    if (match) {
      matchedPairs.push({ fileName: name, file1Id: file.id, file2Id: match.id });
    } else {
      unmatchedFiles.push({ fileName: name, fileId: file.id, side: "left" });
    }
  }

  for (const [name, file] of folder2Map) {
    if (!folder1Map.has(name)) {
      unmatchedFiles.push({ fileName: name, fileId: file.id, side: "right" });
    }
  }

  // Compare all matched pairs in parallel
  const comparisons = await Promise.all(
    matchedPairs.map(async (pair) => ({
      fileName: pair.fileName,
      file1Id: pair.file1Id,
      file2Id: pair.file2Id,
      result: await compareFiles(supabase, pair.file1Id, pair.file2Id),
    }))
  );

  const filesWithChanges = comparisons.filter((c) => c.result.summary.totalChanges > 0).length;
  const totalChanges = comparisons.reduce((sum, c) => sum + c.result.summary.totalChanges, 0);

  return NextResponse.json({
    type: "folder",
    folder1Name: folder1Result.data.name,
    folder2Name: folder2Result.data.name,
    comparisons,
    unmatchedFiles,
    summary: {
      totalFiles: folder1Files.length + folder2Files.length,
      matchedFiles: matchedPairs.length,
      unmatchedLeft: unmatchedFiles.filter((f) => f.side === "left").length,
      unmatchedRight: unmatchedFiles.filter((f) => f.side === "right").length,
      filesWithChanges,
      totalChanges,
    },
  });
}

interface Tag {
  name: string;
  data_type: string;
  scope: string | null;
  description: string | null;
}

function compareTags(tags1: Tag[], tags2: Tag[]) {
  const map1 = new Map(tags1.map((t) => [t.name, t]));
  const map2 = new Map(tags2.map((t) => [t.name, t]));

  const added: Array<{ name: string; data_type: string }> = [];
  const removed: Array<{ name: string; data_type: string }> = [];
  const modified: Array<{ name: string; data_type: string; changes: string[] }> = [];

  // Find removed and modified
  for (const [name, tag1] of map1) {
    const tag2 = map2.get(name);
    if (!tag2) {
      removed.push({ name: tag1.name, data_type: tag1.data_type });
    } else {
      const changes: string[] = [];
      if (tag1.data_type !== tag2.data_type) {
        changes.push(`Data type: ${tag1.data_type} → ${tag2.data_type}`);
      }
      if (tag1.scope !== tag2.scope) {
        changes.push(`Scope: ${tag1.scope || "none"} → ${tag2.scope || "none"}`);
      }
      if (tag1.description !== tag2.description) {
        changes.push(`Description changed`);
      }
      if (changes.length > 0) {
        modified.push({ name: tag1.name, data_type: tag2.data_type, changes });
      }
    }
  }

  // Find added
  for (const [name, tag2] of map2) {
    if (!map1.has(name)) {
      added.push({ name: tag2.name, data_type: tag2.data_type });
    }
  }

  return { added, removed, modified };
}

interface Routine {
  name: string;
  program_name: string;
  type: string;
  description: string | null;
  rung_count: number | null;
}

function compareRoutines(routines1: Routine[], routines2: Routine[]) {
  // Use program_name + name as key since routine names might repeat across programs
  const getKey = (r: Routine) => `${r.program_name}::${r.name}`;
  const map1 = new Map(routines1.map((r) => [getKey(r), r]));
  const map2 = new Map(routines2.map((r) => [getKey(r), r]));

  const added: Array<{ name: string; program_name: string; type: string }> = [];
  const removed: Array<{ name: string; program_name: string; type: string }> = [];
  const modified: Array<{ name: string; program_name: string; changes: string[] }> = [];

  // Find removed and modified
  for (const [key, routine1] of map1) {
    const routine2 = map2.get(key);
    if (!routine2) {
      removed.push({ name: routine1.name, program_name: routine1.program_name, type: routine1.type });
    } else {
      const changes: string[] = [];
      if (routine1.type !== routine2.type) {
        changes.push(`Type: ${routine1.type} → ${routine2.type}`);
      }
      if (routine1.rung_count !== routine2.rung_count) {
        changes.push(`Rung count: ${routine1.rung_count ?? 0} → ${routine2.rung_count ?? 0}`);
      }
      if (routine1.description !== routine2.description) {
        changes.push(`Description changed`);
      }
      if (changes.length > 0) {
        modified.push({ name: routine1.name, program_name: routine1.program_name, changes });
      }
    }
  }

  // Find added
  for (const [key, routine2] of map2) {
    if (!map1.has(key)) {
      added.push({ name: routine2.name, program_name: routine2.program_name, type: routine2.type });
    }
  }

  return { added, removed, modified };
}

interface Module {
  name: string;
  catalog_number: string | null;
  parent_module: string | null;
  slot: number | null;
}

function compareModules(modules1: Module[], modules2: Module[]) {
  const map1 = new Map(modules1.map((m) => [m.name, m]));
  const map2 = new Map(modules2.map((m) => [m.name, m]));

  const added: Array<{ name: string; catalog_number: string | null }> = [];
  const removed: Array<{ name: string; catalog_number: string | null }> = [];
  const modified: Array<{ name: string; changes: string[] }> = [];

  // Find removed and modified
  for (const [name, module1] of map1) {
    const module2 = map2.get(name);
    if (!module2) {
      removed.push({ name: module1.name, catalog_number: module1.catalog_number });
    } else {
      const changes: string[] = [];
      if (module1.catalog_number !== module2.catalog_number) {
        changes.push(`Catalog: ${module1.catalog_number || "none"} → ${module2.catalog_number || "none"}`);
      }
      if (module1.parent_module !== module2.parent_module) {
        changes.push(`Parent: ${module1.parent_module || "none"} → ${module2.parent_module || "none"}`);
      }
      if (module1.slot !== module2.slot) {
        changes.push(`Slot: ${module1.slot ?? "none"} → ${module2.slot ?? "none"}`);
      }
      if (changes.length > 0) {
        modified.push({ name: module1.name, changes });
      }
    }
  }

  // Find added
  for (const [name, module2] of map2) {
    if (!map1.has(name)) {
      added.push({ name: module2.name, catalog_number: module2.catalog_number });
    }
  }

  return { added, removed, modified };
}
