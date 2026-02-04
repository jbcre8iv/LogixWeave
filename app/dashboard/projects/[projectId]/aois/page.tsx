import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Download } from "lucide-react";
import { AOIFilters } from "@/components/tools/aoi-filters";
import { AOITable } from "@/components/tools/aoi-table";

interface AOIsPageProps {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{
    search?: string;
    vendor?: string;
    page?: string;
  }>;
}

const PAGE_SIZE = 25;

export default async function AOIsPage({ params, searchParams }: AOIsPageProps) {
  const { projectId } = await params;
  const { search, vendor, page: pageParam } = await searchParams;
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
            <Link href={`/dashboard/projects/${projectId}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Add-On Instructions</h1>
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

  // Get unique vendors for filters
  const { data: vendorsData } = await supabase
    .from("parsed_aois")
    .select("vendor")
    .in("file_id", fileIds)
    .not("vendor", "is", null);

  const vendors = [...new Set(vendorsData?.map((a) => a.vendor).filter(Boolean) || [])].sort() as string[];

  // Build query for AOIs with related data
  let query = supabase
    .from("parsed_aois")
    .select(`
      id, name, description, revision, vendor, created_by, edited_by,
      parsed_aoi_parameters(id, name, data_type, usage, required, visible, description),
      parsed_aoi_local_tags(id, name, data_type, description),
      parsed_aoi_routines(id, name, type, rung_count)
    `, { count: "exact" })
    .in("file_id", fileIds);

  if (search) {
    query = query.ilike("name", `%${search}%`);
  }

  if (vendor && vendor !== "all") {
    query = query.eq("vendor", vendor);
  }

  // Add pagination
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  query = query.order("name").range(from, to);

  const { data: aois, count } = await query;

  const exportUrl = `/api/export/aois?projectId=${projectId}${search ? `&search=${search}` : ""}${vendor ? `&vendor=${vendor}` : ""}`;

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
            <h1 className="text-3xl font-bold">Add-On Instructions</h1>
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
            {count || 0} AOIs found
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AOIFilters vendors={vendors} />
        </CardContent>
      </Card>

      <AOITable
        aois={aois || []}
        totalCount={count || 0}
        page={page}
        pageSize={PAGE_SIZE}
      />
    </div>
  );
}
