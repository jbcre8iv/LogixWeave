import { createClient } from "@/lib/supabase/server";
import { CompareSelector } from "@/components/tools/compare-selector";
import { Card, CardContent } from "@/components/ui/card";
import { FileCode2, GitCompare, History } from "lucide-react";

export default async function FileComparePage() {
  const supabase = await createClient();

  // Get all projects with their files and folders
  const { data: projects } = await supabase
    .from("projects")
    .select(`
      id,
      name,
      project_files(id, file_name, parsing_status, folder_id, current_version, version_count),
      project_folders(id, name)
    `)
    .order("name");

  // Filter to only include projects with completed parsed files
  const projectsWithFiles = (projects || [])
    .map((project) => ({
      ...project,
      project_files: (project.project_files || []).filter(
        (f: { parsing_status: string }) => f.parsing_status === "completed"
      ),
      project_folders: project.project_folders || [],
    }))
    .filter((project) => project.project_files.length > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">File Compare</h1>
        <p className="text-muted-foreground">
          Compare L5X files to identify differences in tags, routines, and I/O modules
        </p>
      </div>

      {/* How it works section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-muted/30">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <GitCompare className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-medium text-sm">Compare Files</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Select any two L5X files from your projects to see what changed between them.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-muted/30">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <History className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-medium text-sm">Version History</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Compare different versions of the same file to track changes over time.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-muted/30">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <FileCode2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-medium text-sm">Cross-Project</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Compare files across different projects to identify variations between machines.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <CompareSelector projects={projectsWithFiles} />
    </div>
  );
}
