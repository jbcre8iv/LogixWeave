"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Logo, LogoIcon } from "@/components/ui/logo";
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
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Projects", href: "/dashboard/projects", icon: FolderOpen },
];

// Tools with both global and project-specific paths
const tools = [
  { name: "Tag Explorer", globalHref: "/dashboard/tools/tags", projectHref: "/tags", icon: Tags },
  { name: "I/O Mapping", globalHref: "/dashboard/tools/io", projectHref: "/io-mapping", icon: HardDrive },
  { name: "UDTs", globalHref: "/dashboard/tools/udts", projectHref: "/udts", icon: Layers },
  { name: "AOIs", globalHref: "/dashboard/tools/aois", projectHref: "/aois", icon: Package },
  { name: "Analysis", globalHref: "/dashboard/tools/analysis", projectHref: "/analysis", icon: BarChart3 },
  { name: "Project Compare", globalHref: "/dashboard/tools/compare", projectHref: null, icon: FileCode2 }, // Always global
  { name: "AI Assistant", globalHref: "/dashboard/tools/ai", projectHref: "/ai", icon: Sparkles, isAI: true },
];

// Extract project ID from pathname if on a project page
function getProjectIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/dashboard\/projects\/([^/]+)/);
  return match ? match[1] : null;
}

interface SidebarContentProps {
  onNavClick?: () => void;
}

export function SidebarContent({ onNavClick }: SidebarContentProps) {
  const pathname = usePathname();
  const projectId = getProjectIdFromPath(pathname);
  const [projectName, setProjectName] = useState<string | null>(null);
  const supabase = createClient();

  // Fetch project name when projectId changes
  useEffect(() => {
    if (!projectId) {
      setProjectName(null);
      return;
    }

    const fetchProjectName = async () => {
      const { data } = await supabase
        .from("projects")
        .select("name")
        .eq("id", projectId)
        .single();

      if (data) {
        setProjectName(data.name);
      }
    };

    fetchProjectName();
  }, [projectId, supabase]);

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

          {/* Project context badge */}
          {projectId && projectName && (
            <Link
              href={`/dashboard/projects/${projectId}`}
              className="mx-3 mb-3 flex items-center gap-2 px-2.5 py-2 rounded-lg bg-primary/10 border border-primary/20 hover:bg-primary/15 transition-colors group"
            >
              <FolderIcon className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="text-xs font-medium text-primary truncate flex-1">
                {projectName}
              </span>
            </Link>
          )}

          {!projectId && (
            <div className="mx-3 mb-3 px-2.5 py-2 rounded-lg bg-muted/50 border border-dashed border-muted-foreground/20">
              <p className="text-xs text-muted-foreground text-center">
                Select a project for context
              </p>
            </div>
          )}

          <div className={cn(
            "space-y-1",
            projectId && "relative before:absolute before:left-1 before:top-0 before:bottom-0 before:w-0.5 before:bg-primary/20 before:rounded-full"
          )}>
            {tools.map((item) => {
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
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? isAI
                        ? "bg-amber-500 text-white"
                        : "bg-primary text-primary-foreground"
                      : isAI
                        ? "text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <item.icon className={cn("h-4 w-4", !isActive && isAI && "text-amber-500")} />
                  {item.name}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
      <div className="border-t p-4">
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

export function Sidebar() {
  return (
    <div className="hidden md:flex h-full w-64 flex-col border-r bg-card">
      <div className="flex h-16 items-center border-b px-4">
        <Link href="/dashboard" className="flex items-center">
          <Logo size="lg" />
        </Link>
      </div>
      <SidebarContent />
    </div>
  );
}
