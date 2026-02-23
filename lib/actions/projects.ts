"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";

// ---------------------------------------------------------------------------
// Storage cleanup helper — removes all files from the project-files bucket
// that belong to the given project's file records.
// ---------------------------------------------------------------------------
async function cleanupProjectStorage(projectId: string) {
  const serviceSupabase = createServiceClient();

  const { data: files } = await serviceSupabase
    .from("project_files")
    .select("storage_path")
    .eq("project_id", projectId);

  if (!files || files.length === 0) return;

  const paths = files.map((f) => f.storage_path).filter(Boolean) as string[];
  if (paths.length === 0) return;

  const { error } = await serviceSupabase.storage
    .from("project-files")
    .remove(paths);

  if (error) {
    console.error(`Storage cleanup failed for project ${projectId}:`, error);
  }
}

export async function createOrganization(name: string, userId: string) {
  // Use service client to bypass RLS for initial organization setup
  const supabase = createServiceClient();

  // Create the organization
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .insert({ name })
    .select()
    .single();

  if (orgError) {
    throw new Error(`Failed to create organization: ${orgError.message}`);
  }

  // Add user as owner
  const { error: memberError } = await supabase.from("organization_members").insert({
    organization_id: org.id,
    user_id: userId,
    role: "owner",
  });

  if (memberError) {
    throw new Error(`Failed to add member: ${memberError.message}`);
  }

  return org;
}

export async function getOrCreateDefaultOrganization() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  // Use service client to check membership (bypass RLS)
  const serviceSupabase = createServiceClient();

  // Check if user already has an organization
  const { data: membership } = await serviceSupabase
    .from("organization_members")
    .select("organization_id, organizations(id, name)")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (membership?.organizations) {
    return membership.organizations as unknown as { id: string; name: string };
  }

  // Check/create user profile first
  const { data: profile } = await serviceSupabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  // If profile doesn't exist, create it
  if (!profile) {
    await serviceSupabase.from("profiles").insert({
      id: user.id,
      email: user.email!,
      full_name: user.user_metadata?.full_name || null,
    });
  }

  const orgName = profile?.full_name
    ? `${profile.full_name}'s Workspace`
    : `${user.email}'s Workspace`;

  return createOrganization(orgName, user.id);
}

export async function createProject(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const name = formData.get("name") as string;
  const description = formData.get("description") as string;

  if (!name || name.trim().length === 0) {
    return { error: "Project name is required" };
  }

  // Get or create organization
  let org;
  try {
    org = await getOrCreateDefaultOrganization();
  } catch (orgError) {
    console.error("Organization error:", orgError);
    return { error: `Failed to setup workspace: ${orgError instanceof Error ? orgError.message : "Unknown error"}` };
  }

  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      organization_id: org.id,
      name: name.trim(),
      description: description?.trim() || null,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    console.error("Project creation error:", error);
    return { error: `Failed to create project: ${error.message}` };
  }

  await logActivity({
    projectId: project.id,
    userId: user.id,
    userEmail: user.email,
    action: "project_created",
    targetType: "project",
    targetId: project.id,
    targetName: project.name,
  });

  revalidatePath("/dashboard/projects");
  redirect(`/dashboard/projects/${project.id}`);
}

export async function updateProject(projectId: string, formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const name = formData.get("name") as string;
  const description = formData.get("description") as string;

  if (!name || name.trim().length === 0) {
    throw new Error("Project name is required");
  }

  // Fetch current values to compute what changed
  const { data: current } = await supabase
    .from("projects")
    .select("name, description")
    .eq("id", projectId)
    .single();

  const newName = name.trim();
  const newDescription = description?.trim() || null;

  const { error } = await supabase
    .from("projects")
    .update({
      name: newName,
      description: newDescription,
    })
    .eq("id", projectId);

  if (error) {
    throw new Error(error.message);
  }

  // Build metadata describing what changed
  const changes: Record<string, { from: string | null; to: string | null }> = {};
  if (current) {
    if (current.name !== newName) {
      changes.name = { from: current.name, to: newName };
    }
    if ((current.description || null) !== newDescription) {
      changes.description = { from: current.description || null, to: newDescription };
    }
  }

  await logActivity({
    projectId,
    userId: user.id,
    userEmail: user.email,
    action: "project_updated",
    targetType: "project",
    targetId: projectId,
    targetName: newName,
    metadata: Object.keys(changes).length > 0 ? { changes } : undefined,
  });

  revalidatePath(`/dashboard/projects/${projectId}`);
  revalidatePath("/dashboard/projects");
}

export async function deleteProject(projectId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch project name for activity log
  const { data: project } = await supabase
    .from("projects")
    .select("name")
    .eq("id", projectId)
    .single();

  // Soft-delete: set deleted_at/deleted_by instead of hard DELETE
  const { error } = await supabase
    .from("projects")
    .update({ deleted_at: new Date().toISOString(), deleted_by: user.id })
    .eq("id", projectId);

  if (error) {
    throw new Error(error.message);
  }

  await logActivity({
    projectId,
    userId: user.id,
    userEmail: user.email,
    action: "project_trashed",
    targetType: "project",
    targetId: projectId,
    targetName: project?.name,
  });

  revalidatePath("/dashboard/projects");
  revalidatePath("/dashboard/trash");
}

export async function restoreProject(projectId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch project name for activity log
  const { data: project } = await supabase
    .from("projects")
    .select("name")
    .eq("id", projectId)
    .single();

  const { error } = await supabase
    .from("projects")
    .update({ deleted_at: null, deleted_by: null })
    .eq("id", projectId);

  if (error) {
    throw new Error(error.message);
  }

  await logActivity({
    projectId,
    userId: user.id,
    userEmail: user.email,
    action: "project_restored",
    targetType: "project",
    targetId: projectId,
    targetName: project?.name,
  });

  revalidatePath("/dashboard/projects");
  revalidatePath("/dashboard/trash");
}

export async function permanentlyDeleteProject(projectId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Verify project is in trash before allowing permanent delete
  const { data: project } = await supabase
    .from("projects")
    .select("id, deleted_at")
    .eq("id", projectId)
    .single();

  if (!project?.deleted_at) {
    throw new Error("Project must be in trash before it can be permanently deleted");
  }

  // Clean up storage files first
  await cleanupProjectStorage(projectId);

  // Hard delete — CASCADE handles child tables
  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", projectId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/projects");
  revalidatePath("/dashboard/trash");
}

export async function emptyTrash() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch all trashed projects owned by this user
  const { data: trashedProjects } = await supabase
    .from("projects")
    .select("id")
    .eq("created_by", user.id)
    .not("deleted_at", "is", null);

  if (!trashedProjects || trashedProjects.length === 0) return;

  // Clean up storage for each project
  for (const project of trashedProjects) {
    await cleanupProjectStorage(project.id);
  }

  // Hard delete all trashed projects owned by this user
  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("created_by", user.id)
    .not("deleted_at", "is", null);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/projects");
  revalidatePath("/dashboard/trash");
}


export async function archiveProject(projectId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase
    .from("projects")
    .update({ is_archived: true })
    .eq("id", projectId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/projects");
  redirect("/dashboard/projects");
}

export async function unarchiveProject(projectId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase
    .from("projects")
    .update({ is_archived: false })
    .eq("id", projectId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/projects");
  revalidatePath(`/dashboard/projects/${projectId}`);
}
