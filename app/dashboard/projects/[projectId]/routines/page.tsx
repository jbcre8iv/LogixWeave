import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Download } from "lucide-react";
import { RoutineFilters } from "@/components/tools/routine-filters";
import { RoutineTable } from "@/components/tools/routine-table";

interface RoutinesPageProps {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{
    search?: string;
    program?: string;
    type?: string;
    page?: string;
  }>;
}

const PAGE_SIZE = 50;

export default async function RoutinesPage({ params, searchParams }: RoutinesPageProps) {
  const { projectId } = await params;
  const { search, program, type, page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam || "1", 10));

  const supabase = await createClient();

  // Get project info
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, name, project_files(id, file_name)")
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
            <h1 className="text-3xl font-bold">Routines</h1>
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

  // Get unique programs and types for filters
  const [programsResult, typesResult] = await Promise.all([
    supabase
      .from("parsed_routines")
      .select("program_name")
      .in("file_id", fileIds)
      .order("program_name"),
    supabase
      .from("parsed_routines")
      .select("type")
      .in("file_id", fileIds)
      .order("type"),
  ]);

  const programs = [...new Set(programsResult.data?.map((r) => r.program_name).filter(Boolean) || [])] as string[];
  const types = [...new Set(typesResult.data?.map((r) => r.type).filter(Boolean) || [])] as string[];

  // Create file ID to name mapping
  const fileMap = new Map(
    project.project_files?.map((f: { id: string; file_name: string }) => [f.id, f.file_name]) || []
  );

  // Build query for routines
  let query = supabase
    .from("parsed_routines")
    .select("id, name, program_name, type, description, rung_count, file_id", { count: "exact" })
    .in("file_id", fileIds);

  if (search) {
    query = query.ilike("name", `%${search}%`);
  }

  if (program) {
    query = query.eq("program_name", program);
  }

  if (type) {
    query = query.eq("type", type);
  }

  // Add pagination
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  query = query.order("program_name").order("name").range(from, to);

  const { data: routines, count } = await query;

  // Add file names to routines
  const routinesWithFileNames = (routines || []).map((r) => ({
    ...r,
    file_name: fileMap.get(r.file_id) || undefined,
  }));

  const exportUrl = `/api/export/routines?projectId=${projectId}${search ? `&search=${search}` : ""}${program ? `&program=${program}` : ""}${type ? `&type=${type}` : ""}`;

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
            <h1 className="text-3xl font-bold">Routines</h1>
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
            {count || 0} routines found
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RoutineFilters programs={programs} types={types} />
        </CardContent>
      </Card>

      <RoutineTable
        routines={routinesWithFileNames}
        totalCount={count || 0}
        page={page}
        pageSize={PAGE_SIZE}
      />
    </div>
  );
}
