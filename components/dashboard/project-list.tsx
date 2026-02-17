"use client";

import { useState, useEffect, useTransition, useMemo, useRef, Fragment } from "react";
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
  Archive,
  ArchiveRestore,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ProjectCardMenu } from "@/components/dashboard/project-card-menu";
import { MiniHealthRing } from "@/components/dashboard/mini-health-ring";

interface Project {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  is_favorite: boolean;
  is_archived?: boolean;
  created_by?: string;
  project_files: Array<{ id: string; file_name: string }> | { count: number };
}

interface HealthScores {
  overall: number;
  tagEfficiency: number;
  documentation: number;
  tagUsage: number;
  hasPartialExports?: boolean;
}

interface ProjectListProps {
  projects: Project[];
  archivedProjects?: Project[];
  currentUserId?: string;
  ownerMap?: Record<string, string>;
  healthScoreMap?: Record<string, HealthScores>;
}

type SortOption = "updated" | "created" | "name" | "files";

interface ProjectGridCardProps {
  project: Project;
  isSelected: boolean;
  onToggleSelect: (id: string, e?: React.MouseEvent) => void;
  onToggleFavorite: (id: string, currentValue: boolean, e: React.MouseEvent) => void;
  getFileCount: (project: Project) => number;
  currentUserId?: string;
  searchQuery?: string;
  healthScore?: number;
  hasPartialExports?: boolean;
}

function getMatchingFiles(project: Project, query: string): string[] {
  if (!query.trim() || !Array.isArray(project.project_files)) return [];
  const q = query.toLowerCase();
  return project.project_files
    .filter((f) => "file_name" in f && f.file_name.toLowerCase().includes(q))
    .map((f) => f.file_name);
}

function ProjectGridCard({
  project,
  isSelected,
  onToggleSelect,
  onToggleFavorite,
  getFileCount,
  currentUserId,
  searchQuery = "",
  healthScore,
  hasPartialExports,
}: ProjectGridCardProps) {
  const fileCount = getFileCount(project);
  const isOwner = !currentUserId || !project.created_by || project.created_by === currentUserId;
  const matchingFiles = getMatchingFiles(project, searchQuery);

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
              <ProjectCardMenu
                project={project}
                isOwner={isOwner}
                onToggleFavorite={onToggleFavorite}
              />
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
              <div className="ml-auto">
                {healthScore != null ? (
                  <MiniHealthRing score={healthScore} size={56} approximate={hasPartialExports} />
                ) : (
                  <span className="text-[10px] text-muted-foreground/60">No Data</span>
                )}
              </div>
            </div>
            {matchingFiles.length > 0 && (
              <div className="mt-3 pl-6 space-y-1">
                {matchingFiles.map((name) => (
                  <div key={name} className="flex items-center gap-1.5 text-xs text-primary">
                    <FileText className="h-3 w-3 shrink-0" />
                    <span className="truncate">{name}</span>
                  </div>
                ))}
              </div>
            )}
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
  currentUserId?: string;
  searchQuery?: string;
  healthScoreMap?: Record<string, HealthScores>;
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
  currentUserId,
  searchQuery = "",
  healthScoreMap = {},
}: ProjectListTableProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="rounded-md border">
      <Table className="table-fixed">
        <colgroup>
          <col className="w-[40px]" />
          <col />
          <col className="hidden md:table-column w-[30%]" />
          {showOwner && <col className="hidden sm:table-column w-[140px]" />}
          <col className="w-[70px]" />
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
            <TableHead>Health</TableHead>
            <TableHead>Updated</TableHead>
            <TableHead className="pr-4"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.map((project) => {
            const fileCount = getFileCount(project);
            const isSelected = selectedIds.has(project.id);
            const matchingFiles = getMatchingFiles(project, searchQuery);
            const isExpanded = expandedIds.has(project.id);
            const hasFiles = fileCount > 0;

            return (
              <Fragment key={project.id}>
              <TableRow
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
                    {hasFiles ? (
                      <button
                        className="p-0.5 -ml-1 rounded hover:bg-accent shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpand(project.id);
                        }}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                    ) : (
                      <span className="w-5 shrink-0" />
                    )}
                    {project.is_favorite && (
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400 shrink-0" />
                    )}
                    <FolderOpen className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-medium truncate">{project.name}</span>
                  </div>
                  {matchingFiles.length > 0 && (
                    <div className="ml-11 mt-1 space-y-0.5">
                      {matchingFiles.map((name) => (
                        <div key={name} className="flex items-center gap-1.5 text-xs text-primary">
                          <FileText className="h-3 w-3 shrink-0" />
                          <span className="truncate">{name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <span className="text-muted-foreground line-clamp-1">
                    {project.description || "-"}
                  </span>
                </TableCell>
                {showOwner && (
                  <TableCell className="hidden sm:table-cell">
                    <span className="text-muted-foreground truncate">
                      {project.created_by === currentUserId ? "Me" : project.created_by ? ownerMap[project.created_by] || "Unknown" : "-"}
                    </span>
                  </TableCell>
                )}
                <TableCell>{fileCount}</TableCell>
                <TableCell>
                  {healthScoreMap[project.id] ? (
                    <MiniHealthRing score={healthScoreMap[project.id].overall} size={32} approximate={healthScoreMap[project.id].hasPartialExports} />
                  ) : (
                    <span className="text-[10px] text-muted-foreground/60">No Data</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(project.updated_at).toLocaleDateString()}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()} className="pr-4">
                  <ProjectCardMenu
                    project={project}
                    isOwner={!currentUserId || !project.created_by || project.created_by === currentUserId}
                    onToggleFavorite={onToggleFavorite}
                  />
                </TableCell>
              </TableRow>
              {isExpanded && Array.isArray(project.project_files) && project.project_files.map((file) => (
                <TableRow
                  key={`file-${file.id}`}
                  className="cursor-pointer bg-muted/30 hover:bg-muted/50"
                  onClick={() => router.push(`/dashboard/projects/${project.id}`)}
                >
                  <TableCell />
                  <TableCell>
                    <div className="flex items-center gap-2 ml-7 text-sm text-muted-foreground">
                      <FileText className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{file.file_name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell" />
                  {showOwner && <TableCell className="hidden sm:table-cell" />}
                  <TableCell />
                  <TableCell />
                  <TableCell />
                  <TableCell />
                </TableRow>
              ))}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export function ProjectList({ projects, archivedProjects = [], currentUserId, ownerMap = {}, healthScoreMap = {} }: ProjectListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [archivedExpanded, setArchivedExpanded] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [optimisticFavorites, setOptimisticFavorites] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("projectViewMode");
      if (saved === "grid" || saved === "list") return saved;
    }
    return "grid";
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("updated");
  const [sortDesc, setSortDesc] = useState(true);
  const preSearchViewMode = useRef<"grid" | "list" | null>(null);

  const handleSearchChange = (query: string) => {
    // Auto-switch to list when starting a search from grid view
    if (query.trim() && !searchQuery.trim() && viewMode === "grid") {
      preSearchViewMode.current = viewMode;
      setViewMode("list");
    }
    // Restore view mode when search is cleared
    if (!query.trim() && searchQuery.trim() && preSearchViewMode.current !== null) {
      setViewMode(preSearchViewMode.current);
      preSearchViewMode.current = null;
    }
    setSearchQuery(query);
  };

  const handleViewModeChange = (mode: "grid" | "list") => {
    setViewMode(mode);
    preSearchViewMode.current = null;
    localStorage.setItem("projectViewMode", mode);
  };

  const getFileCount = (project: Project) => {
    return Array.isArray(project.project_files)
      ? project.project_files.length
      : (project.project_files as { count: number })?.count || 0;
  };

  // Apply optimistic favorite toggles
  const effectiveProjects = useMemo(() =>
    projects.map((p) =>
      p.id in optimisticFavorites ? { ...p, is_favorite: optimisticFavorites[p.id] } : p
    ),
  [projects, optimisticFavorites]);

  // Clear optimistic state when server data catches up
  useEffect(() => {
    setOptimisticFavorites({});
  }, [projects]);

  // Filter and sort projects
  const { favoriteProjects, regularProjects, sharedProjects, filteredAndSortedProjects } = useMemo(() => {
    let result = [...effectiveProjects];

    // Filter by search query (projects and file names)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          (p.description && p.description.toLowerCase().includes(query)) ||
          (Array.isArray(p.project_files) &&
            p.project_files.some((f) =>
              "file_name" in f && f.file_name.toLowerCase().includes(query)
            ))
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

    // Favorites come from all projects (owned + shared)
    const favorites = result.filter((p) => p.is_favorite).sort(sortFn);

    // Non-favorite owned projects
    const isOwned = (p: Project) => !currentUserId || !p.created_by || p.created_by === currentUserId;
    const regular = result.filter((p) => !p.is_favorite && isOwned(p)).sort(sortFn);

    // Non-favorite shared projects
    const shared = currentUserId
      ? result.filter((p) => !p.is_favorite && p.created_by && p.created_by !== currentUserId).sort(sortFn)
      : [];

    return {
      favoriteProjects: favorites,
      regularProjects: regular,
      sharedProjects: shared,
      filteredAndSortedProjects: [...favorites, ...regular, ...shared],
    };
  }, [effectiveProjects, searchQuery, sortBy, sortDesc, currentUserId]);

  // Show Owner column when any shared project exists (in any section)
  const hasAnySharedProject = currentUserId
    ? projects.some((p) => p.created_by && p.created_by !== currentUserId)
    : false;

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

  const handleArchive = async () => {
    setActionLoading("archive");
    try {
      const response = await fetch("/api/projects/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          action: "archive",
          value: true,
        }),
      });

      if (!response.ok) throw new Error("Failed to archive");

      startTransition(() => {
        router.refresh();
      });
      clearSelection();
    } catch (error) {
      console.error("Failed to archive:", error);
    } finally {
      setActionLoading(null);
      setShowArchiveDialog(false);
    }
  };

  const handleUnarchive = async (ids: string[]) => {
    setActionLoading("unarchive");
    try {
      const response = await fetch("/api/projects/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids,
          action: "archive",
          value: false,
        }),
      });

      if (!response.ok) throw new Error("Failed to unarchive");

      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      console.error("Failed to unarchive:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const toggleSingleFavorite = async (id: string, currentValue: boolean, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Optimistic update — toggle instantly
    setOptimisticFavorites((prev) => ({ ...prev, [id]: !currentValue }));

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
      // Revert on failure
      setOptimisticFavorites((prev) => ({ ...prev, [id]: currentValue }));
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
            placeholder="Search projects and files..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
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
                variant="outline"
                size="sm"
                onClick={() => setShowArchiveDialog(true)}
                disabled={actionLoading !== null}
              >
                {actionLoading === "archive" ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Archive className="h-4 w-4 mr-2" />
                )}
                Archive
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
              onClick={() => handleViewModeChange("grid")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="sm"
              className="rounded-l-none"
              onClick={() => handleViewModeChange("list")}
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
            <h3 className="text-lg font-semibold mb-2">No results found</h3>
            <p className="text-muted-foreground mb-4 text-center">
              No projects or files match "{searchQuery}"
            </p>
            <Button variant="outline" onClick={() => handleSearchChange("")}>
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
                    currentUserId={currentUserId}
                    searchQuery={searchQuery}
                    healthScore={healthScoreMap[project.id]?.overall}
                    hasPartialExports={healthScoreMap[project.id]?.hasPartialExports}
                  />
                ))}
              </div>
            </div>
          )}

          {/* All Projects section */}
          {regularProjects.length > 0 && (
            <div className="space-y-3">
              {(favoriteProjects.length > 0 || hasAnySharedProject) && (
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  {hasAnySharedProject ? "My Projects" : "All Projects"}
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
                    currentUserId={currentUserId}
                    searchQuery={searchQuery}
                    healthScore={healthScoreMap[project.id]?.overall}
                    hasPartialExports={healthScoreMap[project.id]?.hasPartialExports}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Shared with me section */}
          {sharedProjects.length > 0 && (
            <div id="shared-with-me" className="space-y-3 scroll-mt-6">
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
                    currentUserId={currentUserId}
                    searchQuery={searchQuery}
                    healthScore={healthScoreMap[project.id]?.overall}
                    hasPartialExports={healthScoreMap[project.id]?.hasPartialExports}
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
                showOwner={hasAnySharedProject}
                ownerMap={ownerMap}
                currentUserId={currentUserId}
                searchQuery={searchQuery}
                healthScoreMap={healthScoreMap}
              />
            </div>
          )}

          {/* All Projects section */}
          {regularProjects.length > 0 && (
            <div className="space-y-3">
              {(favoriteProjects.length > 0 || hasAnySharedProject) && (
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  {hasAnySharedProject ? "My Projects" : "All Projects"}
                </h2>
              )}
              <ProjectListTable
                projects={regularProjects}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onToggleFavorite={toggleSingleFavorite}
                getFileCount={getFileCount}
                router={router}
                showOwner={hasAnySharedProject}
                currentUserId={currentUserId}
                searchQuery={searchQuery}
                healthScoreMap={healthScoreMap}
              />
            </div>
          )}

          {/* Shared with me section */}
          {sharedProjects.length > 0 && (
            <div id="shared-with-me" className="space-y-3 scroll-mt-6">
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
                showOwner={hasAnySharedProject}
                ownerMap={ownerMap}
                currentUserId={currentUserId}
                searchQuery={searchQuery}
                healthScoreMap={healthScoreMap}
              />
            </div>
          )}
        </div>
      )}

      {/* Archived section (collapsible) */}
      {archivedProjects.length > 0 && (
        <div className="space-y-3 pt-2">
          <button
            onClick={() => setArchivedExpanded(!archivedExpanded)}
            className="flex items-center gap-2 w-full text-left group"
          >
            {archivedExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <Archive className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Archived
            </h2>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {archivedProjects.length}
            </span>
          </button>

          {archivedExpanded && (
            viewMode === "grid" ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {archivedProjects.map((project) => (
                  <div key={project.id} className="relative group opacity-75">
                    <Link href={`/dashboard/projects/${project.id}`}>
                      <Card className="h-full transition-all hover:bg-accent/50">
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <FolderOpen className="h-5 w-5 text-muted-foreground" />
                              <CardTitle className="text-lg">{project.name}</CardTitle>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleUnarchive([project.id]);
                              }}
                            >
                              <ArchiveRestore className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </div>
                          {project.description && (
                            <CardDescription className="line-clamp-2">
                              {project.description}
                            </CardDescription>
                          )}
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <FileText className="h-4 w-4" />
                              {getFileCount(project)} {getFileCount(project) === 1 ? "file" : "files"}
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {new Date(project.updated_at).toLocaleDateString()}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-md border opacity-75">
                <Table className="table-fixed">
                  <colgroup>
                    <col />
                    <col className="hidden md:table-column w-[30%]" />
                    <col className="w-[70px]" />
                    <col className="w-[100px]" />
                    <col className="w-[50px]" />
                  </colgroup>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead className="hidden md:table-cell">Description</TableHead>
                      <TableHead>Files</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead className="pr-4"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {archivedProjects.map((project) => {
                      const fileCount = getFileCount(project);
                      return (
                        <TableRow
                          key={project.id}
                          className="cursor-pointer"
                          onClick={() => router.push(`/dashboard/projects/${project.id}`)}
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="font-medium truncate">{project.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <span className="text-muted-foreground line-clamp-1">
                              {project.description || "-"}
                            </span>
                          </TableCell>
                          <TableCell>{fileCount}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(project.updated_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()} className="pr-4">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleUnarchive([project.id])}
                            >
                              <ArchiveRestore className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )
          )}
        </div>
      )}

      {/* Archive confirmation dialog */}
      <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive {selectedIds.size} project{selectedIds.size > 1 ? "s" : ""}?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedIds.size > 1 ? "These projects" : "This project"} will be hidden from
              tools and the sidebar but can be restored at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading === "archive"}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchive}
              disabled={actionLoading === "archive"}
            >
              {actionLoading === "archive" ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Archiving...
                </>
              ) : (
                "Archive"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
