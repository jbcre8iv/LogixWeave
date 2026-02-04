import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { DocumentationGenerator } from "@/components/tools/documentation-generator";

interface DocumentationPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function DocumentationPage({ params }: DocumentationPageProps) {
  const { projectId } = await params;

  const supabase = await createClient();

  // Get project info with counts
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, name, project_files(id, parsing_status)")
    .eq("id", projectId)
    .single();

  if (projectError || !project) {
    notFound();
  }

  const completedFiles = project.project_files?.filter(
    (f: { parsing_status: string }) => f.parsing_status === "completed"
  ) || [];
  const fileIds = completedFiles.map((f: { id: string }) => f.id);

  // Get counts for each section
  let counts = {
    tags: 0,
    routines: 0,
    ioModules: 0,
    udts: 0,
    aois: 0,
  };

  if (fileIds.length > 0) {
    const [tagsResult, routinesResult, modulesResult, udtsResult, aoisResult] = await Promise.all([
      supabase.from("parsed_tags").select("id", { count: "exact" }).in("file_id", fileIds),
      supabase.from("parsed_routines").select("id", { count: "exact" }).in("file_id", fileIds),
      supabase.from("parsed_io_modules").select("id", { count: "exact" }).in("file_id", fileIds),
      supabase.from("parsed_udts").select("id", { count: "exact" }).in("file_id", fileIds),
      supabase.from("parsed_aois").select("id", { count: "exact" }).in("file_id", fileIds),
    ]);

    counts = {
      tags: tagsResult.count || 0,
      routines: routinesResult.count || 0,
      ioModules: modulesResult.count || 0,
      udts: udtsResult.count || 0,
      aois: aoisResult.count || 0,
    };
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/dashboard/projects/${projectId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Documentation Generator</h1>
          <p className="text-muted-foreground">{project.name}</p>
        </div>
      </div>

      {fileIds.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">
              No parsed files found. Please upload and parse L5X files first.
            </p>
            <Button asChild>
              <Link href={`/dashboard/projects/${projectId}/files`}>
                Upload Files
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Generate As-Built Documentation</CardTitle>
            <CardDescription>
              Select the sections to include in your documentation export.
              The documentation will be generated in Markdown format.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DocumentationGenerator
              projectId={projectId}
              projectName={project.name}
              counts={counts}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
