"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, FileText, X, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface FileUploaderProps {
  projectId: string;
}

interface UploadingFile {
  file: File;
  status: "uploading" | "processing" | "completed" | "error";
  error?: string;
}

// Allowed file types and max size (50MB)
const ALLOWED_EXTENSIONS = ["l5x", "l5k"];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export function FileUploader({ projectId }: FileUploaderProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [rejectionError, setRejectionError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const uploadFile = async (file: File) => {
    const extension = file.name.split(".").pop()?.toLowerCase();

    if (!extension || !ALLOWED_EXTENSIONS.includes(extension)) {
      return { error: "Only .L5X and .L5K files are supported" };
    }

    if (file.size > MAX_FILE_SIZE) {
      return { error: "File exceeds 50MB limit" };
    }

    try {
      // Get user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { error: "Not authenticated" };
      }

      // Upload to storage
      const storagePath = `${projectId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("project-files")
        .upload(storagePath, file);

      if (uploadError) {
        return { error: uploadError.message };
      }

      // Create file record
      const { data: fileRecord, error: dbError } = await supabase
        .from("project_files")
        .insert({
          project_id: projectId,
          file_name: file.name,
          file_type: extension as "l5x" | "l5k",
          file_size: file.size,
          storage_path: storagePath,
          uploaded_by: user.id,
          parsing_status: "pending",
        })
        .select()
        .single();

      if (dbError) {
        return { error: dbError.message };
      }

      // Trigger parsing via API
      const parseResponse = await fetch("/api/files/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: fileRecord.id }),
      });

      if (!parseResponse.ok) {
        // Parsing failed but file was uploaded
        console.error("Parsing request failed");
      }

      return { success: true };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Upload failed" };
    }
  };

  const handleFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    setRejectionError(null);

    // Validate files
    const validFiles: File[] = [];
    const rejectionReasons: string[] = [];

    for (const file of fileArray) {
      const ext = file.name.split(".").pop()?.toLowerCase();

      if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
        rejectionReasons.push(`"${file.name}" - Only .L5X and .L5K files are allowed`);
        continue;
      }

      if (file.size > MAX_FILE_SIZE) {
        rejectionReasons.push(`"${file.name}" - File exceeds 50MB limit`);
        continue;
      }

      validFiles.push(file);
    }

    // Show rejection errors
    if (rejectionReasons.length > 0) {
      setRejectionError(rejectionReasons.join(". "));
      setTimeout(() => setRejectionError(null), 8000);
    }

    if (validFiles.length === 0) {
      return;
    }

    // Add files to uploading state
    const newUploading: UploadingFile[] = validFiles.map((file) => ({
      file,
      status: "uploading",
    }));
    setUploadingFiles((prev) => [...prev, ...newUploading]);

    // Upload each file
    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      const result = await uploadFile(file);

      setUploadingFiles((prev) =>
        prev.map((uf) =>
          uf.file === file
            ? {
                ...uf,
                status: result.error ? "error" : "completed",
                error: result.error,
              }
            : uf
        )
      );
    }

    // Refresh page after uploads complete
    router.refresh();
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFiles(e.dataTransfer.files);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  };

  const removeFile = (file: File) => {
    setUploadingFiles((prev) => prev.filter((uf) => uf.file !== file));
  };

  return (
    <div className="space-y-4">
      {rejectionError && (
        <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{rejectionError}</span>
        </div>
      )}

      <Card
        className={`border-2 border-dashed transition-colors ${
          isDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Upload className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium mb-2">Drop L5X/L5K files here</p>
          <p className="text-sm text-muted-foreground mb-4">or click to browse</p>
          <p className="text-xs text-muted-foreground/70 max-w-sm text-center">
            Have an .ACD file? Open it in Studio 5000 and use File &rarr; Export to save as .L5X or .L5K
          </p>
          <input
            type="file"
            accept=".l5x,.l5k"
            multiple
            onChange={handleInputChange}
            className="hidden"
            id="file-upload"
          />
          <Button asChild variant="secondary">
            <label htmlFor="file-upload" className="cursor-pointer">
              Select Files
            </label>
          </Button>
        </CardContent>
      </Card>

      {uploadingFiles.length > 0 && (
        <div className="space-y-2">
          {uploadingFiles.map((uf, index) => (
            <div
              key={`${uf.file.name}-${index}`}
              className="flex items-center justify-between p-3 border rounded-lg"
            >
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">{uf.file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(uf.file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {uf.status === "uploading" && (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                )}
                {uf.status === "completed" && (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                )}
                {uf.status === "error" && (
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-destructive" />
                    <span className="text-xs text-destructive">{uf.error}</span>
                  </div>
                )}
                {(uf.status === "completed" || uf.status === "error") && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => removeFile(uf.file)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
