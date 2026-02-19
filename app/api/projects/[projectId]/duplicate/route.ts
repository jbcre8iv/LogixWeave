import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";

interface RouteContext {
  params: Promise<{ projectId: string }>;
}

const BATCH_SIZE = 500;

async function insertBatched(
  client: ReturnType<typeof createServiceClient>,
  table: string,
  records: Record<string, unknown>[]
) {
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const { error } = await client.from(table).insert(batch);
    if (error) throw new Error(`Failed to insert into ${table}: ${error.message}`);
  }
}

export async function POST(request: Request, context: RouteContext) {
  const copiedStoragePaths: string[] = [];
  let newProjectId: string | null = null;

  try {
    const { projectId: sourceProjectId } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, includeFiles = true, includeNamingRules = true } = await request.json();

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Project name is required" }, { status: 400 });
    }

    const serviceClient = createServiceClient();

    // Fetch source project — use service client so we can check ownership
    const { data: sourceProject, error: sourceError } = await serviceClient
      .from("projects")
      .select("*")
      .eq("id", sourceProjectId)
      .single();

    if (sourceError || !sourceProject) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Only the owner can duplicate
    if (sourceProject.created_by !== user.id) {
      return NextResponse.json({ error: "Only the project owner can duplicate" }, { status: 403 });
    }

    // Create new project via user's client so RLS sets created_by correctly
    const { data: newProject, error: createError } = await supabase
      .from("projects")
      .insert({
        organization_id: sourceProject.organization_id,
        name: name.trim(),
        description: sourceProject.description,
        created_by: user.id,
        naming_rule_set_id: includeNamingRules ? sourceProject.naming_rule_set_id : null,
      })
      .select("id")
      .single();

    if (createError || !newProject) {
      return NextResponse.json(
        { error: createError?.message || "Failed to create project" },
        { status: 500 }
      );
    }

    newProjectId = newProject.id;

    if (includeFiles) {
      // --- Copy folders ---
      const folderIdMap = new Map<string, string>();

      const { data: sourceFolders } = await serviceClient
        .from("project_folders")
        .select("*")
        .eq("project_id", sourceProjectId)
        .order("created_at");

      if (sourceFolders && sourceFolders.length > 0) {
        for (const folder of sourceFolders) {
          const { id: _id, created_at: _ca, updated_at: _ua, project_id: _pid, ...folderData } = folder;
          const { data: newFolder, error: folderError } = await serviceClient
            .from("project_folders")
            .insert({ ...folderData, project_id: newProjectId })
            .select("id")
            .single();

          if (folderError) throw new Error(`Failed to copy folder: ${folderError.message}`);
          folderIdMap.set(folder.id, newFolder!.id);
        }
      }

      // --- Copy files and versions ---
      const fileIdMap = new Map<string, string>();
      const versionIdMap = new Map<string, string>();

      const { data: sourceFiles } = await serviceClient
        .from("project_files")
        .select("*")
        .eq("project_id", sourceProjectId)
        .order("created_at");

      if (sourceFiles && sourceFiles.length > 0) {
        for (const file of sourceFiles) {
          const {
            id: _id,
            created_at: _ca,
            updated_at: _ua,
            project_id: _pid,
            ...fileData
          } = file;

          // Remap folder_id if present
          const newFolderId = file.folder_id ? folderIdMap.get(file.folder_id) || null : null;

          const { data: newFile, error: fileError } = await serviceClient
            .from("project_files")
            .insert({
              ...fileData,
              project_id: newProjectId,
              folder_id: newFolderId,
              uploaded_by: user.id,
              storage_path: null, // Will be updated after copying the current version's blob
            })
            .select("id")
            .single();

          if (fileError) throw new Error(`Failed to copy file: ${fileError.message}`);
          fileIdMap.set(file.id, newFile!.id);

          // Copy file versions
          const { data: versions } = await serviceClient
            .from("file_versions")
            .select("*")
            .eq("file_id", file.id)
            .order("version_number");

          if (versions && versions.length > 0) {
            let currentVersionStoragePath: string | null = null;

            for (const version of versions) {
              const {
                id: _vid,
                created_at: _vca,
                file_id: _fid,
                ...versionData
              } = version;

              // Copy storage blob
              let newStoragePath: string | null = null;
              if (version.storage_path) {
                const fileName = version.storage_path.split("/").pop() || "file";
                newStoragePath = `${newProjectId}/${Date.now()}-dup-${fileName}`;

                // Download and re-upload (Supabase JS doesn't support server-side copy)
                const { data: blob, error: dlError } = await serviceClient.storage
                  .from("project-files")
                  .download(version.storage_path);

                if (dlError || !blob) {
                  throw new Error(`Failed to download blob: ${dlError?.message || "No data"}`);
                }

                const { error: upError } = await serviceClient.storage
                  .from("project-files")
                  .upload(newStoragePath, blob);

                if (upError) {
                  throw new Error(`Failed to upload blob: ${upError.message}`);
                }

                copiedStoragePaths.push(newStoragePath);

                if (version.version_number === file.current_version) {
                  currentVersionStoragePath = newStoragePath;
                }
              }

              const { data: newVersion, error: versionError } = await serviceClient
                .from("file_versions")
                .insert({
                  ...versionData,
                  file_id: newFile!.id,
                  storage_path: newStoragePath,
                  uploaded_by: user.id,
                })
                .select("id")
                .single();

              if (versionError) throw new Error(`Failed to copy version: ${versionError.message}`);
              versionIdMap.set(version.id, newVersion!.id);
            }

            // Update file's storage_path to point to the current version's blob
            if (currentVersionStoragePath) {
              await serviceClient
                .from("project_files")
                .update({ storage_path: currentVersionStoragePath })
                .eq("id", newFile!.id);
            }
          }
        }
      }

      // --- Copy parsed data for each file ---
      for (const [oldFileId, newFileId] of fileIdMap) {
        // Find the version ID mapping for this file
        const { data: oldVersions } = await serviceClient
          .from("file_versions")
          .select("id")
          .eq("file_id", oldFileId)
          .order("version_number")
          .limit(1);

        const { data: newVersions } = await serviceClient
          .from("file_versions")
          .select("id")
          .eq("file_id", newFileId)
          .order("version_number")
          .limit(1);

        const newVersionId = newVersions?.[0]?.id || null;

        // Helper to remap version_id
        const remapVersion = (oldVid: string | null) => {
          if (!oldVid) return null;
          return versionIdMap.get(oldVid) || newVersionId;
        };

        // parsed_tags
        const { data: tags } = await serviceClient
          .from("parsed_tags")
          .select("*")
          .eq("file_id", oldFileId);

        if (tags && tags.length > 0) {
          const tagRecords = tags.map(({ id: _id, created_at: _ca, file_id: _fid, version_id: vid, ...rest }) => ({
            ...rest,
            file_id: newFileId,
            version_id: remapVersion(vid),
          }));
          await insertBatched(serviceClient, "parsed_tags", tagRecords);
        }

        // parsed_routines — need ID map for rungs
        const routineIdMap = new Map<string, string>();
        const { data: routines } = await serviceClient
          .from("parsed_routines")
          .select("*")
          .eq("file_id", oldFileId)
          .order("created_at");

        if (routines && routines.length > 0) {
          for (const routine of routines) {
            const { id: _id, created_at: _ca, file_id: _fid, version_id: vid, ...rest } = routine;
            const { data: newRoutine, error } = await serviceClient
              .from("parsed_routines")
              .insert({
                ...rest,
                file_id: newFileId,
                version_id: remapVersion(vid),
              })
              .select("id")
              .single();
            if (error) throw new Error(`Failed to copy routine: ${error.message}`);
            routineIdMap.set(routine.id, newRoutine!.id);
          }
        }

        // parsed_rungs
        const { data: rungs } = await serviceClient
          .from("parsed_rungs")
          .select("*")
          .eq("file_id", oldFileId);

        if (rungs && rungs.length > 0) {
          const rungRecords = rungs.map(({ id: _id, created_at: _ca, file_id: _fid, version_id: vid, routine_id: rid, ...rest }) => ({
            ...rest,
            file_id: newFileId,
            version_id: remapVersion(vid),
            routine_id: rid ? routineIdMap.get(rid) || null : null,
          }));
          await insertBatched(serviceClient, "parsed_rungs", rungRecords);
        }

        // parsed_io_modules
        const { data: modules } = await serviceClient
          .from("parsed_io_modules")
          .select("*")
          .eq("file_id", oldFileId);

        if (modules && modules.length > 0) {
          const moduleRecords = modules.map(({ id: _id, created_at: _ca, file_id: _fid, version_id: vid, ...rest }) => ({
            ...rest,
            file_id: newFileId,
            version_id: remapVersion(vid),
          }));
          await insertBatched(serviceClient, "parsed_io_modules", moduleRecords);
        }

        // tag_references
        const { data: tagRefs } = await serviceClient
          .from("tag_references")
          .select("*")
          .eq("file_id", oldFileId);

        if (tagRefs && tagRefs.length > 0) {
          const tagRefRecords = tagRefs.map(({ id: _id, created_at: _ca, file_id: _fid, ...rest }) => ({
            ...rest,
            file_id: newFileId,
          }));
          await insertBatched(serviceClient, "tag_references", tagRefRecords);
        }

        // parsed_udts → parsed_udt_members
        const { data: udts } = await serviceClient
          .from("parsed_udts")
          .select("*")
          .eq("file_id", oldFileId)
          .order("created_at");

        if (udts && udts.length > 0) {
          for (const udt of udts) {
            const { id: oldUdtId, created_at: _ca, file_id: _fid, version_id: vid, ...rest } = udt;
            const { data: newUdt, error } = await serviceClient
              .from("parsed_udts")
              .insert({
                ...rest,
                file_id: newFileId,
                version_id: remapVersion(vid),
              })
              .select("id")
              .single();

            if (error) throw new Error(`Failed to copy UDT: ${error.message}`);

            // Copy UDT members
            const { data: members } = await serviceClient
              .from("parsed_udt_members")
              .select("*")
              .eq("udt_id", oldUdtId);

            if (members && members.length > 0) {
              const memberRecords = members.map(({ id: _id, created_at: _ca, udt_id: _uid, ...mrest }) => ({
                ...mrest,
                udt_id: newUdt!.id,
              }));
              await serviceClient.from("parsed_udt_members").insert(memberRecords);
            }
          }
        }

        // parsed_aois → parsed_aoi_parameters, parsed_aoi_local_tags, parsed_aoi_routines
        const { data: aois } = await serviceClient
          .from("parsed_aois")
          .select("*")
          .eq("file_id", oldFileId)
          .order("created_at");

        if (aois && aois.length > 0) {
          for (const aoi of aois) {
            const { id: oldAoiId, created_at: _ca, file_id: _fid, version_id: vid, ...rest } = aoi;
            const { data: newAoi, error } = await serviceClient
              .from("parsed_aois")
              .insert({
                ...rest,
                file_id: newFileId,
                version_id: remapVersion(vid),
              })
              .select("id")
              .single();

            if (error) throw new Error(`Failed to copy AOI: ${error.message}`);

            // Copy AOI parameters
            const { data: params } = await serviceClient
              .from("parsed_aoi_parameters")
              .select("*")
              .eq("aoi_id", oldAoiId);

            if (params && params.length > 0) {
              const paramRecords = params.map(({ id: _id, created_at: _ca, aoi_id: _aid, ...prest }) => ({
                ...prest,
                aoi_id: newAoi!.id,
              }));
              await serviceClient.from("parsed_aoi_parameters").insert(paramRecords);
            }

            // Copy AOI local tags
            const { data: localTags } = await serviceClient
              .from("parsed_aoi_local_tags")
              .select("*")
              .eq("aoi_id", oldAoiId);

            if (localTags && localTags.length > 0) {
              const localTagRecords = localTags.map(({ id: _id, created_at: _ca, aoi_id: _aid, ...lrest }) => ({
                ...lrest,
                aoi_id: newAoi!.id,
              }));
              await serviceClient.from("parsed_aoi_local_tags").insert(localTagRecords);
            }

            // Copy AOI routines
            const { data: aoiRoutines } = await serviceClient
              .from("parsed_aoi_routines")
              .select("*")
              .eq("aoi_id", oldAoiId);

            if (aoiRoutines && aoiRoutines.length > 0) {
              const aoiRoutineRecords = aoiRoutines.map(({ id: _id, created_at: _ca, aoi_id: _aid, ...rrest }) => ({
                ...rrest,
                aoi_id: newAoi!.id,
              }));
              await serviceClient.from("parsed_aoi_routines").insert(aoiRoutineRecords);
            }
          }
        }
      }
    }

    // Log activity on the new project
    await logActivity({
      projectId: newProjectId!,
      userId: user.id,
      userEmail: user.email,
      action: "project_duplicated",
      targetType: "project",
      targetId: sourceProjectId,
      targetName: sourceProject.name,
    });

    return NextResponse.json({ projectId: newProjectId });
  } catch (error) {
    console.error("Duplicate project error:", error);

    // Cleanup on failure
    if (newProjectId) {
      try {
        const serviceClient = createServiceClient();

        // Remove copied storage blobs
        if (copiedStoragePaths.length > 0) {
          await serviceClient.storage.from("project-files").remove(copiedStoragePaths);
        }

        // Delete the new project (CASCADE will clean up all child rows)
        await serviceClient.from("projects").delete().eq("id", newProjectId);
      } catch (cleanupError) {
        console.error("Cleanup after failed duplication:", cleanupError);
      }
    }

    const message = error instanceof Error ? error.message : "Failed to duplicate project";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
