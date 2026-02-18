import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, HeartPulse } from "lucide-react";
import { HealthCoach } from "@/components/ai/health-coach";

interface HealthPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function HealthPage({ params }: HealthPageProps) {
  const { projectId } = await params;

  const supabase = await createClient();

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
      {!hasData ? (
        <>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href={`/dashboard/projects/${projectId}/analysis`}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <HeartPulse className="h-8 w-8 text-amber-500" />
                Project Health Analysis
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
        </>
      ) : (
        <HealthCoach projectId={projectId} projectName={project.name} />
      )}
    </div>
  );
}
