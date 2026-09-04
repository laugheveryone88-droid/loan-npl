import { NextResponse } from "next/server";

import { GOOGLE_SHEETS_ACCESS_TOKEN_COOKIE } from "@/lib/google-sheets";
import { createServerClient } from "@/lib/supabase";

function safeNextPath(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/overdue";
}

function redirectOrigin(request: Request, origin: string) {
  if (process.env.NODE_ENV === "development") {
    return origin;
  }

  const forwardedHost = request.headers.get("x-forwarded-host");
  return forwardedHost ? `https://${forwardedHost}` : origin;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.session) {
      const response = NextResponse.redirect(
        `${redirectOrigin(request, origin)}${next}`,
      );

      if (data.session.provider_token) {
        response.cookies.set({
          name: GOOGLE_SHEETS_ACCESS_TOKEN_COOKIE,
          value: data.session.provider_token,
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 55 * 60,
          priority: "high",
        });
      }

      return response;
    }
  }

  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
