import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Download } from "lucide-react";
import { TagFilters } from "@/components/tools/tag-filters";
import { TagTable } from "@/components/tools/tag-table";

interface TagsPageProps {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{
    search?: string;
    scope?: string;
    dataType?: string;
    page?: string;
    from?: string;
  }>;
}

const PAGE_SIZE = 50;

export default async function TagsPage({ params, searchParams }: TagsPageProps) {
  const { projectId } = await params;
  const { search, scope, dataType, page: pageParam, from: fromParam } = await searchParams;
  const backHref = fromParam === "tools"
    ? "/dashboard/tools/tags"
    : `/dashboard/projects/${projectId}`;
  const page = Math.max(1, parseInt(pageParam || "1", 10));

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

  if (fileIds.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={backHref}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Tag Explorer</h1>
            <p className="text-muted-foreground">{project.name}</p>
          </div>
        </div>
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
      </div>
    );
  }

  // Get unique scopes and data types for filters
  const [scopesResult, dataTypesResult] = await Promise.all([
    supabase
      .from("parsed_tags")
      .select("scope")
      .in("file_id", fileIds)
      .order("scope"),
    supabase
      .from("parsed_tags")
      .select("data_type")
      .in("file_id", fileIds)
      .order("data_type"),
  ]);

  const scopes = [...new Set(scopesResult.data?.map((t) => t.scope) || [])];
  const dataTypes = [...new Set(dataTypesResult.data?.map((t) => t.data_type) || [])];

  // Build query for tags
  let query = supabase
    .from("parsed_tags")
    .select("id, name, data_type, scope, description, usage", { count: "exact" })
    .in("file_id", fileIds);

  if (search) {
    query = query.ilike("name", `%${search}%`);
  }

  if (scope) {
    query = query.eq("scope", scope);
  }

  if (dataType) {
    query = query.eq("data_type", dataType);
  }

  // Add pagination
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  query = query.order("name").range(from, to);

  const { data: tags, count } = await query;

  const exportUrl = `/api/export/tags?projectId=${projectId}${search ? `&search=${search}` : ""}${scope ? `&scope=${scope}` : ""}${dataType ? `&dataType=${dataType}` : ""}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={backHref}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Tag Explorer</h1>
            <p className="text-muted-foreground">{project.name}</p>
          </div>
        </div>
        <Button variant="outline" asChild>
          <a href={exportUrl} download>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </a>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Search & Filter</CardTitle>
          <CardDescription>
            {count || 0} tags found
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TagFilters scopes={scopes} dataTypes={dataTypes} />
        </CardContent>
      </Card>

      <TagTable
        tags={tags || []}
        totalCount={count || 0}
        page={page}
        pageSize={PAGE_SIZE}
      />
    </div>
  );
}
