import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, GitCompare, TagsIcon, MessageSquare, AlertTriangle, ArrowRight, FileCheck } from "lucide-react";

interface AnalysisPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function AnalysisPage({ params }: AnalysisPageProps) {
  const { projectId } = await params;

  const supabase = await createClient();

  // Get project info
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, name, project_files(id)")
    .eq("id", projectId)
    .single();

  if (projectError || !project) {
    notFound();
  }

  const fileIds = project.project_files?.map((f: { id: string }) => f.id) || [];

  // Fetch summary statistics
  let stats = {
    totalTags: 0,
    unusedTags: 0,
    totalRungs: 0,
    commentedRungs: 0,
    commentCoverage: 0,
    totalReferences: 0,
  };

  if (fileIds.length > 0) {
    const [tagsResult, referencesResult, rungsResult] = await Promise.all([
      supabase.from("parsed_tags").select("id, name").in("file_id", fileIds),
      supabase.from("tag_references").select("id, tag_name").in("file_id", fileIds),
      supabase.from("parsed_rungs").select("id, comment").in("file_id", fileIds),
    ]);

    const allTags = tagsResult.data || [];
    const references = referencesResult.data || [];
    const rungs = rungsResult.data || [];

    const referencedTagNames = new Set(references.map((r) => r.tag_name));
    const unusedTags = allTags.filter((tag) => {
      const baseName = tag.name.split("[")[0];
      return !referencedTagNames.has(tag.name) && !referencedTagNames.has(baseName);
    });

    const commentedRungs = rungs.filter((r) => r.comment && r.comment.trim() !== "").length;

    stats = {
      totalTags: allTags.length,
      unusedTags: unusedTags.length,
      totalRungs: rungs.length,
      commentedRungs,
      commentCoverage: rungs.length > 0 ? Math.round((commentedRungs / rungs.length) * 100) : 0,
      totalReferences: references.length,
    };
  }

  const analysisTools = [
    {
      title: "Tag Cross-Reference",
      description: "See where each tag is used across routines and rungs",
      href: `/dashboard/projects/${projectId}/analysis/tag-xref`,
      icon: GitCompare,
      stat: `${stats.totalReferences.toLocaleString()} references`,
    },
    {
      title: "Unused Tags",
      description: "Find tags with no references in the ladder logic",
      href: `/dashboard/projects/${projectId}/analysis/unused-tags`,
      icon: TagsIcon,
      stat: `${stats.unusedTags.toLocaleString()} unused`,
      highlight: stats.unusedTags > 0,
    },
    {
      title: "Comment Coverage",
      description: "Check which rungs have comments and documentation",
      href: `/dashboard/projects/${projectId}/analysis/comment-coverage`,
      icon: MessageSquare,
      stat: `${stats.commentCoverage}% coverage`,
      highlight: stats.commentCoverage < 50,
    },
    {
      title: "Naming Validation",
      description: "Check tag names against organization naming rules",
      href: `/dashboard/projects/${projectId}/analysis/naming`,
      icon: FileCheck,
      stat: "Run validation",
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
          <h1 className="text-3xl font-bold">Analysis</h1>
          <p className="text-muted-foreground">{project.name}</p>
        </div>
      </div>

      {fileIds.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">
              No files have been uploaded to this project yet.
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
          {/* Summary Stats */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Tags</CardDescription>
                <CardTitle className="text-3xl">{stats.totalTags.toLocaleString()}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Rungs</CardDescription>
                <CardTitle className="text-3xl">{stats.totalRungs.toLocaleString()}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Tag References</CardDescription>
                <CardTitle className="text-3xl">{stats.totalReferences.toLocaleString()}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          {/* Analysis Tools */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {analysisTools.map((tool) => (
              <Link key={tool.href} href={tool.href}>
                <Card className={`h-full hover:bg-accent/50 transition-colors cursor-pointer ${
                  tool.highlight ? "border-yellow-500/50" : ""
                }`}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <tool.icon className="h-5 w-5 text-muted-foreground" />
                        <CardTitle className="text-lg">{tool.title}</CardTitle>
                      </div>
                      {tool.highlight && (
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      )}
                    </div>
                    <CardDescription>{tool.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-medium ${
                        tool.highlight ? "text-yellow-500" : "text-muted-foreground"
                      }`}>
                        {tool.stat}
                      </span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
