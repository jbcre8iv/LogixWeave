import { notFound } from "next/navigation";
import Link from "next/link";
import { getProjectAccess } from "@/lib/project-access";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { TagXrefFilters } from "@/components/tools/tag-xref-filters";
import { TagXrefTable } from "@/components/tools/tag-xref-table";
import { ExportCSVButton } from "@/components/export-csv-button";

interface TagXrefPageProps {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{
    search?: string;
    usageType?: string;
    program?: string;
    page?: string;
    sort?: string;
    order?: string;
  }>;
}

const PAGE_SIZE = 50;

export default async function TagXrefPage({ params, searchParams }: TagXrefPageProps) {
  const { projectId } = await params;
  const { search, usageType, program, page: pageParam, sort, order } = await searchParams;
  const page = Math.max(1, parseInt(pageParam || "1", 10));

  const sortWhitelist = ["tag_name", "program_name", "routine_name", "rung_number", "usage_type"] as const;
  type SortField = typeof sortWhitelist[number];
  const sortField: SortField = sortWhitelist.includes(sort as SortField) ? (sort as SortField) : "tag_name";
  const ascending = order === "desc" ? false : true;

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
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/dashboard/projects/${projectId}/analysis`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Tag Cross-Reference</h1>
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

  // Get unique programs for filters
  const { data: programsData } = await supabase
    .from("tag_references")
    .select("program_name")
    .in("file_id", fileIds);

  const programs = [...new Set(programsData?.map((p) => p.program_name) || [])].sort();

  // Build query for tag references
  let query = supabase
    .from("tag_references")
    .select("*", { count: "exact" })
    .in("file_id", fileIds);

  if (search) {
    query = query.ilike("tag_name", `%${search}%`);
  }

  if (usageType && usageType !== "all") {
    query = query.eq("usage_type", usageType);
  }

  if (program && program !== "all") {
    query = query.eq("program_name", program);
  }

  // Add pagination
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  query = query.order(sortField, { ascending }).range(from, to);

  const { data: references, count } = await query;

  // Fetch all references (no pagination) for CSV export
  let allQuery = supabase
    .from("tag_references")
    .select("*")
    .in("file_id", fileIds);

  if (search) {
    allQuery = allQuery.ilike("tag_name", `%${search}%`);
  }
  if (usageType && usageType !== "all") {
    allQuery = allQuery.eq("usage_type", usageType);
  }
  if (program && program !== "all") {
    allQuery = allQuery.eq("program_name", program);
  }

  allQuery = allQuery.order("tag_name").order("program_name").order("routine_name");

  const { data: allReferences } = await allQuery;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/dashboard/projects/${projectId}/analysis`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Tag Cross-Reference</h1>
            <p className="text-muted-foreground">{project.name}</p>
          </div>
        </div>
        {(allReferences?.length ?? 0) > 0 && (
          <ExportCSVButton
            filename="tag_cross_reference.csv"
            data={[
              ["Tag Name", "Program", "Routine", "Rung", "Usage Type"],
              ...(allReferences || []).map((ref) => [
                ref.tag_name,
                ref.program_name,
                ref.routine_name,
                String(ref.rung_number),
                ref.usage_type,
              ]),
            ]}
          />
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Search & Filter</CardTitle>
          <CardDescription>
            {count || 0} tag references found
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TagXrefFilters programs={programs} />
        </CardContent>
      </Card>

      <TagXrefTable
        references={references || []}
        totalCount={count || 0}
        page={page}
        pageSize={PAGE_SIZE}
      />
    </div>
  );
}
