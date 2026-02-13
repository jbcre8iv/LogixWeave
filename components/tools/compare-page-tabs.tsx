"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompareSelector } from "@/components/tools/compare-selector";
import { FolderCompareSelector } from "@/components/tools/folder-compare-selector";
import { FileText, FolderOpen } from "lucide-react";

interface Project {
  id: string;
  name: string;
  project_files: Array<{
    id: string;
    file_name: string;
    parsing_status: string;
    folder_id: string | null;
    current_version?: number;
    version_count?: number;
  }>;
  project_folders?: Array<{
    id: string;
    name: string;
  }>;
}

export function ComparePageTabs({ projects }: { projects: Project[] }) {
  return (
    <Tabs defaultValue="files">
      <TabsList>
        <TabsTrigger value="files" className="gap-2">
          <FileText className="h-4 w-4" />
          Compare Files
        </TabsTrigger>
        <TabsTrigger value="folders" className="gap-2">
          <FolderOpen className="h-4 w-4" />
          Compare Folders
        </TabsTrigger>
      </TabsList>
      <TabsContent value="files" className="mt-4">
        <CompareSelector projects={projects} />
      </TabsContent>
      <TabsContent value="folders" className="mt-4">
        <FolderCompareSelector projects={projects} />
      </TabsContent>
    </Tabs>
  );
}
