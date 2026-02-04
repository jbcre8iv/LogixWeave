"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function createOrganization(name: string, userId: string) {
  // Use service client to bypass RLS for initial organization setup
  const supabase = await createServiceClient();

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
  const serviceSupabase = await createServiceClient();

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

  const { error } = await supabase
    .from("projects")
    .update({
      name: name.trim(),
      description: description?.trim() || null,
    })
    .eq("id", projectId);

  if (error) {
    throw new Error(error.message);
  }

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

  const { error } = await supabase.from("projects").delete().eq("id", projectId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/projects");
  redirect("/dashboard/projects");
}
