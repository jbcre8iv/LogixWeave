import { createClient } from "@/lib/supabase/server";
import { CompareSelector } from "@/components/tools/compare-selector";

export default async function ProjectComparePage() {
  const supabase = await createClient();

  // Get all projects with their files
  const { data: projects } = await supabase
    .from("projects")
    .select(`
      id,
      name,
      project_files(id, file_name, parsing_status)
    `)
    .order("name");

  // Filter to only include projects with completed parsed files
  const projectsWithFiles = (projects || [])
    .map((project) => ({
      ...project,
      project_files: (project.project_files || []).filter(
        (f: { parsing_status: string }) => f.parsing_status === "completed"
      ),
    }))
    .filter((project) => project.project_files.length > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Project Compare</h1>
        <p className="text-muted-foreground">
          Compare two L5X files to see differences in tags, routines, and I/O modules
        </p>
      </div>

      <CompareSelector projects={projectsWithFiles} />
    </div>
  );
}
