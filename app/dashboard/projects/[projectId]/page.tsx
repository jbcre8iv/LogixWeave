import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Archive,
  ArrowLeft,
  Upload,
  FileText,
  Tags,
  HardDrive,
  Calendar,
  Eye,
  Pencil,
  Crown,
  Shield,
} from "lucide-react";
import { DeleteProjectButton } from "@/components/dashboard/delete-project-button";
import { ArchiveProjectButton } from "@/components/dashboard/archive-project-button";
import { ShareProjectDialog } from "@/components/dashboard/share-project-dialog";
import { RequestPermissionDialog } from "@/components/dashboard/request-permission-dialog";
import { PermissionRequestsList } from "@/components/dashboard/permission-requests-list";
import { ProjectInvitePrompt } from "@/components/dashboard/project-invite-prompt";
import { ActivityLog } from "@/components/projects/activity-log";
import { ActivitySummaryBanner } from "@/components/projects/activity-summary-banner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { RuleSetPicker } from "@/components/tools/rule-set-picker";

interface ProjectPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { projectId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  // Check if user is platform admin
  let isPlatformAdmin = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_platform_admin")
      .eq("id", user.id)
      .single();
    isPlatformAdmin = profile?.is_platform_admin || false;
  }

  // Use service client for platform admins to bypass RLS
  const queryClient = isPlatformAdmin ? await createServiceClient() : supabase;

  const { data: project, error } = await queryClient
    .from("projects")
    .select(`
      *,
      profiles:created_by(full_name, email, avatar_url),
      project_files(
        id,
        file_name,
        file_type,
        file_size,
        parsing_status,
        current_version,
        created_at
      )
    `)
    .eq("id", projectId)
    .single();

  if (error || !project) {
    notFound();
  }

  const isOwner = project.created_by === user?.id;

  // Check user's permission level
  let userPermission: "owner" | "edit" | "view" | "admin" | null = isOwner ? "owner" : isPlatformAdmin ? "admin" : null;
  let canEdit = isOwner || isPlatformAdmin;
  let pendingShareId: string | null = null;

  if (!isOwner && !isPlatformAdmin && user) {
    const { data: share } = await supabase
      .from("project_shares")
      .select("id, permission, accepted_at")
      .eq("project_id", projectId)
      .or(`shared_with_user_id.eq.${user.id},shared_with_email.eq.${user.email}`)
      .single();

    if (share) {
      if (share.accepted_at) {
        // User has accepted the invite
        userPermission = share.permission as "owner" | "edit" | "view";
        canEdit = share.permission === "edit" || share.permission === "owner";
      } else {
        // User has a pending invite
        pendingShareId = share.id;
      }
    }
  }

  // If user has no access and no pending invite, show not found
  if (!isOwner && !isPlatformAdmin && !userPermission && !pendingShareId) {
    notFound();
  }

  // Show invite prompt if user has pending invite
  if (pendingShareId) {
    return (
      <ProjectInvitePrompt
        projectId={projectId}
        projectName={project.name}
        shareId={pendingShareId}
      />
    );
  }

  // Get tag and routine counts
  const fileIds = project.project_files?.map((f: { id: string }) => f.id) || [];

  let tagCount = 0;
  let routineCount = 0;
  let moduleCount = 0;

  if (fileIds.length > 0) {
    const [tagsResult, routinesResult, modulesResult] = await Promise.all([
      queryClient
        .from("parsed_tags")
        .select("*", { count: "exact", head: true })
        .in("file_id", fileIds),
      queryClient
        .from("parsed_routines")
        .select("*", { count: "exact", head: true })
        .in("file_id", fileIds),
      queryClient
        .from("parsed_io_modules")
        .select("*", { count: "exact", head: true })
        .in("file_id", fileIds),
    ]);
    tagCount = tagsResult.count || 0;
    routineCount = routinesResult.count || 0;
    moduleCount = modulesResult.count || 0;
  }

  // Fetch rule sets for the picker (graceful if migration not applied)
  const { data: projectRuleSetRow } = await queryClient
    .from("projects")
    .select("naming_rule_set_id")
    .eq("id", projectId)
    .single();
  const projectRuleSetId: string | null = projectRuleSetRow?.naming_rule_set_id ?? null;

  const { data: ruleSets } = await queryClient
    .from("naming_rule_sets")
    .select("id, name, is_default")
    .eq("organization_id", project.organization_id)
    .order("is_default", { ascending: false })
    .order("name");

  const creatorProfile = project.profiles as { full_name?: string; email?: string; avatar_url?: string } | null;
  const creatorName = creatorProfile?.full_name || creatorProfile?.email || "Unknown";
  const creatorAvatar = creatorProfile?.avatar_url || null;
  const creatorInitials = creatorProfile?.full_name
    ? creatorProfile.full_name.split(" ").map((n) => n[0]).join("").toUpperCase()
    : creatorProfile?.email?.[0].toUpperCase() || "?";

  return (
    <div className="space-y-6">
      {/* Header - stacks on mobile */}
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" asChild className="shrink-0 mt-1">
            <Link href="/dashboard/projects">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl md:text-3xl font-bold break-words">{project.name}</h1>
              {project.is_archived && (
                <Badge variant="secondary" className="text-sm py-1 px-2.5">
                  <Archive className="h-3 w-3 mr-1" />
                  Archived
                </Badge>
              )}
            </div>
            {project.description && (
              <p className="text-muted-foreground text-sm md:text-base">{project.description}</p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Show permission badge for non-owners */}
          {!isOwner && userPermission && (
            <Badge
              variant={userPermission === "admin" ? "default" : userPermission === "owner" ? "default" : userPermission === "edit" ? "secondary" : "outline"}
              className={`text-sm py-1.5 px-3 ${userPermission === "admin" ? "bg-primary" : ""}`}
            >
              {userPermission === "admin" ? (
                <><Shield className="h-3 w-3 mr-1" /> Admin Access</>
              ) : userPermission === "owner" ? (
                <><Crown className="h-3 w-3 mr-1" /> Co-Owner</>
              ) : userPermission === "edit" ? (
                <><Pencil className="h-3 w-3 mr-1" /> Can Edit</>
              ) : (
                <><Eye className="h-3 w-3 mr-1" /> View Only</>
              )}
            </Badge>
          )}
          {/* Request higher permissions for shared users (not owners or admins) */}
          {!isOwner && !isPlatformAdmin && userPermission && userPermission !== "owner" && (
            <RequestPermissionDialog
              projectId={projectId}
              projectName={project.name}
              currentPermission={userPermission as "view" | "edit"}
            />
          )}
          {canEdit && (
            <Button asChild className="flex-1 sm:flex-none">
              <Link href={`/dashboard/projects/${projectId}/files`}>
                <Upload className="mr-2 h-4 w-4" />
                Manage Files
              </Link>
            </Button>
          )}
          {(isOwner || userPermission === "owner") && (
            <>
              <ShareProjectDialog projectId={projectId} projectName={project.name} />
              {!project.is_archived && (
                <ArchiveProjectButton projectId={projectId} projectName={project.name} />
              )}
              <DeleteProjectButton projectId={projectId} projectName={project.name} />
            </>
          )}
        </div>
      </div>

      {/* Activity summary banner for returning users */}
      <ActivitySummaryBanner projectId={projectId} />

      {/* Permission requests for owners */}
      {isOwner && (
        <PermissionRequestsList projectId={projectId} />
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link href={`/dashboard/projects/${projectId}/files`}>
          <Card className="transition-colors hover:bg-accent/50 cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Files</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{project.project_files?.length || 0}</div>
              <p className="text-xs text-muted-foreground">L5X/L5K files uploaded</p>
            </CardContent>
          </Card>
        </Link>

        {tagCount > 0 ? (
          <Link href={`/dashboard/projects/${projectId}/tags`}>
            <Card className="transition-colors hover:bg-accent/50 cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tags</CardTitle>
                <Tags className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{tagCount}</div>
                <p className="text-xs text-muted-foreground">Total tags parsed</p>
              </CardContent>
            </Card>
          </Link>
        ) : (
          <Card className="opacity-50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tags</CardTitle>
              <Tags className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">Upload files to parse tags</p>
            </CardContent>
          </Card>
        )}

        {routineCount > 0 ? (
          <Link href={`/dashboard/projects/${projectId}/routines`}>
            <Card className="transition-colors hover:bg-accent/50 cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Routines</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{routineCount}</div>
                <p className="text-xs text-muted-foreground">Programs/routines found</p>
              </CardContent>
            </Card>
          </Link>
        ) : (
          <Card className="opacity-50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Routines</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">Upload files to parse routines</p>
            </CardContent>
          </Card>
        )}

        {moduleCount > 0 ? (
          <Link href={`/dashboard/projects/${projectId}/io-mapping`}>
            <Card className="transition-colors hover:bg-accent/50 cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">I/O Modules</CardTitle>
                <HardDrive className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{moduleCount}</div>
                <p className="text-xs text-muted-foreground">Hardware modules</p>
              </CardContent>
            </Card>
          </Link>
        ) : (
          <Card className="opacity-50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">I/O Modules</CardTitle>
              <HardDrive className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">Upload files to parse I/O</p>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Project Files</CardTitle>
            <CardDescription>Uploaded L5X/L5K files</CardDescription>
          </CardHeader>
          <CardContent>
            {project.project_files && project.project_files.length > 0 ? (
              <div className="space-y-3">
                {project.project_files.map((file: {
                  id: string;
                  file_name: string;
                  file_type: string;
                  file_size: number;
                  parsing_status: string;
                  current_version: number | null;
                  created_at: string;
                }) => (
                  <div key={file.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{file.file_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(file.file_size / 1024).toFixed(1)} KB • {file.file_type.toUpperCase()}
                        </p>
                      </div>
                    </div>
                    {(file.current_version ?? 1) > 1 && (
                      <Badge variant="outline" className="text-xs">
                        v{file.current_version}
                      </Badge>
                    )}
                    <Badge
                      variant={
                        file.parsing_status === "completed"
                          ? "default"
                          : file.parsing_status === "failed"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {file.parsing_status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground mb-4">No files uploaded yet</p>
                <Button asChild size="sm">
                  <Link href={`/dashboard/projects/${projectId}/files`}>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Files
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Project Info</CardTitle>
            <CardDescription>Details and metadata</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={creatorAvatar || undefined} alt={creatorName} />
                <AvatarFallback className="text-sm">{creatorInitials}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm text-muted-foreground">Created by</p>
                <p className="font-medium">{creatorName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Created</p>
                <p className="font-medium">
                  {new Date(project.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Last updated</p>
                <p className="font-medium">
                  {new Date(project.updated_at).toLocaleDateString()}
                </p>
              </div>
            </div>
            {ruleSets && ruleSets.length > 0 && (
              <div className="flex items-center gap-3">
                <Tags className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-muted-foreground mb-1">Naming Rules</p>
                  <RuleSetPicker
                    projectId={projectId}
                    ruleSets={ruleSets}
                    currentRuleSetId={projectRuleSetId}
                    className="w-full"
                  />
                  <Link
                    href="/dashboard/settings/naming-rules"
                    className="text-xs text-blue-500 hover:text-blue-600 underline mt-1 inline-block"
                  >
                    Manage Rules
                  </Link>
                </div>
              </div>
            )}
            {(tagCount > 0 || routineCount > 0 || moduleCount > 0) && (
              <div className="pt-4 space-y-2">
                {tagCount > 0 && (
                  <Button asChild variant="outline" className="w-full">
                    <Link href={`/dashboard/projects/${projectId}/tags`}>
                      <Tags className="mr-2 h-4 w-4" />
                      Browse Tags
                    </Link>
                  </Button>
                )}
                {routineCount > 0 && (
                  <Button asChild variant="outline" className="w-full">
                    <Link href={`/dashboard/projects/${projectId}/routines`}>
                      <FileText className="mr-2 h-4 w-4" />
                      Browse Routines
                    </Link>
                  </Button>
                )}
                {moduleCount > 0 && (
                  <Button asChild variant="outline" className="w-full">
                    <Link href={`/dashboard/projects/${projectId}/io-mapping`}>
                      <HardDrive className="mr-2 h-4 w-4" />
                      Explore I/O
                    </Link>
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Activity Log */}
      <ActivityLog projectId={projectId} />
    </div>
  );
}
