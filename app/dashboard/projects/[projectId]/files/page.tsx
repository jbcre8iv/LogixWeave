import { notFound } from "next/navigation";
import Link from "next/link";
import { getProjectAccess } from "@/lib/project-access";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { FileManagementClient } from "@/components/tools/file-management-client";

interface FilesPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function FilesPage({ params }: FilesPageProps) {
  const { projectId } = await params;
  const access = await getProjectAccess();
  if (!access) notFound();
  const { supabase } = access;

  const { data: project, error } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", projectId)
    .single();

  if (error || !project) {
    notFound();
  }

  // Fetch files and folders in parallel
  const [filesResult, foldersResult] = await Promise.all([
    supabase
      .from("project_files")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false }),
    supabase
      .from("project_folders")
      .select("*")
      .eq("project_id", projectId)
      .order("name"),
  ]);

  const files = filesResult.data || [];
  const folders = foldersResult.data || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/dashboard/projects/${projectId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">File Management</h1>
          <p className="text-muted-foreground">{project.name}</p>
        </div>
      </div>

      <FileManagementClient
        projectId={projectId}
        projectName={project.name}
        files={files}
        folders={folders}
      />
    </div>
  );
}
