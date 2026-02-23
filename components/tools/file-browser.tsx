"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  MoreVertical,
  Pencil,
  Trash2,
  ChevronRight,
  Home,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { FileVersionHistory } from "./file-version-history";
import { DownloadFileButton } from "./download-file-button";
import { DeleteFileButton } from "./delete-file-button";

interface FileItem {
  id: string;
  file_name: string;
  file_size: number;
  file_type: string;
  parsing_status: string;
  parsing_error?: string;
  created_at: string;
  folder_id: string | null;
  current_version?: number;
  version_count?: number;
}

interface FolderItem {
  id: string;
  name: string;
  project_id: string;
  created_at: string;
}

interface FileBrowserProps {
  projectId: string;
  files: FileItem[];
  folders: FolderItem[];
  onFolderChange?: (folderId: string | null) => void;
  isAdmin?: boolean;
}

export function FileBrowser({ projectId, files, folders, onFolderChange, isAdmin = false }: FileBrowserProps) {
  const router = useRouter();
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const navigateToFolder = useCallback((folderId: string | null) => {
    setCurrentFolderId(folderId);
    onFolderChange?.(folderId);
  }, [onFolderChange]);
  const [draggedFileId, setDraggedFileId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [dragOverRoot, setDragOverRoot] = useState(false);

  // Dialog states
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [renameFolderOpen, setRenameFolderOpen] = useState(false);
  const [deleteFolderOpen, setDeleteFolderOpen] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<FolderItem | null>(null);
  const [folderName, setFolderName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [reparsingFileId, setReparsingFileId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Get current folder object
  const currentFolder = currentFolderId
    ? folders.find((f) => f.id === currentFolderId)
    : null;

  // Build set of valid folder IDs
  const folderIds = new Set(folders.map((f) => f.id));

  // Filter files for current view — treat orphaned folder_id as root
  const visibleFiles = files.filter((f) => {
    const effectiveFolderId = f.folder_id && folderIds.has(f.folder_id) ? f.folder_id : null;
    return effectiveFolderId === currentFolderId;
  });
  const visibleFolders = currentFolderId === null ? folders : [];

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, fileId: string) => {
    setDraggedFileId(fileId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setDraggedFileId(null);
    setDragOverFolderId(null);
    setDragOverRoot(false);
  };

  const handleDragOverFolder = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverFolderId(folderId);
  };

  const handleDragOverRoot = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverRoot(true);
  };

  const handleDragLeaveFolder = () => {
    setDragOverFolderId(null);
  };

  const handleDragLeaveRoot = () => {
    setDragOverRoot(false);
  };

  const handleDropOnFolder = async (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    setDragOverFolderId(null);

    if (!draggedFileId) return;

    try {
      const response = await fetch("/api/files/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileIds: [draggedFileId], folderId }),
      });

      if (response.ok) {
        router.refresh();
      }
    } catch (err) {
      console.error("Failed to move file:", err);
    }

    setDraggedFileId(null);
  };

  const handleDropOnRoot = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverRoot(false);

    if (!draggedFileId) return;

    try {
      const response = await fetch("/api/files/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileIds: [draggedFileId], folderId: null }),
      });

      if (response.ok) {
        router.refresh();
      }
    } catch (err) {
      console.error("Failed to move file:", err);
    }

    setDraggedFileId(null);
  };

  // Folder CRUD handlers
  const handleCreateFolder = async () => {
    if (!folderName.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, name: folderName.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to create folder");
        return;
      }

      setCreateFolderOpen(false);
      setFolderName("");
      router.refresh();
    } catch (err) {
      setError("Failed to create folder");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRenameFolder = async () => {
    if (!selectedFolder || !folderName.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/folders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId: selectedFolder.id, name: folderName.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to rename folder");
        return;
      }

      setRenameFolderOpen(false);
      setSelectedFolder(null);
      setFolderName("");
      router.refresh();
    } catch (err) {
      setError("Failed to rename folder");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteFolder = async () => {
    if (!selectedFolder) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/folders?folderId=${selectedFolder.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Failed to delete folder");
        return;
      }

      setDeleteFolderOpen(false);
      setSelectedFolder(null);
      // If we're inside the deleted folder, go back to root
      if (currentFolderId === selectedFolder.id) {
        navigateToFolder(null);
      }
      router.refresh();
    } catch (err) {
      setError("Failed to delete folder");
    } finally {
      setIsLoading(false);
    }
  };

  const openRenameDialog = (folder: FolderItem) => {
    setSelectedFolder(folder);
    setFolderName(folder.name);
    setError(null);
    setRenameFolderOpen(true);
  };

  const openDeleteDialog = (folder: FolderItem) => {
    setSelectedFolder(folder);
    setError(null);
    setDeleteFolderOpen(true);
  };

  const handleReparse = async (fileId: string) => {
    setReparsingFileId(fileId);
    try {
      const response = await fetch("/api/files/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId }),
      });

      if (!response.ok) {
        const data = await response.json();
        console.error("Re-parse failed:", data.error);
      }

      router.refresh();
    } catch (err) {
      console.error("Re-parse failed:", err);
    } finally {
      setReparsingFileId(null);
    }
  };

  const filesInFolder = (folderId: string) =>
    files.filter((f) => f.folder_id === folderId && folderIds.has(folderId)).length;

  return (
    <div className="space-y-4">
      {/* Breadcrumb and actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <button
            onClick={() => navigateToFolder(null)}
            className={`flex items-center gap-1 hover:text-primary transition-colors ${
              !currentFolderId ? "text-foreground font-medium" : "text-muted-foreground"
            }`}
            onDragOver={currentFolderId ? handleDragOverRoot : undefined}
            onDragLeave={handleDragLeaveRoot}
            onDrop={currentFolderId ? handleDropOnRoot : undefined}
          >
            <Home className="h-4 w-4" />
            <span className={dragOverRoot ? "text-primary" : ""}>Root</span>
          </button>
          {currentFolder && (
            <>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{currentFolder.name}</span>
            </>
          )}
        </div>

        {!currentFolderId && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setFolderName("");
              setError(null);
              setCreateFolderOpen(true);
            }}
          >
            <FolderPlus className="h-4 w-4 mr-2" />
            New Folder
          </Button>
        )}
      </div>

      {/* Folders grid (only at root level) */}
      {visibleFolders.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {visibleFolders.map((folder) => (
            <div
              key={folder.id}
              className={`group relative flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${
                dragOverFolderId === folder.id ? "border-primary bg-primary/10" : ""
              }`}
              onClick={() => navigateToFolder(folder.id)}
              onDragOver={(e) => handleDragOverFolder(e, folder.id)}
              onDragLeave={handleDragLeaveFolder}
              onDrop={(e) => handleDropOnFolder(e, folder.id)}
            >
              {dragOverFolderId === folder.id ? (
                <FolderOpen className="h-8 w-8 text-primary flex-shrink-0" />
              ) : (
                <Folder className="h-8 w-8 text-amber-500 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{folder.name}</p>
                <p className="text-xs text-muted-foreground">
                  {filesInFolder(folder.id)} file{filesInFolder(folder.id) !== 1 ? "s" : ""}
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      openRenameDialog(folder);
                    }}
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      openDeleteDialog(folder);
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      )}

      {/* Files list */}
      {visibleFiles.length > 0 ? (
        <div className="space-y-3">
          {visibleFiles.map((file) => (
            <div
              key={file.id}
              draggable
              onDragStart={(e) => handleDragStart(e, file.id)}
              onDragEnd={handleDragEnd}
              className={`flex items-center justify-between p-4 border rounded-lg transition-all ${
                draggedFileId === file.id ? "opacity-50 border-dashed" : ""
              } ${!draggedFileId ? "hover:bg-muted/30" : ""}`}
            >
              <div className="flex items-center gap-4 cursor-grab active:cursor-grabbing">
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
              <div className="flex items-center gap-2">
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
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title="Re-parse file"
                    disabled={reparsingFileId === file.id}
                    onClick={() => handleReparse(file.id)}
                  >
                    {reparsingFileId === file.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                )}
                <FileVersionHistory
                  fileId={file.id}
                  fileName={file.file_name}
                  currentVersion={file.current_version || 1}
                  versionCount={file.version_count || 1}
                  projectId={projectId}
                />
                <DownloadFileButton fileId={file.id} fileName={file.file_name} currentVersion={file.current_version} />
                <DeleteFileButton fileId={file.id} fileName={file.file_name} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            {currentFolderId
              ? "No files in this folder. Drag files here to organize them."
              : folders.length > 0
              ? "No files at root level. Files may be inside folders."
              : "No files uploaded yet. Upload your first L5X/L5K file above."}
          </p>
        </div>
      )}

      {/* Create Folder Dialog */}
      <Dialog open={createFolderOpen} onOpenChange={setCreateFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
            <DialogDescription>
              Create a folder to organize your files.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="folder-name">Folder Name</Label>
              <Input
                id="folder-name"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder="Enter folder name"
                onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateFolderOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateFolder} disabled={isLoading || !folderName.trim()}>
              {isLoading ? "Creating..." : "Create Folder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Folder Dialog */}
      <Dialog open={renameFolderOpen} onOpenChange={setRenameFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Folder</DialogTitle>
            <DialogDescription>
              Enter a new name for this folder.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rename-folder">Folder Name</Label>
              <Input
                id="rename-folder"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder="Enter folder name"
                onKeyDown={(e) => e.key === "Enter" && handleRenameFolder()}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameFolderOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRenameFolder} disabled={isLoading || !folderName.trim()}>
              {isLoading ? "Renaming..." : "Rename"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Folder Dialog */}
      <Dialog open={deleteFolderOpen} onOpenChange={setDeleteFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Folder</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{selectedFolder?.name}&quot;?
              {filesInFolder(selectedFolder?.id || "") > 0 && (
                <span className="block mt-2 text-amber-600">
                  The {filesInFolder(selectedFolder?.id || "")} file(s) inside will be moved to the root level.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteFolderOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteFolder} disabled={isLoading}>
              {isLoading ? "Deleting..." : "Delete Folder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
