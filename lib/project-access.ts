import { createClient, createServiceClient } from "@/lib/supabase/server";
import { SupabaseClient } from "@supabase/supabase-js";
import { User } from "@supabase/supabase-js";

interface ProjectAccess {
  /** RLS-aware client for regular users; service-role client for platform admins (bypasses RLS). */
  supabase: SupabaseClient;
  user: User;
  isAdmin: boolean;
}

/**
 * Returns a Supabase client appropriate for the current user's access level.
 * Platform admins get a service-role client that bypasses RLS entirely,
 * allowing them to view any project without needing org membership or shares.
 * Returns null if the user is not authenticated.
 */
export async function getProjectAccess(): Promise<ProjectAccess | null> {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) return null;

  // Check admin status via service client (avoids RLS dependency on profiles)
  const serviceClient = createServiceClient();
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("is_platform_admin")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.is_platform_admin === true;

  return {
    supabase: isAdmin ? serviceClient : authClient,
    user,
    isAdmin,
  };
}
