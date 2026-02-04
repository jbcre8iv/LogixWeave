// Project I/O Module Explorer Page
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Download } from "lucide-react";
import { IOFilters } from "@/components/tools/io-filters";
import { IOTable } from "@/components/tools/io-table";

interface IOPageProps {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{
    search?: string;
    catalogNumber?: string;
    parentModule?: string;
    page?: string;
  }>;
}

const PAGE_SIZE = 50; // Items per page

export default async function IOPage({ params, searchParams }: IOPageProps) {
  const { projectId } = await params;
  const { search, catalogNumber, parentModule, page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam || "1", 10));

  const supabase = await createClient();

  // Get project info
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, name, project_files(id, original_name)")
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
            <Link href={`/dashboard/projects/${projectId}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">I/O Mapping</h1>
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

  // Get unique catalog numbers and parent modules for filters
  const [catalogNumbersResult, parentModulesResult] = await Promise.all([
    supabase
      .from("parsed_io_modules")
      .select("catalog_number")
      .in("file_id", fileIds)
      .not("catalog_number", "is", null)
      .order("catalog_number"),
    supabase
      .from("parsed_io_modules")
      .select("parent_module")
      .in("file_id", fileIds)
      .not("parent_module", "is", null)
      .order("parent_module"),
  ]);

  const catalogNumbers = [...new Set(catalogNumbersResult.data?.map((m) => m.catalog_number).filter(Boolean) || [])] as string[];
  const parentModules = [...new Set(parentModulesResult.data?.map((m) => m.parent_module).filter(Boolean) || [])] as string[];

  // Create file ID to name mapping
  const fileMap = new Map(
    project.project_files?.map((f: { id: string; original_name: string }) => [f.id, f.original_name]) || []
  );

  // Build query for modules
  let query = supabase
    .from("parsed_io_modules")
    .select("id, name, catalog_number, parent_module, slot, connection_info, file_id", { count: "exact" })
    .in("file_id", fileIds);

  if (search) {
    query = query.ilike("name", `%${search}%`);
  }

  if (catalogNumber) {
    query = query.eq("catalog_number", catalogNumber);
  }

  if (parentModule) {
    query = query.eq("parent_module", parentModule);
  }

  // Add pagination
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  query = query.order("name").range(from, to);

  const { data: modules, count } = await query;

  // Add file names to modules
  const modulesWithFileNames = (modules || []).map((m) => ({
    ...m,
    file_name: fileMap.get(m.file_id) || undefined,
  }));

  const exportUrl = `/api/export/io?projectId=${projectId}${search ? `&search=${search}` : ""}${catalogNumber ? `&catalogNumber=${catalogNumber}` : ""}${parentModule ? `&parentModule=${parentModule}` : ""}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/dashboard/projects/${projectId}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">I/O Mapping</h1>
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
            {count || 0} I/O modules found
          </CardDescription>
        </CardHeader>
        <CardContent>
          <IOFilters catalogNumbers={catalogNumbers} parentModules={parentModules} />
        </CardContent>
      </Card>

      <IOTable
        modules={modulesWithFileNames}
        totalCount={count || 0}
        page={page}
        pageSize={PAGE_SIZE}
      />
    </div>
  );
}
