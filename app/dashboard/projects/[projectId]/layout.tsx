import { createClient } from "@/lib/supabase/server";
import { AIChatProvider } from "@/components/ai/ai-chat-provider";
import { AIChatSidebar } from "@/components/ai/ai-chat-sidebar";
import { AIChatButton } from "@/components/ai/ai-chat-button";

interface ProjectLayoutProps {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}

export default async function ProjectLayout({
  children,
  params,
}: ProjectLayoutProps) {
  const { projectId } = await params;

  const supabase = await createClient();

  // Check if project has any parsed files
  const { data: project } = await supabase
    .from("projects")
    .select("id, project_files(id, parsing_status)")
    .eq("id", projectId)
    .single();

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
