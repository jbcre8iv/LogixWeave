"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Logo, LogoIcon } from "@/components/ui/logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LayoutDashboard,
  FolderOpen,
  Tags,
  Settings,
  HardDrive,
  FileCode2,
  Layers,
  Package,
  BarChart3,
  Sparkles,
  FolderOpen as FolderIcon,
  ChevronDown,
  Check,
  Plus,
  Shield,
  Star,
  Users,
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Projects", href: "/dashboard/projects", icon: FolderOpen },
];

// Project-specific tools (shown under project selector)
const projectTools = [
  { name: "Tag Explorer", globalHref: "/dashboard/tools/tags", projectHref: "/tags", icon: Tags },
  { name: "I/O Mapping", globalHref: "/dashboard/tools/io", projectHref: "/io-mapping", icon: HardDrive },
  { name: "UDTs", globalHref: "/dashboard/tools/udts", projectHref: "/udts", icon: Layers },
  { name: "AOIs", globalHref: "/dashboard/tools/aois", projectHref: "/aois", icon: Package },
  { name: "Analysis", globalHref: "/dashboard/tools/analysis", projectHref: "/analysis", icon: BarChart3 },
  { name: "AI Assistant", globalHref: "/dashboard/tools/ai", projectHref: "/ai", icon: Sparkles, isAI: true },
];

// Global tools (always cross-project)
const globalTools = [
  { name: "File Compare", href: "/dashboard/tools/compare", icon: FileCode2 },
];

// Extract project ID from pathname if on a project page
function getProjectIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/dashboard\/projects\/([^/]+)/);
  return match ? match[1] : null;
}

interface SidebarContentProps {
  onNavClick?: () => void;
  isPlatformAdmin?: boolean;
}

interface Project {
  id: string;
  name: string;
  is_favorite: boolean;
  created_by?: string;
}

export function SidebarContent({ onNavClick, isPlatformAdmin: isPlatformAdminProp }: SidebarContentProps) {
  const pathname = usePathname();
  const router = useRouter();
  const projectId = getProjectIdFromPath(pathname);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(isPlatformAdminProp || false);
  const [unreadFeedbackCount, setUnreadFeedbackCount] = useState(0);
  const supabase = createClient();

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch("/api/feedback?unread=true");
      if (res.ok) {
        const data = await res.json();
        setUnreadFeedbackCount(data.count || 0);
      }
    } catch {
      // Silently fail — badge just won't show
    }
  }, []);

  // Re-fetch unread count when feedback changes
  useEffect(() => {
    if (!isPlatformAdmin) return;
    const handler = () => fetchUnreadCount();
    window.addEventListener("feedback-updated", handler);
    return () => window.removeEventListener("feedback-updated", handler);
  }, [isPlatformAdmin, fetchUnreadCount]);

  // Fetch current project, all projects, and admin status
  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        // Only fetch admin status if not provided as prop
        if (isPlatformAdminProp === undefined) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("is_platform_admin")
            .eq("id", user.id)
            .single();
          setIsPlatformAdmin(profile?.is_platform_admin || false);
          if (profile?.is_platform_admin) {
            fetchUnreadCount();
          }
        } else if (isPlatformAdminProp) {
          fetchUnreadCount();
        }
      }

      // Fetch all projects for dropdown (exclude archived)
      const { data: projects } = await supabase
        .from("projects")
        .select("id, name, is_favorite, created_by")
        .eq("is_archived", false)
        .order("name");

      if (projects) {
        setAllProjects(projects);
        // Set current project if we have a projectId
        if (projectId) {
          const current = projects.find((p) => p.id === projectId);
          setCurrentProject(current || null);
        } else {
          setCurrentProject(null);
        }
      }
    };

    fetchData();
  }, [projectId, pathname, supabase]);

  const handleProjectSwitch = (newProjectId: string) => {
    if (newProjectId === projectId) {
      // Deselect: navigate to the matching global tool page, or stay on projects list
      const subPath = pathname.replace(/^\/dashboard\/projects\/[^/]+/, "");
      const matchingTool = projectTools.find((t) => t.projectHref === subPath);
      router.push(matchingTool?.globalHref || "/dashboard/projects");
      onNavClick?.();
      return;
    }
    // Get the current sub-path within the project (e.g., /tags, /analysis)
    const subPath = pathname.replace(/^\/dashboard\/projects\/[^/]+/, "");
    // Navigate to the same sub-path in the new project
    router.push(`/dashboard/projects/${newProjectId}${subPath || ""}`);
    onNavClick?.();
  };

  const handleProjectSelect = (selectedProjectId: string) => {
    // If on a global tool page, navigate to the same tool within the project
    const currentTool = projectTools.find(
      (t) => pathname === t.globalHref || pathname.startsWith(t.globalHref + "/")
    );
    if (currentTool?.projectHref) {
      router.push(`/dashboard/projects/${selectedProjectId}${currentTool.projectHref}`);
    } else {
      router.push(`/dashboard/projects/${selectedProjectId}`);
    }
    onNavClick?.();
  };

  return (
    <>
      <nav className="flex-1 space-y-1 p-4">
        <div className="space-y-1">
          {navigation.map((item) => {
            // Dashboard should only be active when exactly on /dashboard
            const isActive = item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onNavClick}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            );
          })}
        </div>
        <div className="pt-6">
          <div className="px-3 mb-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Tools
            </p>
          </div>

          {/* Project selector/switcher dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              {projectId && currentProject ? (
                <button className="mb-3 w-full flex items-center gap-2 px-2.5 py-2 rounded-lg bg-primary/10 border border-primary/20 hover:bg-primary/15 transition-colors text-left">
                  <FolderIcon className="h-4 w-4 text-primary flex-shrink-0" />
                  <span className="text-xs font-medium text-primary truncate flex-1">
                    {currentProject.name}
                  </span>
                  <ChevronDown className="h-3 w-3 text-primary flex-shrink-0" />
                </button>
              ) : (
                <button className="mb-3 w-full flex items-center gap-2 px-2.5 py-2 rounded-lg bg-muted/50 border border-dashed border-muted-foreground/20 hover:bg-muted hover:border-muted-foreground/40 transition-colors text-left">
                  <FolderIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-xs text-muted-foreground truncate flex-1">
                    Select a project
                  </span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                </button>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                {projectId ? "Switch Project" : "Select Project"}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {allProjects.length === 0 ? (
                <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                  No projects yet
                </div>
              ) : (
                (() => {
                  const owned = allProjects.filter((p) => !currentUserId || !p.created_by || p.created_by === currentUserId);
                  const shared = allProjects.filter((p) => currentUserId && p.created_by && p.created_by !== currentUserId);
                  const favorites = owned.filter((p) => p.is_favorite);
                  const regular = owned.filter((p) => !p.is_favorite);

                  return (
                    <>
                      {favorites.length > 0 && (
                        <>
                          <DropdownMenuLabel className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                            Favorites
                          </DropdownMenuLabel>
                          {favorites.map((project) => (
                            <DropdownMenuItem
                              key={project.id}
                              onClick={() => projectId ? handleProjectSwitch(project.id) : handleProjectSelect(project.id)}
                              className="flex items-center gap-2"
                            >
                              <FolderIcon className="h-4 w-4 text-muted-foreground" />
                              <span className="truncate flex-1">{project.name}</span>
                              {project.id === projectId && (
                                <Check className="h-4 w-4 text-primary" />
                              )}
                            </DropdownMenuItem>
                          ))}
                          {(regular.length > 0 || shared.length > 0) && (
                            <DropdownMenuSeparator />
                          )}
                        </>
                      )}
                      {regular.map((project) => (
                        <DropdownMenuItem
                          key={project.id}
                          onClick={() => projectId ? handleProjectSwitch(project.id) : handleProjectSelect(project.id)}
                          className="flex items-center gap-2"
                        >
                          <FolderIcon className="h-4 w-4 text-muted-foreground" />
                          <span className="truncate flex-1">{project.name}</span>
                          {project.id === projectId && (
                            <Check className="h-4 w-4 text-primary" />
                          )}
                        </DropdownMenuItem>
                      ))}
                      {shared.length > 0 && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuLabel className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <Users className="h-3 w-3" />
                            Shared with me
                          </DropdownMenuLabel>
                          {shared.map((project) => (
                            <DropdownMenuItem
                              key={project.id}
                              onClick={() => projectId ? handleProjectSwitch(project.id) : handleProjectSelect(project.id)}
                              className="flex items-center gap-2"
                            >
                              <FolderIcon className="h-4 w-4 text-muted-foreground" />
                              <span className="truncate flex-1">{project.name}</span>
                              {project.id === projectId && (
                                <Check className="h-4 w-4 text-primary" />
                              )}
                            </DropdownMenuItem>
                          ))}
                        </>
                      )}
                    </>
                  );
                })()
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/dashboard/projects" className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  <span>View All Projects</span>
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className={cn(
            "space-y-0.5",
            projectId && "ml-3 pl-3 border-l-2 border-primary/20"
          )}>
            {projectTools.map((item) => {
              // Use project-specific href if on a project page and tool supports it
              const href = projectId && item.projectHref
                ? `/dashboard/projects/${projectId}${item.projectHref}`
                : item.globalHref;

              // Check if active (either global or project-specific path)
              const isActive = pathname === href ||
                pathname.startsWith(href + "/") ||
                pathname === item.globalHref ||
                pathname.startsWith(item.globalHref + "/") ||
                (projectId && item.projectHref && pathname.startsWith(`/dashboard/projects/${projectId}${item.projectHref}`));

              const isAI = "isAI" in item && item.isAI;
              return (
                <Link
                  key={item.name}
                  href={href}
                  onClick={onNavClick}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    projectId ? "py-1.5 text-[13px]" : "",
                    isActive
                      ? isAI
                        ? "bg-amber-500 text-white font-medium"
                        : "bg-primary text-primary-foreground font-medium"
                      : isAI
                        ? "text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <item.icon className={cn("h-4 w-4", projectId && "h-3.5 w-3.5", !isActive && isAI && "text-amber-500")} />
                  {item.name}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Global tools section */}
        <div className="pt-4">
          <div className="px-3 mb-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Cross-Project
            </p>
          </div>
          <div className="space-y-0.5">
            {globalTools.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={onNavClick}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
      <div className="border-t p-4 space-y-1">
        {isPlatformAdmin && (
          <Link
            href="/dashboard/admin"
            onClick={onNavClick}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              pathname === "/dashboard/admin" || pathname.startsWith("/dashboard/admin/")
                ? "bg-primary text-primary-foreground"
                : "text-primary hover:bg-primary/10"
            )}
          >
            <Shield className="h-4 w-4" />
            Admin
            {unreadFeedbackCount > 0 && (
              <span className="ml-auto h-5 min-w-5 px-1 rounded-full bg-destructive text-white text-xs flex items-center justify-center font-medium">
                {unreadFeedbackCount > 9 ? "9+" : unreadFeedbackCount}
              </span>
            )}
          </Link>
        )}
        <Link
          href="/dashboard/settings"
          onClick={onNavClick}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            pathname === "/dashboard/settings"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          )}
        >
          <Settings className="h-4 w-4" />
          Settings
        </Link>
      </div>
    </>
  );
}

export function Sidebar({ isPlatformAdmin }: { isPlatformAdmin?: boolean }) {
  return (
    <div className="hidden md:flex h-full w-64 flex-col border-r bg-card">
      <div className="flex h-16 items-center border-b px-4">
        <Link href="/dashboard" className="flex items-center">
          <Logo size="lg" />
        </Link>
      </div>
      <SidebarContent isPlatformAdmin={isPlatformAdmin} />
    </div>
  );
}
