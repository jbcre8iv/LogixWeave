import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { FileUploader } from "@/components/tools/file-uploader";
import { DownloadAllButton } from "@/components/tools/download-all-button";
import { FileBrowser } from "@/components/tools/file-browser";

interface FilesPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function FilesPage({ params }: FilesPageProps) {
  const { projectId } = await params;
  const supabase = await createClient();

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

      <Card>
        <CardHeader>
          <CardTitle>Upload Files</CardTitle>
          <CardDescription>
            Upload L5X or L5K files exported from Studio 5000. Files will be automatically
            parsed after upload.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FileUploader projectId={projectId} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Uploaded Files</CardTitle>
              <CardDescription>
                {files.length} file{files.length !== 1 ? "s" : ""}{folders.length > 0 ? ` in ${folders.length} folder${folders.length !== 1 ? "s" : ""}` : ""} in this project
              </CardDescription>
            </div>
            <DownloadAllButton
              projectId={projectId}
              projectName={project.name}
              fileCount={files.length}
            />
          </div>
        </CardHeader>
        <CardContent>
          <FileBrowser
            projectId={projectId}
            files={files}
            folders={folders}
          />
        </CardContent>
      </Card>
    </div>
  );
}
