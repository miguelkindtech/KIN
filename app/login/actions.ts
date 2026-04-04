"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect("/login?error=invalid_credentials");
  }

  const supabase = await createClient();

  const { data: allowed, error: allowError } = await supabase.rpc(
    "is_allowed_email",
    {
      email_input: email,
    }
  );

  if (allowError) {
    redirect("/login?error=setup_required");
  }

  if (!allowed) {
    redirect("/login?error=restricted_access");
  }

  const { error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError) {
    redirect("/login?error=invalid_credentials");
  }

  redirect("/overview");
}
