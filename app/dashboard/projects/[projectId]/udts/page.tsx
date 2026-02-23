import { notFound } from "next/navigation";
import Link from "next/link";
import { getProjectAccess } from "@/lib/project-access";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Download } from "lucide-react";
import { UDTFilters } from "@/components/tools/udt-filters";
import { UDTTable } from "@/components/tools/udt-table";

interface UDTsPageProps {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{
    search?: string;
    familyType?: string;
    page?: string;
    from?: string;
    sort?: string;
    order?: string;
  }>;
}

const PAGE_SIZE = 25;

export default async function UDTsPage({ params, searchParams }: UDTsPageProps) {
  const { projectId } = await params;
  const { search, familyType, page: pageParam, from: fromParam, sort, order } = await searchParams;
  const sortWhitelist = ["name", "family_type"] as const;
  type SortField = typeof sortWhitelist[number];
  const sortField: SortField = sortWhitelist.includes(sort as SortField) ? (sort as SortField) : "name";
  const ascending = order === "desc" ? false : true;
  const backHref = fromParam === "tools"
    ? "/dashboard/tools/udts"
    : `/dashboard/projects/${projectId}`;
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
          <Button variant="ghost" size="icon" asChild>
            <Link href={backHref}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">User Defined Types</h1>
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

  // Get unique family types for filters
  const { data: familyTypesData } = await supabase
    .from("parsed_udts")
    .select("family_type")
    .in("file_id", fileIds)
    .not("family_type", "is", null);

  const familyTypes = [...new Set(familyTypesData?.map((u) => u.family_type).filter(Boolean) || [])].sort() as string[];

  // Build query for UDTs
  let query = supabase
    .from("parsed_udts")
    .select("id, name, description, family_type, parsed_udt_members(id, name, data_type, dimension, description)", { count: "exact" })
    .in("file_id", fileIds);

  if (search) {
    query = query.ilike("name", `%${search}%`);
  }

  if (familyType && familyType !== "all") {
    query = query.eq("family_type", familyType);
  }

  // Add pagination
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  query = query.order(sortField, { ascending }).range(from, to);

  const { data: udts, count } = await query;

  const exportUrl = `/api/export/udts?projectId=${projectId}${search ? `&search=${search}` : ""}${familyType ? `&familyType=${familyType}` : ""}`;

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
            <h1 className="text-3xl font-bold">User Defined Types</h1>
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
            {count || 0} UDTs found
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UDTFilters familyTypes={familyTypes} />
        </CardContent>
      </Card>

      <UDTTable
        udts={udts || []}
        totalCount={count || 0}
        page={page}
        pageSize={PAGE_SIZE}
      />
    </div>
  );
}
