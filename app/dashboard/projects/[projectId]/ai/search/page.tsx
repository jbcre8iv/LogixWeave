import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Search } from "lucide-react";
import { AISearch } from "@/components/ai/ai-search";

interface SearchPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function AISearchPage({ params }: SearchPageProps) {
  const { projectId } = await params;

  const supabase = await createClient();

  // Get project info
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
  const hasData = completedFiles.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/dashboard/projects/${projectId}/ai`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Search className="h-8 w-8 text-amber-500" />
            AI Search
          </h1>
          <p className="text-muted-foreground">{project.name}</p>
        </div>
      </div>

      {!hasData ? (
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
            <CardTitle>Natural Language Search</CardTitle>
            <CardDescription>
              Search your project using natural language. For example: "Find tags related to pump control"
              or "Show me motor speed variables"
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AISearch projectId={projectId} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
