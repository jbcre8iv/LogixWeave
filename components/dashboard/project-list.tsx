"use client";

import { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FolderOpen,
  FileText,
  Calendar,
  Star,
  Trash2,
  X,
  Loader2,
  LayoutGrid,
  List,
  Search,
  ArrowUpDown,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Project {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  is_favorite: boolean;
  created_by?: string;
  project_files: { count: number } | Array<unknown>;
}

interface ProjectListProps {
  projects: Project[];
  currentUserId?: string;
  ownerMap?: Record<string, string>;
}

type SortOption = "updated" | "created" | "name" | "files";

interface ProjectGridCardProps {
  project: Project;
  isSelected: boolean;
  onToggleSelect: (id: string, e?: React.MouseEvent) => void;
  onToggleFavorite: (id: string, currentValue: boolean, e: React.MouseEvent) => void;
  getFileCount: (project: Project) => number;
}

function ProjectGridCard({
  project,
  isSelected,
  onToggleSelect,
  onToggleFavorite,
  getFileCount,
}: ProjectGridCardProps) {
  const fileCount = getFileCount(project);

  return (
    <div className="relative group">
      <Link href={`/dashboard/projects/${project.id}`}>
        <Card
          className={cn(
            "h-full transition-all hover:bg-accent/50",
            isSelected && "ring-2 ring-primary bg-accent/30"
          )}
        >
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 pl-6">
                <FolderOpen className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">{project.name}</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={(e) => onToggleFavorite(project.id, project.is_favorite, e)}
              >
                <Star
                  className={cn(
                    "h-4 w-4",
                    project.is_favorite
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-muted-foreground"
                  )}
                />
              </Button>
            </div>
            {project.description && (
              <CardDescription className="line-clamp-2 pl-6">
                {project.description}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 text-sm text-muted-foreground pl-6">
              <div className="flex items-center gap-1">
                <FileText className="h-4 w-4" />
                {fileCount} {fileCount === 1 ? "file" : "files"}
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {new Date(project.updated_at).toLocaleDateString()}
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>

      {/* Checkbox overlay */}
      <div
        className={cn(
          "absolute top-4 left-4 transition-opacity z-10",
          isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}
        onClick={(e) => onToggleSelect(project.id, e)}
      >
        <Checkbox
          checked={isSelected}
          className="bg-background"
          aria-label={`Select ${project.name}`}
        />
      </div>
    </div>
  );
}

interface ProjectListTableProps {
  projects: Project[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string, e?: React.MouseEvent) => void;
  onToggleFavorite: (id: string, currentValue: boolean, e: React.MouseEvent) => void;
  getFileCount: (project: Project) => number;
  router: ReturnType<typeof useRouter>;
  ownerMap?: Record<string, string>;
  showOwner?: boolean;
}

function ProjectListTable({
  projects,
  selectedIds,
  onToggleSelect,
  onToggleFavorite,
  getFileCount,
  router,
  ownerMap = {},
  showOwner = false,
}: ProjectListTableProps) {
  return (
    <div className="rounded-md border">
      <Table className="table-fixed">
        <colgroup>
          <col className="w-[40px]" />
          <col />
          <col className="hidden md:table-column w-[30%]" />
          {showOwner && <col className="hidden sm:table-column w-[140px]" />}
          <col className="w-[70px]" />
          <col className="w-[100px]" />
          <col className="w-[50px]" />
        </colgroup>
        <TableHeader>
          <TableRow>
            <TableHead></TableHead>
            <TableHead>Name</TableHead>
            <TableHead className="hidden md:table-cell">Description</TableHead>
            {showOwner && <TableHead className="hidden sm:table-cell">Owner</TableHead>}
            <TableHead>Files</TableHead>
            <TableHead>Updated</TableHead>
            <TableHead className="pr-4"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.map((project) => {
            const fileCount = getFileCount(project);
            const isSelected = selectedIds.has(project.id);

            return (
              <TableRow
                key={project.id}
                className={cn(
                  "cursor-pointer",
                  isSelected && "bg-accent/50"
                )}
                onClick={() => router.push(`/dashboard/projects/${project.id}`)}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onToggleSelect(project.id)}
                    aria-label={`Select ${project.name}`}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {project.is_favorite && (
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400 shrink-0" />
                    )}
                    <FolderOpen className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-medium truncate">{project.name}</span>
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <span className="text-muted-foreground line-clamp-1">
                    {project.description || "-"}
                  </span>
                </TableCell>
                {showOwner && (
                  <TableCell className="hidden sm:table-cell">
                    <span className="text-muted-foreground truncate">
                      {project.created_by ? ownerMap[project.created_by] || "Unknown" : "-"}
                    </span>
                  </TableCell>
                )}
                <TableCell>{fileCount}</TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(project.updated_at).toLocaleDateString()}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()} className="pr-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => onToggleFavorite(project.id, project.is_favorite, e)}
                  >
                    <Star
                      className={cn(
                        "h-4 w-4",
                        project.is_favorite
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-muted-foreground"
                      )}
                    />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export function ProjectList({ projects, currentUserId, ownerMap = {} }: ProjectListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("updated");
  const [sortDesc, setSortDesc] = useState(true);

  const getFileCount = (project: Project) => {
    return Array.isArray(project.project_files)
      ? project.project_files.length
      : (project.project_files as { count: number })?.count || 0;
  };

  // Filter and sort projects
  const { favoriteProjects, regularProjects, sharedProjects, filteredAndSortedProjects } = useMemo(() => {
    let result = [...projects];

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          (p.description && p.description.toLowerCase().includes(query))
      );
    }

    // Sort by selected criteria
    const sortFn = (a: Project, b: Project) => {
      let comparison = 0;
      switch (sortBy) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "created":
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case "updated":
          comparison = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
          break;
        case "files":
          comparison = getFileCount(a) - getFileCount(b);
          break;
      }
      return sortDesc ? -comparison : comparison;
    };

    // Separate owned vs shared projects
    const owned = currentUserId
      ? result.filter((p) => !p.created_by || p.created_by === currentUserId)
      : result;
    const shared = currentUserId
      ? result.filter((p) => p.created_by && p.created_by !== currentUserId)
      : [];

    // Separate favorites and regular from owned projects
    const favorites = owned.filter((p) => p.is_favorite).sort(sortFn);
    const regular = owned.filter((p) => !p.is_favorite).sort(sortFn);
    const sortedShared = shared.sort(sortFn);

    return {
      favoriteProjects: favorites,
      regularProjects: regular,
      sharedProjects: sortedShared,
      filteredAndSortedProjects: [...favorites, ...regular, ...sortedShared],
    };
  }, [projects, searchQuery, sortBy, sortDesc, currentUserId]);

  const toggleSelect = (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    const visibleIds = filteredAndSortedProjects.map((p) => p.id);
    if (visibleIds.every((id) => selectedIds.has(id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visibleIds));
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleFavorite = async (favorite: boolean) => {
    setActionLoading("favorite");
    try {
      const response = await fetch("/api/projects/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          action: "favorite",
          value: favorite,
        }),
      });

      if (!response.ok) throw new Error("Failed to update");

      startTransition(() => {
        router.refresh();
      });
      clearSelection();
    } catch (error) {
      console.error("Failed to update favorites:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    setActionLoading("delete");
    try {
      const response = await fetch("/api/projects/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
        }),
      });

      if (!response.ok) throw new Error("Failed to delete");

      startTransition(() => {
        router.refresh();
      });
      clearSelection();
    } catch (error) {
      console.error("Failed to delete:", error);
    } finally {
      setActionLoading(null);
      setShowDeleteDialog(false);
    }
  };

  const toggleSingleFavorite = async (id: string, currentValue: boolean, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      const response = await fetch("/api/projects/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: [id],
          action: "favorite",
          value: !currentValue,
        }),
      });

      if (!response.ok) throw new Error("Failed to update");

      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      console.error("Failed to update favorite:", error);
    }
  };

  const toggleSortDirection = () => {
    setSortDesc(!sortDesc);
  };

  const selectedProjects = projects.filter((p) => selectedIds.has(p.id));
  const allSelectedAreFavorites = selectedProjects.length > 0 && selectedProjects.every((p) => p.is_favorite);
  const visibleSelectedCount = filteredAndSortedProjects.filter((p) => selectedIds.has(p.id)).length;

  return (
    <div className="space-y-4">
      {/* Search and filters toolbar */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="updated">Last Updated</SelectItem>
              <SelectItem value="created">Created Date</SelectItem>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="files">File Count</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={toggleSortDirection}>
            <ArrowUpDown className={cn("h-4 w-4", sortDesc && "rotate-180")} />
          </Button>
        </div>
      </div>

      {/* Selection toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={
              filteredAndSortedProjects.length > 0 &&
              filteredAndSortedProjects.every((p) => selectedIds.has(p.id))
            }
            onCheckedChange={selectAll}
            aria-label="Select all projects"
          />
          <span className="text-sm text-muted-foreground">
            {selectedIds.size > 0
              ? `${visibleSelectedCount} of ${filteredAndSortedProjects.length} selected`
              : `${filteredAndSortedProjects.length} project${filteredAndSortedProjects.length !== 1 ? "s" : ""}`}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Selection actions */}
          {selectedIds.size > 0 && (
            <>
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleFavorite(!allSelectedAreFavorites)}
                disabled={actionLoading !== null}
              >
                {actionLoading === "favorite" ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Star className={cn("h-4 w-4 mr-2", allSelectedAreFavorites && "fill-yellow-400 text-yellow-400")} />
                )}
                {allSelectedAreFavorites ? "Unfavorite" : "Favorite"}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteDialog(true)}
                disabled={actionLoading !== null}
              >
                {actionLoading === "delete" ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Delete
              </Button>
              <div className="w-px h-6 bg-border mx-2" />
            </>
          )}

          {/* View toggle */}
          <div className="flex items-center border rounded-md">
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="sm"
              className="rounded-r-none"
              onClick={() => setViewMode("grid")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="sm"
              className="rounded-l-none"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* No results */}
      {filteredAndSortedProjects.length === 0 && searchQuery && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Search className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No projects found</h3>
            <p className="text-muted-foreground mb-4 text-center">
              No projects match "{searchQuery}"
            </p>
            <Button variant="outline" onClick={() => setSearchQuery("")}>
              Clear search
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Grid view */}
      {viewMode === "grid" && filteredAndSortedProjects.length > 0 && (
        <div className="space-y-6">
          {/* Favorites section */}
          {favoriteProjects.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Favorites
                </h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {favoriteProjects.map((project) => (
                  <ProjectGridCard
                    key={project.id}
                    project={project}
                    isSelected={selectedIds.has(project.id)}
                    onToggleSelect={toggleSelect}
                    onToggleFavorite={toggleSingleFavorite}
                    getFileCount={getFileCount}
                  />
                ))}
              </div>
            </div>
          )}

          {/* All Projects section */}
          {regularProjects.length > 0 && (
            <div className="space-y-3">
              {(favoriteProjects.length > 0 || sharedProjects.length > 0) && (
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  {sharedProjects.length > 0 ? "My Projects" : "All Projects"}
                </h2>
              )}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {regularProjects.map((project) => (
                  <ProjectGridCard
                    key={project.id}
                    project={project}
                    isSelected={selectedIds.has(project.id)}
                    onToggleSelect={toggleSelect}
                    onToggleFavorite={toggleSingleFavorite}
                    getFileCount={getFileCount}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Shared with me section */}
          {sharedProjects.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Shared with me
                </h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {sharedProjects.map((project) => (
                  <ProjectGridCard
                    key={project.id}
                    project={project}
                    isSelected={selectedIds.has(project.id)}
                    onToggleSelect={toggleSelect}
                    onToggleFavorite={toggleSingleFavorite}
                    getFileCount={getFileCount}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* List view */}
      {viewMode === "list" && filteredAndSortedProjects.length > 0 && (
        <div className="space-y-6">
          {/* Favorites section */}
          {favoriteProjects.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Favorites
                </h2>
              </div>
              <ProjectListTable
                projects={favoriteProjects}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onToggleFavorite={toggleSingleFavorite}
                getFileCount={getFileCount}
                router={router}
                showOwner={sharedProjects.length > 0}
              />
            </div>
          )}

          {/* All Projects section */}
          {regularProjects.length > 0 && (
            <div className="space-y-3">
              {(favoriteProjects.length > 0 || sharedProjects.length > 0) && (
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  {sharedProjects.length > 0 ? "My Projects" : "All Projects"}
                </h2>
              )}
              <ProjectListTable
                projects={regularProjects}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onToggleFavorite={toggleSingleFavorite}
                getFileCount={getFileCount}
                router={router}
                showOwner={sharedProjects.length > 0}
              />
            </div>
          )}

          {/* Shared with me section */}
          {sharedProjects.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Shared with me
                </h2>
              </div>
              <ProjectListTable
                projects={sharedProjects}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onToggleFavorite={toggleSingleFavorite}
                getFileCount={getFileCount}
                router={router}
                showOwner
                ownerMap={ownerMap}
              />
            </div>
          )}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} project{selectedIds.size > 1 ? "s" : ""}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. All files and parsed data associated with
              {selectedIds.size > 1 ? " these projects" : " this project"} will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading === "delete"}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={actionLoading === "delete"}
            >
              {actionLoading === "delete" ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
