"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
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
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Projects", href: "/dashboard/projects", icon: FolderOpen },
];

const tools = [
  { name: "Tag Explorer", href: "/dashboard/tools/tags", icon: Tags },
  { name: "I/O Mapping", href: "/dashboard/tools/io", icon: HardDrive },
  { name: "UDTs", href: "/dashboard/tools/udts", icon: Layers },
  { name: "AOIs", href: "/dashboard/tools/aois", icon: Package },
  { name: "Analysis", href: "/dashboard/tools/analysis", icon: BarChart3 },
  { name: "AI Assistant", href: "/dashboard/tools/ai", icon: Sparkles, isAI: true },
  { name: "Project Compare", href: "/dashboard/tools/compare", icon: FileCode2 },
];

interface SidebarContentProps {
  onNavClick?: () => void;
}

export function SidebarContent({ onNavClick }: SidebarContentProps) {
  const pathname = usePathname();

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
          <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Tools
          </p>
          <div className="mt-2 space-y-1">
            {tools.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              const isAI = "isAI" in item && item.isAI;
              return (
                <Link
                  key={item.name}
                  href={item.href}
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
