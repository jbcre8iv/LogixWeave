"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createOrganization(name: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  // Create the organization
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .insert({ name })
    .select()
    .single();

  if (orgError) {
    throw new Error(orgError.message);
  }

  // Add user as owner
  const { error: memberError } = await supabase.from("organization_members").insert({
    organization_id: org.id,
    user_id: user.id,
    role: "owner",
  });

  if (memberError) {
    throw new Error(memberError.message);
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

  // Check if user already has an organization
  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id, organizations(id, name)")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (membership?.organizations) {
    return membership.organizations;
  }

  // Create default organization for user
  const profile = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  const orgName = profile.data?.full_name
    ? `${profile.data.full_name}'s Workspace`
    : `${user.email}'s Workspace`;

  return createOrganization(orgName);
}

export async function createProject(formData: FormData) {
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

  // Get or create organization
  const org = await getOrCreateDefaultOrganization();

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
    throw new Error(error.message);
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
