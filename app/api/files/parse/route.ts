import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { parseL5X } from "@/lib/parsers/l5x-parser";

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

      // Parse the file content
      const content = await fileData.text();
      const parsed = parseL5X(content);

      // Use service client to bypass RLS for bulk inserts
      const serviceSupabase = await createServiceClient();

      // Delete any existing parsed data for this file
      await Promise.all([
        serviceSupabase.from("parsed_tags").delete().eq("file_id", fileId),
        serviceSupabase.from("parsed_io_modules").delete().eq("file_id", fileId),
        serviceSupabase.from("parsed_routines").delete().eq("file_id", fileId),
      ]);

      // Insert parsed tags in batches
      if (parsed.tags.length > 0) {
        const tagRecords = parsed.tags.map((tag) => ({
          file_id: fileId,
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

      // Update status to completed
      await supabase
        .from("project_files")
        .update({ parsing_status: "completed", parsing_error: null })
        .eq("id", fileId);

      return NextResponse.json({
        success: true,
        stats: {
          tags: parsed.tags.length,
          modules: parsed.modules.length,
          routines: parsed.routines.length,
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
