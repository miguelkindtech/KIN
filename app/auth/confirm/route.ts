import { createServerClient } from "@supabase/ssr";
import { type EmailOtpType } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function createSupabaseRouteClient(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  return {
    supabase,
    getResponse: () => response,
  };
}

function withCookies(baseResponse: NextResponse, targetResponse: NextResponse) {
  baseResponse.cookies.getAll().forEach((cookie) => {
    targetResponse.cookies.set(cookie);
  });

  return targetResponse;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const rawType = searchParams.get("type") as EmailOtpType | null;
  const type = rawType === "magiclink" ? "email" : rawType;
  const next = searchParams.get("next") ?? "/overview";

  if (!tokenHash || !type) {
    return NextResponse.redirect(new URL("/login?error=auth_failed", request.url));
  }

  const { supabase, getResponse } = createSupabaseRouteClient(request);
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });

  if (error) {
    console.error("KIN auth confirm verifyOtp failed", {
      message: error.message,
      status: error.status ?? null,
      code: error.code ?? null,
      name: error.name,
      rawType,
      resolvedType: type,
    });
    return NextResponse.redirect(new URL("/login?error=auth_failed", request.url));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    console.error("KIN auth confirm missing user after verifyOtp", {
      rawType,
      resolvedType: type,
    });
    return NextResponse.redirect(new URL("/login?error=auth_failed", request.url));
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    console.error("KIN auth confirm profile missing for user", {
      userId: user.id,
      email: user.email ?? null,
    });
    await supabase.auth.signOut();
    return withCookies(
      getResponse(),
      NextResponse.redirect(new URL("/login?error=restricted_access", request.url))
    );
  }

  return withCookies(
    getResponse(),
    NextResponse.redirect(new URL(next, request.url))
  );
}
