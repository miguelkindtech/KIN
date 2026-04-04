import LoginForm from "./LoginForm";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type LoginPageProps = {
  searchParams?: {
    error?: string;
  };
};

function getErrorMessage(code?: string) {
  if (code === "restricted_access") {
    return "Access restricted. Contact your administrator.";
  }
  if (code === "invalid_credentials") {
    return "Wrong email or password.";
  }
  if (code === "setup_required") {
    return "Whitelist check unavailable. Run the Supabase schema first.";
  }
  if (code === "auth_failed") {
    return "Authentication failed. Try again.";
  }
  return "";
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/overview");

  return <LoginForm error={getErrorMessage(searchParams?.error)} />;
}
