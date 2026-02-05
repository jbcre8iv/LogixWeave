import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Brain } from "lucide-react";
import { LogicExplainer } from "@/components/ai/logic-explainer";

interface ExplainPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ExplainPage({ params }: ExplainPageProps) {
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
  const fileIds = completedFiles.map((f: { id: string }) => f.id);

  if (fileIds.length === 0) {
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
              <Brain className="h-8 w-8 text-amber-500" />
              Logic Explainer
            </h1>
            <p className="text-muted-foreground">{project.name}</p>
          </div>
        </div>
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
      </div>
    );
  }

  // Get routines for selection
  const { data: routines } = await supabase
    .from("parsed_routines")
    .select("name, program_name, type, rung_count")
    .in("file_id", fileIds)
    .eq("type", "RLL") // Only ladder logic routines
    .order("program_name")
    .order("name");

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
            <Brain className="h-8 w-8 text-amber-500" />
            Logic Explainer
          </h1>
          <p className="text-muted-foreground">{project.name}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Explain Ladder Logic</CardTitle>
          <CardDescription>
            Select a routine to get a plain-English explanation of its logic.
            The AI will analyze the code and explain what each rung does.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LogicExplainer
            projectId={projectId}
            routines={routines || []}
          />
        </CardContent>
      </Card>
    </div>
  );
}
