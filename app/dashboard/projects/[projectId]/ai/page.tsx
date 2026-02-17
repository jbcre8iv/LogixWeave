import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Brain, Search, AlertTriangle, Sparkles, ArrowRight, HeartPulse } from "lucide-react";

interface AIPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function AIPage({ params }: AIPageProps) {
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

  const aiTools = [
    {
      title: "Logic Explainer",
      description: "Get clear, intuitive explanations of ladder logic rungs and routines",
      href: `/dashboard/projects/${projectId}/ai/explain`,
      icon: Brain,
    },
    {
      title: "Issue Finder",
      description: "Scan for potential bugs, anti-patterns, and improvements",
      href: `/dashboard/projects/${projectId}/ai/issues`,
      icon: AlertTriangle,
    },
    {
      title: "Natural Language Search",
      description: "Search your project using natural language queries",
      href: `/dashboard/projects/${projectId}/ai/search`,
      icon: Search,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/dashboard/projects/${projectId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Sparkles className="h-8 w-8 text-amber-500" />
            AI Assistant
          </h1>
          <p className="text-muted-foreground">{project.name}</p>
        </div>
      </div>

      {!hasData ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">
              No parsed files found. Please upload and parse L5X files to use AI features.
            </p>
            <Button asChild>
              <Link href={`/dashboard/projects/${projectId}/files`}>
                Upload Files
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border-amber-500/20">
            <CardContent className="py-6">
              <div className="flex items-start gap-4">
                <Sparkles className="h-6 w-6 text-amber-500 mt-1" />
                <div>
                  <h3 className="font-semibold mb-1">AI-Powered Analysis</h3>
                  <p className="text-sm text-muted-foreground">
                    Use AI to analyze your PLC code, get explanations of complex logic,
                    find potential issues, and search your project using natural language.
                    Results are cached for faster repeat queries.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Featured: Project Health Coach */}
          <Link href={`/dashboard/projects/${projectId}/ai/health`}>
            <Card className="group border-l-4 border-l-amber-500 hover:border-amber-500/30 hover:shadow-md hover:shadow-amber-500/5 transition-all cursor-pointer">
              <CardContent className="py-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-500/10">
                      <HeartPulse className="h-6 w-6 text-amber-500" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Project Health Coach</CardTitle>
                      <CardDescription className="mt-0.5">
                        Get a comprehensive health score with AI-powered recommendations to improve your project
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-4 text-amber-600 dark:text-amber-400 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                    Get Started
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Other AI tools */}
          <div className="space-y-2">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground px-1">More Tools</h3>
            <div className="grid gap-3 md:grid-cols-3">
              {aiTools.map((tool) => (
                <Link key={tool.href} href={tool.href}>
                  <Card className="group h-full border-border/60 hover:bg-muted/50 hover:border-amber-500/30 transition-colors cursor-pointer">
                    <CardContent className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <tool.icon className="h-4 w-4 text-muted-foreground group-hover:text-amber-500 transition-colors shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{tool.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{tool.description}</p>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-amber-500 transition-colors shrink-0 ml-auto" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
