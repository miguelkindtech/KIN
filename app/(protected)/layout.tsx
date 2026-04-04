import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/layout/AppShell";
import type { Profile } from "@/lib/types";
import { AppProvider } from "@/providers/AppContext";
import { redirect } from "next/navigation";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id,name,role,color,avatar_initials,email,created_at")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    redirect("/login?error=restricted_access");
  }

  const mappedProfile: Profile = {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    role: profile.role,
    color: profile.color,
    avatarInitials: profile.avatar_initials,
    createdAt: profile.created_at,
  };

  return (
    <AppProvider>
      <AppShell profile={mappedProfile}>{children}</AppShell>
    </AppProvider>
  );
}
