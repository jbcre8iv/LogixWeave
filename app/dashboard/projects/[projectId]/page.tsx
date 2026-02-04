import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Upload,
  FileText,
  Tags,
  HardDrive,
  Calendar,
  User,
} from "lucide-react";
import { DeleteProjectButton } from "@/components/dashboard/delete-project-button";

interface ProjectPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { projectId } = await params;
  const supabase = await createClient();

  const { data: project, error } = await supabase
    .from("projects")
    .select(`
      *,
      profiles:created_by(full_name, email),
      project_files(
        id,
        file_name,
        file_type,
        file_size,
        parsing_status,
        created_at
      )
    `)
    .eq("id", projectId)
    .single();

  if (error || !project) {
    notFound();
  }

  // Get tag and routine counts
  const fileIds = project.project_files?.map((f: { id: string }) => f.id) || [];

  let tagCount = 0;
  let routineCount = 0;
  let moduleCount = 0;

  if (fileIds.length > 0) {
    const [tagsResult, routinesResult, modulesResult] = await Promise.all([
      supabase
        .from("parsed_tags")
        .select("*", { count: "exact", head: true })
        .in("file_id", fileIds),
      supabase
        .from("parsed_routines")
        .select("*", { count: "exact", head: true })
        .in("file_id", fileIds),
      supabase
        .from("parsed_io_modules")
        .select("*", { count: "exact", head: true })
        .in("file_id", fileIds),
    ]);
    tagCount = tagsResult.count || 0;
    routineCount = routinesResult.count || 0;
    moduleCount = modulesResult.count || 0;
  }

  const creatorName = (project.profiles as { full_name?: string; email?: string })?.full_name ||
                      (project.profiles as { full_name?: string; email?: string })?.email ||
                      "Unknown";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/projects">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{project.name}</h1>
            {project.description && (
              <p className="text-muted-foreground">{project.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild>
            <Link href={`/dashboard/projects/${projectId}/files`}>
              <Upload className="mr-2 h-4 w-4" />
              Manage Files
            </Link>
          </Button>
          <DeleteProjectButton projectId={projectId} projectName={project.name} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link href={`/dashboard/projects/${projectId}/files`}>
          <Card className="transition-colors hover:bg-accent/50 cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Files</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{project.project_files?.length || 0}</div>
              <p className="text-xs text-muted-foreground">L5X/L5K files uploaded</p>
            </CardContent>
          </Card>
        </Link>

        <Link href={`/dashboard/projects/${projectId}/tags`}>
          <Card className="transition-colors hover:bg-accent/50 cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tags</CardTitle>
              <Tags className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{tagCount}</div>
              <p className="text-xs text-muted-foreground">Total tags parsed</p>
            </CardContent>
          </Card>
        </Link>

        <Card className="opacity-60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Routines</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{routineCount}</div>
            <p className="text-xs text-muted-foreground">Coming soon</p>
          </CardContent>
        </Card>

        <Link href={`/dashboard/projects/${projectId}/io`}>
          <Card className="transition-colors hover:bg-accent/50 cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">I/O Modules</CardTitle>
              <HardDrive className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{moduleCount}</div>
              <p className="text-xs text-muted-foreground">Hardware modules</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Project Files</CardTitle>
            <CardDescription>Uploaded L5X/L5K files</CardDescription>
          </CardHeader>
          <CardContent>
            {project.project_files && project.project_files.length > 0 ? (
              <div className="space-y-3">
                {project.project_files.map((file: {
                  id: string;
                  file_name: string;
                  file_type: string;
                  file_size: number;
                  parsing_status: string;
                  created_at: string;
                }) => (
                  <div key={file.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{file.file_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(file.file_size / 1024).toFixed(1)} KB • {file.file_type.toUpperCase()}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={
                        file.parsing_status === "completed"
                          ? "default"
                          : file.parsing_status === "failed"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {file.parsing_status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground mb-4">No files uploaded yet</p>
                <Button asChild size="sm">
                  <Link href={`/dashboard/projects/${projectId}/files`}>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Files
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Project Info</CardTitle>
            <CardDescription>Details and metadata</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Created by</p>
                <p className="font-medium">{creatorName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Created</p>
                <p className="font-medium">
                  {new Date(project.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Last updated</p>
                <p className="font-medium">
                  {new Date(project.updated_at).toLocaleDateString()}
                </p>
              </div>
            </div>
            {(tagCount > 0 || moduleCount > 0) && (
              <div className="pt-4 space-y-2">
                {tagCount > 0 && (
                  <Button asChild variant="outline" className="w-full">
                    <Link href={`/dashboard/projects/${projectId}/tags`}>
                      <Tags className="mr-2 h-4 w-4" />
                      Browse Tags
                    </Link>
                  </Button>
                )}
                {moduleCount > 0 && (
                  <Button asChild variant="outline" className="w-full">
                    <Link href={`/dashboard/projects/${projectId}/io`}>
                      <HardDrive className="mr-2 h-4 w-4" />
                      Explore I/O
                    </Link>
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
