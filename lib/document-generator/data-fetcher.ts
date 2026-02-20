import { createClient } from "@/lib/supabase/server";
import type { ProjectData } from "./types";

/**
 * Fetch and aggregate all parsed data for a project.
 * Resolves latest file versions to avoid duplicate data from old versions.
 */
export async function fetchProjectData(projectId: string): Promise<ProjectData> {
  const supabase = await createClient();

  // Get project with files
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, name, project_files(id, parsing_status, current_version)")
    .eq("id", projectId)
    .single();

  if (projectError || !project) {
    throw new Error("Project not found");
  }

  const completedFiles = project.project_files
    ?.filter((f: { parsing_status: string }) => f.parsing_status === "completed") || [];
  const fileIds = completedFiles.map((f: { id: string }) => f.id);

  if (fileIds.length === 0) {
    throw new Error("No parsed files in project");
  }

  // Resolve latest version IDs (reuse pattern from explain route)
  const { data: latestVersions } = await supabase
    .from("file_versions")
    .select("id, file_id, version_number")
    .in("file_id", fileIds);

  const versionIds = (latestVersions || [])
    .filter((v: { file_id: string; version_number: number }) => {
      const file = completedFiles.find((f: { id: string }) => f.id === v.file_id);
      return file && v.version_number === (file as { current_version: number }).current_version;
    })
    .map((v: { id: string }) => v.id);

  // Fetch all data in parallel
  const [
    tagsResult,
    routinesResult,
    rungsResult,
    modulesResult,
    udtsResult,
    aoisResult,
    tasksResult,
    tagRefsResult,
  ] = await Promise.all([
    supabase
      .from("parsed_tags")
      .select("name, data_type, scope, description, usage, radix, alias_for")
      .in("version_id", versionIds)
      .order("scope")
      .order("name"),
    supabase
      .from("parsed_routines")
      .select("name, program_name, type, description, rung_count")
      .in("version_id", versionIds)
      .order("program_name")
      .order("name"),
    supabase
      .from("parsed_rungs")
      .select("routine_name, program_name, number, content, comment")
      .in("version_id", versionIds)
      .order("program_name")
      .order("routine_name")
      .order("number"),
    supabase
      .from("parsed_io_modules")
      .select("name, catalog_number, parent_module, slot")
      .in("version_id", versionIds)
      .order("slot"),
    supabase
      .from("parsed_udts")
      .select("name, description, family_type, parsed_udt_members(name, data_type, description)")
      .in("version_id", versionIds)
      .order("name"),
    supabase
      .from("parsed_aois")
      .select("name, description, revision, vendor, parsed_aoi_parameters(name, data_type, usage, description), parsed_aoi_local_tags(name, data_type, description)")
      .in("version_id", versionIds)
      .order("name"),
    supabase
      .from("parsed_tasks")
      .select("name, type, rate, priority, watchdog, description, scheduled_programs")
      .in("version_id", versionIds)
      .order("priority"),
    supabase
      .from("tag_references")
      .select("tag_name, routine_name, program_name, rung_number, usage_type")
      .in("file_id", fileIds),
  ]);

  // Get metadata from the first file version
  let metadata: ProjectData["metadata"] = {};
  if (versionIds.length > 0) {
    const { data: versionData } = await supabase
      .from("file_versions")
      .select("metadata")
      .in("id", versionIds)
      .limit(1)
      .single();

    if (versionData?.metadata) {
      const m = versionData.metadata as Record<string, string>;
      metadata = {
        processorType: m.processorType || m.processor_type,
        softwareRevision: m.softwareRevision || m.software_revision,
        exportDate: m.exportDate || m.export_date,
      };
    }
  }

  return {
    projectName: project.name,
    metadata,
    tags: tagsResult.data || [],
    routines: routinesResult.data || [],
    rungs: rungsResult.data || [],
    modules: modulesResult.data || [],
    udts: udtsResult.data || [],
    aois: aoisResult.data || [],
    tasks: tasksResult.data || [],
    tagReferences: tagRefsResult.data || [],
  };
}
