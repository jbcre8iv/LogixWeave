import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Brain, Search, AlertTriangle, Sparkles, ArrowRight, HeartPulse } from "lucide-react";

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
      description: "Scan for potential bugs, anti-patterns, and improvements in your code",
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
      {/* Hero Header */}
      <Card className="border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent">
        <CardContent className="py-8 px-6">
          <div className="flex items-start gap-5">
            <div className="rounded-full bg-amber-500/10 p-3 ring-1 ring-amber-500/20">
              <Sparkles className="h-7 w-7 text-amber-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">AI Assistant</h1>
              <p className="text-sm text-muted-foreground mt-0.5">{project.name}</p>
              <p className="text-sm text-muted-foreground mt-3 max-w-xl leading-relaxed">
                Analyze your PLC code, get explanations of complex logic, find potential issues, and search your project using natural language.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

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
          {/* Featured: Project Health Coach */}
          <Link href={`/dashboard/projects/${projectId}/ai/health`}>
            <Card className="group hover:shadow-lg hover:shadow-amber-500/5 hover:border-amber-500/30 transition-all cursor-pointer">
              <CardContent className="py-8 px-6">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-5">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-amber-500/15 to-orange-500/10 shrink-0">
                        <HeartPulse className="h-7 w-7 text-amber-500" />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold">Project Health Coach</h2>
                        <p className="text-sm text-muted-foreground mt-1">
                          Get a comprehensive health score with AI-powered recommendations to improve your project
                        </p>
                        <p className="text-xs text-muted-foreground/60 mt-2">
                          Results are cached for faster repeat queries
                        </p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="shrink-0 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400 gap-1.5">
                      Get Started
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
            </Card>
          </Link>

          {/* AI Tool Cards */}
          <div className="space-y-3 mt-6">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground px-1">More Tools</h3>
            <div className="grid gap-4 md:grid-cols-3">
              {aiTools.map((tool) => (
                <Link key={tool.href} href={tool.href}>
                  <Card className="group h-full border-border/60 hover:shadow-lg hover:shadow-amber-500/5 hover:border-amber-500/30 transition-all cursor-pointer">
                    <CardContent className="py-4 px-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 group-hover:bg-amber-500/15 transition-colors shrink-0 mt-0.5">
                          <tool.icon className="h-4.5 w-4.5 text-amber-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold">{tool.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{tool.description}</p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-amber-500 transition-colors shrink-0 mt-1" />
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
