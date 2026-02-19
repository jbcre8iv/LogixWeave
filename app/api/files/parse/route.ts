import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { parseL5X } from "@/lib/parsers/l5x-parser";
import { parseL5K } from "@/lib/parsers/l5k-parser";
import { logActivity } from "@/lib/activity-log";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { fileId } = await request.json();

    if (!fileId) {
      return NextResponse.json({ error: "fileId is required" }, { status: 400 });
    }

    // Get file details
    const { data: file, error: fileError } = await supabase
      .from("project_files")
      .select("*")
      .eq("id", fileId)
      .single();

    if (fileError || !file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Get the current version record for linking parsed data
    const { data: currentVersion } = await supabase
      .from("file_versions")
      .select("id")
      .eq("file_id", fileId)
      .eq("version_number", file.current_version || 1)
      .single();

    const versionId = currentVersion?.id || null;

    // Update status to processing
    await supabase
      .from("project_files")
      .update({ parsing_status: "processing" })
      .eq("id", fileId);

    try {
      // Download file from storage
      const { data: fileData, error: downloadError } = await supabase.storage
        .from("project-files")
        .download(file.storage_path);

      if (downloadError || !fileData) {
        throw new Error(downloadError?.message || "Failed to download file");
      }

      // Parse the file content based on file type
      const content = await fileData.text();
      const isL5K = file.file_type === "l5k" || file.file_name?.toLowerCase().endsWith(".l5k");
      const parsed = isL5K ? parseL5K(content) : parseL5X(content);

      // Use service client to bypass RLS for bulk inserts
      const serviceSupabase = await createServiceClient();

      // Delete any existing parsed data for this file
      // First delete child tables that reference other parsed tables
      await Promise.all([
        serviceSupabase.from("parsed_udt_members").delete().in(
          "udt_id",
          (await serviceSupabase.from("parsed_udts").select("id").eq("file_id", fileId)).data?.map(u => u.id) || []
        ),
        serviceSupabase.from("parsed_aoi_parameters").delete().in(
          "aoi_id",
          (await serviceSupabase.from("parsed_aois").select("id").eq("file_id", fileId)).data?.map(a => a.id) || []
        ),
        serviceSupabase.from("parsed_aoi_local_tags").delete().in(
          "aoi_id",
          (await serviceSupabase.from("parsed_aois").select("id").eq("file_id", fileId)).data?.map(a => a.id) || []
        ),
        serviceSupabase.from("parsed_aoi_routines").delete().in(
          "aoi_id",
          (await serviceSupabase.from("parsed_aois").select("id").eq("file_id", fileId)).data?.map(a => a.id) || []
        ),
      ]);

      // Then delete parent tables
      await Promise.all([
        serviceSupabase.from("parsed_tags").delete().eq("file_id", fileId),
        serviceSupabase.from("parsed_io_modules").delete().eq("file_id", fileId),
        serviceSupabase.from("parsed_routines").delete().eq("file_id", fileId),
        serviceSupabase.from("parsed_rungs").delete().eq("file_id", fileId),
        serviceSupabase.from("tag_references").delete().eq("file_id", fileId),
        serviceSupabase.from("parsed_udts").delete().eq("file_id", fileId),
        serviceSupabase.from("parsed_aois").delete().eq("file_id", fileId),
        serviceSupabase.from("parsed_tasks").delete().eq("file_id", fileId),
      ]);

      // Insert parsed tags in batches
      if (parsed.tags.length > 0) {
        const tagRecords = parsed.tags.map((tag) => ({
          file_id: fileId,
          version_id: versionId,
          name: tag.name,
          data_type: tag.dataType,
          scope: tag.scope,
          description: tag.description,
          value: tag.value,
          alias_for: tag.aliasFor,
          usage: tag.usage,
          radix: tag.radix,
          external_access: tag.externalAccess,
          dimensions: tag.dimensions,
        }));

        // Insert in batches of 500
        const batchSize = 500;
        for (let i = 0; i < tagRecords.length; i += batchSize) {
          const batch = tagRecords.slice(i, i + batchSize);
          const { error: insertError } = await serviceSupabase
            .from("parsed_tags")
            .insert(batch);
          if (insertError) {
            console.error("Error inserting tags batch:", insertError);
          }
        }
      }

      // Insert parsed modules
      if (parsed.modules.length > 0) {
        const moduleRecords = parsed.modules.map((module) => ({
          file_id: fileId,
          version_id: versionId,
          name: module.name,
          catalog_number: module.catalogNumber,
          parent_module: module.parentModule,
          slot: module.slot,
          connection_info: module.connectionInfo,
        }));

        const { error: insertError } = await serviceSupabase
          .from("parsed_io_modules")
          .insert(moduleRecords);
        if (insertError) {
          console.error("Error inserting modules:", insertError);
        }
      }

      // Insert parsed routines
      if (parsed.routines.length > 0) {
        const routineRecords = parsed.routines.map((routine) => ({
          file_id: fileId,
          version_id: versionId,
          name: routine.name,
          program_name: routine.programName,
          type: routine.type,
          description: routine.description,
          rung_count: routine.rungCount,
        }));

        const { error: insertError } = await serviceSupabase
          .from("parsed_routines")
          .insert(routineRecords);
        if (insertError) {
          console.error("Error inserting routines:", insertError);
        }
      }

      // Insert parsed rungs in batches
      if (parsed.rungs.length > 0) {
        const rungRecords = parsed.rungs.map((rung) => ({
          file_id: fileId,
          version_id: versionId,
          routine_name: rung.routineName,
          program_name: rung.programName,
          number: rung.number,
          content: rung.content,
          comment: rung.comment,
        }));

        const batchSize = 500;
        for (let i = 0; i < rungRecords.length; i += batchSize) {
          const batch = rungRecords.slice(i, i + batchSize);
          const { error: insertError } = await serviceSupabase
            .from("parsed_rungs")
            .insert(batch);
          if (insertError) {
            console.error("Error inserting rungs batch:", insertError);
          }
        }
      }

      // Insert tag references in batches
      if (parsed.tagReferences.length > 0) {
        const tagRefRecords = parsed.tagReferences.map((ref) => ({
          file_id: fileId,
          tag_name: ref.tagName,
          routine_name: ref.routineName,
          program_name: ref.programName,
          rung_number: ref.rungNumber,
          usage_type: ref.usageType,
        }));

        const batchSize = 500;
        for (let i = 0; i < tagRefRecords.length; i += batchSize) {
          const batch = tagRefRecords.slice(i, i + batchSize);
          const { error: insertError } = await serviceSupabase
            .from("tag_references")
            .insert(batch);
          if (insertError) {
            console.error("Error inserting tag references batch:", insertError);
          }
        }
      }

      // Insert parsed UDTs and their members
      if (parsed.udts.length > 0) {
        for (const udt of parsed.udts) {
          const { data: udtRecord, error: udtError } = await serviceSupabase
            .from("parsed_udts")
            .insert({
              file_id: fileId,
              version_id: versionId,
              name: udt.name,
              description: udt.description,
              family_type: udt.familyType,
            })
            .select("id")
            .single();

          if (udtError) {
            console.error("Error inserting UDT:", udtError);
            continue;
          }

          if (udt.members.length > 0 && udtRecord) {
            const memberRecords = udt.members.map((member) => ({
              udt_id: udtRecord.id,
              name: member.name,
              data_type: member.dataType,
              dimension: member.dimension,
              radix: member.radix,
              external_access: member.externalAccess,
              description: member.description,
            }));

            const { error: memberError } = await serviceSupabase
              .from("parsed_udt_members")
              .insert(memberRecords);
            if (memberError) {
              console.error("Error inserting UDT members:", memberError);
            }
          }
        }
      }

      // Insert parsed AOIs with their parameters, local tags, and routines
      if (parsed.aois.length > 0) {
        for (const aoi of parsed.aois) {
          const { data: aoiRecord, error: aoiError } = await serviceSupabase
            .from("parsed_aois")
            .insert({
              file_id: fileId,
              version_id: versionId,
              name: aoi.name,
              description: aoi.description,
              revision: aoi.revision,
              vendor: aoi.vendor,
              execute_prescan: aoi.executePrescan,
              execute_postscan: aoi.executePostscan,
              execute_enable_in_false: aoi.executeEnableInFalse,
              created_date: aoi.createdDate,
              created_by: aoi.createdBy,
              edited_date: aoi.editedDate,
              edited_by: aoi.editedBy,
            })
            .select("id")
            .single();

          if (aoiError) {
            console.error("Error inserting AOI:", aoiError);
            continue;
          }

          if (aoiRecord) {
            // Insert AOI parameters
            if (aoi.parameters.length > 0) {
              const paramRecords = aoi.parameters.map((param) => ({
                aoi_id: aoiRecord.id,
                name: param.name,
                data_type: param.dataType,
                usage: param.usage,
                required: param.required,
                visible: param.visible,
                external_access: param.externalAccess,
                description: param.description,
                default_value: param.defaultValue,
              }));

              const { error: paramError } = await serviceSupabase
                .from("parsed_aoi_parameters")
                .insert(paramRecords);
              if (paramError) {
                console.error("Error inserting AOI parameters:", paramError);
              }
            }

            // Insert AOI local tags
            if (aoi.localTags.length > 0) {
              const localTagRecords = aoi.localTags.map((tag) => ({
                aoi_id: aoiRecord.id,
                name: tag.name,
                data_type: tag.dataType,
                radix: tag.radix,
                external_access: tag.externalAccess,
                description: tag.description,
              }));

              const { error: localTagError } = await serviceSupabase
                .from("parsed_aoi_local_tags")
                .insert(localTagRecords);
              if (localTagError) {
                console.error("Error inserting AOI local tags:", localTagError);
              }
            }

            // Insert AOI routines
            if (aoi.routines.length > 0) {
              const routineRecords = aoi.routines.map((routine) => ({
                aoi_id: aoiRecord.id,
                name: routine.name,
                type: routine.type,
                description: routine.description,
                rung_count: routine.rungCount,
              }));

              const { error: routineError } = await serviceSupabase
                .from("parsed_aoi_routines")
                .insert(routineRecords);
              if (routineError) {
                console.error("Error inserting AOI routines:", routineError);
              }
            }
          }
        }
      }

      // Insert parsed tasks
      if (parsed.tasks.length > 0) {
        const taskRecords = parsed.tasks.map((task) => ({
          file_id: fileId,
          version_id: versionId,
          name: task.name,
          type: task.type,
          rate: task.rate,
          priority: task.priority,
          watchdog: task.watchdog,
          inhibit_task: task.inhibitTask,
          disable_update_outputs: task.disableUpdateOutputs,
          description: task.description,
          scheduled_programs: task.scheduledPrograms,
        }));

        const { error: insertError } = await serviceSupabase
          .from("parsed_tasks")
          .insert(taskRecords);
        if (insertError) {
          console.error("Error inserting tasks:", insertError);
        }
      }

      // Update status to completed, and store export type metadata
      await supabase
        .from("project_files")
        .update({
          parsing_status: "completed",
          parsing_error: null,
          target_type: parsed.metadata.targetType || null,
          target_name: parsed.metadata.targetName || null,
        })
        .eq("id", fileId);

      // Log activity
      await logActivity({
        projectId: file.project_id,
        userId: user.id,
        userEmail: user.email,
        action: "file_parsed",
        targetType: "file",
        targetId: fileId,
        targetName: file.file_name,
        metadata: {
          tags: parsed.tags.length,
          modules: parsed.modules.length,
          routines: parsed.routines.length,
          rungs: parsed.rungs.length,
          udts: parsed.udts.length,
          aois: parsed.aois.length,
          tasks: parsed.tasks.length,
        },
      });

      return NextResponse.json({
        success: true,
        stats: {
          tags: parsed.tags.length,
          modules: parsed.modules.length,
          routines: parsed.routines.length,
          rungs: parsed.rungs.length,
          tagReferences: parsed.tagReferences.length,
          udts: parsed.udts.length,
          aois: parsed.aois.length,
          tasks: parsed.tasks.length,
        },
      });
    } catch (parseError) {
      const errorMessage =
        parseError instanceof Error ? parseError.message : "Unknown parsing error";

      // Update status to failed
      await supabase
        .from("project_files")
        .update({
          parsing_status: "failed",
          parsing_error: errorMessage,
        })
        .eq("id", fileId);

      // Log activity
      await logActivity({
        projectId: file.project_id,
        userId: user.id,
        userEmail: user.email,
        action: "file_parse_failed",
        targetType: "file",
        targetId: fileId,
        targetName: file.file_name,
        metadata: { error: errorMessage },
      });

      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Parse API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
