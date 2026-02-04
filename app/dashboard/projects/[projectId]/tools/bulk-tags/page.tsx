import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { BulkTagEditor } from "@/components/tools/bulk-tag-editor";

interface BulkTagsPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function BulkTagsPage({ params }: BulkTagsPageProps) {
  const { projectId } = await params;

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

  // Get existing data types and scopes for suggestions
  let existingDataTypes: string[] = [];
  let existingScopes: string[] = [];

  if (fileIds.length > 0) {
    const [dataTypesResult, scopesResult] = await Promise.all([
      supabase.from("parsed_tags").select("data_type").in("file_id", fileIds),
      supabase.from("parsed_tags").select("scope").in("file_id", fileIds),
    ]);

    existingDataTypes = [...new Set(dataTypesResult.data?.map((t) => t.data_type) || [])];
    existingScopes = [...new Set(scopesResult.data?.map((t) => t.scope) || [])];
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/dashboard/projects/${projectId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Bulk Tag Creator</h1>
          <p className="text-muted-foreground">{project.name}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create Tags for Import</CardTitle>
          <CardDescription>
            Create or import tags from CSV, then export as L5X for Studio 5000 import.
            The exported L5X file can be imported directly into your PLC project.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BulkTagEditor
            projectName={project.name}
            existingDataTypes={existingDataTypes}
            existingScopes={existingScopes}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>CSV Format</CardTitle>
          <CardDescription>
            Required and optional columns for CSV import
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Required Columns</h4>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                <li><code className="bg-muted px-1 rounded">Name</code> - Tag name (no spaces)</li>
                <li><code className="bg-muted px-1 rounded">DataType</code> - PLC data type (BOOL, DINT, REAL, etc.)</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Optional Columns</h4>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                <li><code className="bg-muted px-1 rounded">Scope</code> - Controller or Program name (default: Controller)</li>
                <li><code className="bg-muted px-1 rounded">Description</code> - Tag description</li>
                <li><code className="bg-muted px-1 rounded">Radix</code> - Display format (Decimal, Binary, Hex, etc.)</li>
                <li><code className="bg-muted px-1 rounded">ExternalAccess</code> - Access level (Read/Write, Read Only, None)</li>
                <li><code className="bg-muted px-1 rounded">Dimensions</code> - Array dimensions (e.g., "10" or "10,5")</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Example CSV</h4>
              <pre className="bg-muted p-3 rounded-md text-sm overflow-x-auto">
{`Name,DataType,Scope,Description
Pump_1_Run,BOOL,Controller,Pump 1 running status
Pump_1_Speed,REAL,Controller,Pump 1 speed setpoint
Motor_Amps,DINT,Controller,Motor current in amps`}
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
