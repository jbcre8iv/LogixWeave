import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Header } from "@/components/dashboard/header";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, full_name, avatar_url, is_platform_admin")
    .eq("id", user.id)
    .single();

  const userInfo = {
    email: user.email!,
    first_name: profile?.first_name,
    last_name: profile?.last_name,
    full_name: profile?.full_name,
    avatar_url: profile?.avatar_url,
  };

  return (
    <div className="flex h-screen">
      <Sidebar isPlatformAdmin={profile?.is_platform_admin || false} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header user={userInfo} isPlatformAdmin={profile?.is_platform_admin || false} />
        <main className="flex-1 overflow-y-auto bg-background p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
