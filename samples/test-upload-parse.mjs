/**
 * Test script: uploads sample L5X/L5K files to a project and triggers parsing.
 *
 * Usage:  node samples/test-upload-parse.mjs
 *
 * Reads .env.local for Supabase credentials and uses the service role key
 * to bypass auth/RLS (same as the parse route does internally).
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// Load .env.local
const envContent = readFileSync(resolve(root, ".env.local"), "utf-8");
const env = {};
for (const line of envContent.split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const { createClient } = await import("@supabase/supabase-js");

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// --- Pick a project to upload into ---
async function getTargetProject() {
  const { data, error } = await supabase
    .from("projects")
    .select("id, name")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    console.error("No projects found. Create one in the app first.", error);
    process.exit(1);
  }
  return data;
}

// --- Upload a file to storage + create project_files record ---
async function uploadFile(projectId, filePath, fileName) {
  const content = readFileSync(filePath);
  const extension = fileName.split(".").pop().toLowerCase();
  const storagePath = `${projectId}/${Date.now()}-v1-${fileName}`;

  // Upload to storage
  const { error: uploadErr } = await supabase.storage
    .from("project-files")
    .upload(storagePath, content, {
      contentType: "application/octet-stream",
    });

  if (uploadErr) {
    console.error(`  Storage upload failed for ${fileName}:`, uploadErr.message);
    return null;
  }

  // Get admin user id for uploaded_by
  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("is_platform_admin", true)
    .limit(1)
    .single();

  const uploadedBy = adminProfile?.id || null;

  // Create file record
  const { data: fileRecord, error: dbErr } = await supabase
    .from("project_files")
    .insert({
      project_id: projectId,
      file_name: fileName,
      file_type: extension,
      file_size: content.length,
      storage_path: storagePath,
      uploaded_by: uploadedBy,
      parsing_status: "pending",
      current_version: 1,
      version_count: 1,
    })
    .select()
    .single();

  if (dbErr) {
    console.error(`  DB insert failed for ${fileName}:`, dbErr.message);
    return null;
  }

  // Create version record
  await supabase.from("file_versions").insert({
    file_id: fileRecord.id,
    version_number: 1,
    storage_path: storagePath,
    file_size: content.length,
    uploaded_by: uploadedBy,
    uploaded_by_email: "test-script@local",
    comment: "Test upload via script",
  });

  console.log(`  Uploaded: ${fileName} (${fileRecord.id})`);
  return fileRecord;
}

// --- Main ---
async function main() {
  console.log("Finding target project...\n");
  const project = await getTargetProject();
  console.log(`Target project: "${project.name}" (${project.id})\n`);

  const files = [
    { path: resolve(__dirname, "WaterTreatment_Main.L5X"), name: "WaterTreatment_Main.L5X" },
    { path: resolve(__dirname, "ConveyorSystem_Line1.L5K"), name: "ConveyorSystem_Line1.L5K" },
  ];

  for (const file of files) {
    console.log(`Uploading ${file.name}...`);
    await uploadFile(project.id, file.path, file.name);
  }

  console.log("\nDone! Open the project in the app and click Parse on each file.");
}

main().catch(console.error);
