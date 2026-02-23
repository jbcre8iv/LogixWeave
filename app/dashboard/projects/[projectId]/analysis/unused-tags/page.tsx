import { notFound } from "next/navigation";
import Link from "next/link";
import { getProjectAccess } from "@/lib/project-access";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { BackButton } from "@/components/back-button";
import { TagFilters } from "@/components/tools/tag-filters";
import { TagTable } from "@/components/tools/tag-table";
import { ExportCSVButton } from "@/components/export-csv-button";

interface UnusedTagsPageProps {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{
    search?: string;
    scope?: string;
    dataType?: string;
    page?: string;
  }>;
}

const PAGE_SIZE = 50;

export default async function UnusedTagsPage({ params, searchParams }: UnusedTagsPageProps) {
  const { projectId } = await params;
  const { search, scope, dataType, page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam || "1", 10));

  const access = await getProjectAccess();
  if (!access) notFound();
  const { supabase } = access;

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
          <BackButton />
          <div>
            <h1 className="text-3xl font-bold">Unused Tags</h1>
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

  // Get all tags and references
  const [tagsResult, referencesResult, scopesResult, dataTypesResult] = await Promise.all([
    supabase
      .from("parsed_tags")
      .select("id, name, data_type, scope, description, usage")
      .in("file_id", fileIds),
    supabase
      .from("tag_references")
      .select("tag_name")
      .in("file_id", fileIds),
    supabase
      .from("parsed_tags")
      .select("scope")
      .in("file_id", fileIds),
    supabase
      .from("parsed_tags")
      .select("data_type")
      .in("file_id", fileIds),
  ]);

  const allTags = tagsResult.data || [];
  const referencedTagNames = new Set(referencesResult.data?.map((r) => r.tag_name) || []);
  const scopes = [...new Set(scopesResult.data?.map((t) => t.scope) || [])].sort();
  const dataTypes = [...new Set(dataTypesResult.data?.map((t) => t.data_type) || [])].sort();

  // Find unused tags
  let unusedTags = allTags.filter((tag) => {
    // Check if tag name or any base part of the tag is referenced
    const tagParts = tag.name.split(".");
    for (let i = 1; i <= tagParts.length; i++) {
      const partialName = tagParts.slice(0, i).join(".");
      if (referencedTagNames.has(partialName)) {
        return false;
      }
    }
    // Also check array base names
    const baseName = tag.name.split("[")[0];
    if (referencedTagNames.has(baseName)) {
      return false;
    }
    return !referencedTagNames.has(tag.name);
  });

  // Apply filters
  if (search) {
    const searchLower = search.toLowerCase();
    unusedTags = unusedTags.filter((tag) =>
      tag.name.toLowerCase().includes(searchLower)
    );
  }

  if (scope && scope !== "all") {
    unusedTags = unusedTags.filter((tag) => tag.scope === scope);
  }

  if (dataType && dataType !== "all") {
    unusedTags = unusedTags.filter((tag) => tag.data_type === dataType);
  }

  // Sort by name
  unusedTags.sort((a, b) => a.name.localeCompare(b.name));

  // Get total count before pagination
  const totalCount = unusedTags.length;

  // Apply pagination
  const from = (page - 1) * PAGE_SIZE;
  const paginatedTags = unusedTags.slice(from, from + PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <BackButton />
          <div>
            <h1 className="text-3xl font-bold">Unused Tags</h1>
            <p className="text-muted-foreground">{project.name}</p>
          </div>
        </div>
        {unusedTags.length > 0 && (
          <ExportCSVButton
            filename="unused_tags.csv"
            data={[
              ["Name", "Data Type", "Scope", "Usage", "Description"],
              ...unusedTags.map((tag) => [
                tag.name,
                tag.data_type,
                tag.scope,
                tag.usage || "",
                tag.description || "",
              ]),
            ]}
          />
        )}
      </div>

      {totalCount > 0 && (
        <Card className="border-yellow-500/50 bg-yellow-500/5">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="font-medium">
                  {totalCount} potentially unused tag{totalCount === 1 ? "" : "s"} found
                </p>
                <p className="text-sm text-muted-foreground">
                  These tags have no references in the ladder logic. They may be unused or referenced indirectly.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Search & Filter</CardTitle>
          <CardDescription>
            Showing {paginatedTags.length} of {totalCount} unused tags
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TagFilters scopes={scopes} dataTypes={dataTypes} />
        </CardContent>
      </Card>

      <TagTable
        tags={paginatedTags}
        totalCount={totalCount}
        page={page}
        pageSize={PAGE_SIZE}
      />
    </div>
  );
}
