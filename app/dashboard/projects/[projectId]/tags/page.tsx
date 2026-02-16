import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Download } from "lucide-react";
import { TagFilters } from "@/components/tools/tag-filters";
import { TagTable } from "@/components/tools/tag-table";
import { ReferencedTagsTable } from "@/components/tools/referenced-tags-table";

interface TagsPageProps {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{
    search?: string;
    scope?: string;
    dataType?: string;
    page?: string;
    from?: string;
    tab?: string;
  }>;
}

const PAGE_SIZE = 50;

export default async function TagsPage({ params, searchParams }: TagsPageProps) {
  const { projectId } = await params;
  const { search, scope, dataType, page: pageParam, from: fromParam, tab } = await searchParams;
  const activeTab = tab || "definitions";
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

  // Query referenced tags (discovered from rung logic)
  let refQuery = supabase
    .from("tag_references")
    .select("tag_name, usage_type, routine_name, program_name")
    .in("file_id", fileIds);

  if (search && activeTab === "references") {
    refQuery = refQuery.ilike("tag_name", `%${search}%`);
  }

  const { data: allRefs } = await refQuery.order("tag_name");

  // Aggregate referenced tags: unique tag names with usage counts and types
  const refTagMap = new Map<string, { count: number; usageTypes: Set<string>; routines: Set<string> }>();
  for (const ref of allRefs || []) {
    const existing = refTagMap.get(ref.tag_name);
    if (existing) {
      existing.count++;
      existing.usageTypes.add(ref.usage_type);
      existing.routines.add(`${ref.program_name}/${ref.routine_name}`);
    } else {
      refTagMap.set(ref.tag_name, {
        count: 1,
        usageTypes: new Set([ref.usage_type]),
        routines: new Set([`${ref.program_name}/${ref.routine_name}`]),
      });
    }
  }

  const referencedTags = Array.from(refTagMap.entries())
    .map(([name, info]) => ({
      name,
      referenceCount: info.count,
      usageTypes: Array.from(info.usageTypes),
      routines: Array.from(info.routines),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Paginate referenced tags
  const refFrom = (page - 1) * PAGE_SIZE;
  const refTo = refFrom + PAGE_SIZE;
  const paginatedRefTags = referencedTags.slice(refFrom, refTo);
  const refTotalCount = referencedTags.length;

  const exportUrl = activeTab === "references"
    ? `/api/export/tags?projectId=${projectId}&type=references${search ? `&search=${search}` : ""}`
    : `/api/export/tags?projectId=${projectId}${search ? `&search=${search}` : ""}${scope ? `&scope=${scope}` : ""}${dataType ? `&dataType=${dataType}` : ""}`;

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

      {/* Tab switcher */}
      <div className="flex gap-1 border-b">
        <Link
          href={`/dashboard/projects/${projectId}/tags?tab=definitions${fromParam ? `&from=${fromParam}` : ""}`}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === "definitions"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Tag Definitions ({count || 0})
        </Link>
        <Link
          href={`/dashboard/projects/${projectId}/tags?tab=references${fromParam ? `&from=${fromParam}` : ""}`}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === "references"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Referenced Tags ({refTotalCount})
        </Link>
      </div>

      {activeTab === "definitions" ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Search & Filter</CardTitle>
              <CardDescription>
                {count || 0} tag definitions found
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
        </>
      ) : (
        <ReferencedTagsTable
          tags={paginatedRefTags}
          totalCount={refTotalCount}
          page={page}
          pageSize={PAGE_SIZE}
          projectId={projectId}
          search={search}
        />
      )}
    </div>
  );
}
