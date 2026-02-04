import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FileText, Trash2 } from "lucide-react";
import { FileUploader } from "@/components/tools/file-uploader";
import { DeleteFileButton } from "@/components/tools/delete-file-button";

interface FilesPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function FilesPage({ params }: FilesPageProps) {
  const { projectId } = await params;
  const supabase = await createClient();

  const { data: project, error } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", projectId)
    .single();

  if (error || !project) {
    notFound();
  }

  const { data: files } = await supabase
    .from("project_files")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/dashboard/projects/${projectId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">File Management</h1>
          <p className="text-muted-foreground">{project.name}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload Files</CardTitle>
          <CardDescription>
            Upload L5X or L5K files exported from Studio 5000. Files will be automatically
            parsed after upload.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FileUploader projectId={projectId} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Uploaded Files</CardTitle>
          <CardDescription>
            {files?.length || 0} file{files?.length !== 1 ? "s" : ""} in this project
          </CardDescription>
        </CardHeader>
        <CardContent>
          {files && files.length > 0 ? (
            <div className="space-y-3">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{file.file_name}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{(file.file_size / 1024).toFixed(1)} KB</span>
                        <span>•</span>
                        <span>{file.file_type.toUpperCase()}</span>
                        <span>•</span>
                        <span>
                          Uploaded {new Date(file.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={
                        file.parsing_status === "completed"
                          ? "default"
                          : file.parsing_status === "failed"
                          ? "destructive"
                          : file.parsing_status === "processing"
                          ? "secondary"
                          : "outline"
                      }
                    >
                      {file.parsing_status}
                    </Badge>
                    {file.parsing_status === "failed" && file.parsing_error && (
                      <span className="text-xs text-destructive max-w-[200px] truncate">
                        {file.parsing_error}
                      </span>
                    )}
                    <DeleteFileButton fileId={file.id} fileName={file.file_name} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                No files uploaded yet. Upload your first L5X/L5K file above.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
