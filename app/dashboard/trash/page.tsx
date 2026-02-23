import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { Trash2 } from "lucide-react";
import { TrashList } from "@/components/dashboard/trash-list";

export default async function TrashPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // Fetch trashed projects owned by this user
  const { data: trashedProjects } = await supabase
    .from("projects")
    .select("id, name, deleted_at, project_files(id)")
    .eq("created_by", user.id)
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });

  const projects = (trashedProjects || []).map((p) => ({
    id: p.id,
    name: p.name,
    deleted_at: p.deleted_at!,
    file_count: Array.isArray(p.project_files) ? p.project_files.length : 0,
  }));

  // Best-effort lazy purge of expired trash
  try {
    const serviceSupabase = createServiceClient();
    serviceSupabase.rpc("purge_expired_trash").then(() => {});
  } catch {
    // Non-blocking — ignore errors
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Trash2 className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl md:text-3xl font-bold">Trash</h1>
        </div>
        <p className="text-muted-foreground text-sm md:text-base mt-1">
          Projects in the trash are automatically deleted after 30 days
        </p>
      </div>

      <TrashList projects={projects} />
    </div>
  );
}
