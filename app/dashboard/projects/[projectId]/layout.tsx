import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Lock, Trash2 } from "lucide-react";
import { LeaveProjectButton } from "@/components/projects/leave-project-button";
import { RestoreProjectButton } from "@/components/dashboard/restore-project-button";
import { AIChatProvider } from "@/components/ai/ai-chat-provider";
import { AIChatSidebar } from "@/components/ai/ai-chat-sidebar";
import { AIChatButton } from "@/components/ai/ai-chat-button";
import { getProjectAccess } from "@/lib/project-access";

interface ProjectLayoutProps {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}

export default async function ProjectLayout({
  children,
  params,
}: ProjectLayoutProps) {
  const { projectId } = await params;

  const access = await getProjectAccess();
  if (!access) return <>{children}</>;

  const { supabase, user, isAdmin } = access;

  // Check if project has any parsed files
  const { data: project } = await supabase
    .from("projects")
    .select("id, name, created_by, is_archived, deleted_at, project_files(id, parsing_status)")
    .eq("id", projectId)
    .single();

  // Block access to trashed projects
  if (project?.deleted_at) {
    const isCreator = user.id === project.created_by;
    if (isCreator || isAdmin) {
      const deletedDate = new Date(project.deleted_at);
      const expiresDate = new Date(deletedDate.getTime() + 30 * 24 * 60 * 60 * 1000);
      const daysRemaining = Math.max(0, Math.ceil((expiresDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));

      return (
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="max-w-md w-full">
            <CardContent className="py-12 text-center">
              <Trash2 className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-lg font-semibold mb-2">This project is in the trash</h2>
              <p className="text-sm text-muted-foreground mb-1">
                &quot;{project.name}&quot; was moved to trash on {deletedDate.toLocaleDateString()}.
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                It will be permanently deleted in {daysRemaining} {daysRemaining === 1 ? "day" : "days"}.
              </p>
              <div className="flex items-center justify-center gap-3">
                <RestoreProjectButton projectId={projectId} projectName={project.name} />
                <Button variant="outline" asChild>
                  <Link href="/dashboard/trash">View Trash</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    // Collaborators see a generic message
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <Lock className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Project is no longer accessible</h2>
            <p className="text-sm text-muted-foreground mb-6">
              This project has been removed by its owner.
            </p>
            <Button asChild>
              <Link href="/dashboard/projects">Back to Projects</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Block non-owners from accessing archived projects (admins can always view)
  if (project?.is_archived && !isAdmin) {
    if (user.id !== project.created_by) {
      return (
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="max-w-md w-full">
            <CardContent className="py-12 text-center">
              <Lock className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-lg font-semibold mb-2">Project is no longer accessible</h2>
              <p className="text-sm text-muted-foreground mb-6">
                The project owner has archived this project. Contact them if you need access restored.
              </p>
              <div className="flex items-center justify-center gap-3">
                <Button asChild>
                  <Link href="/dashboard/projects">Back to Projects</Link>
                </Button>
                <LeaveProjectButton projectId={projectId} projectName={project.name} />
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }
  }

  const hasData =
    project?.project_files?.some(
      (f: { parsing_status: string }) => f.parsing_status === "completed"
    ) ?? false;

  return (
    <AIChatProvider projectId={projectId}>
      {children}
      {hasData && (
        <>
          <AIChatSidebar />
          <AIChatButton />
        </>
      )}
    </AIChatProvider>
  );
}
