"use client";

import * as React from "react";
import { LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  GOOGLE_SHEETS_READONLY_SCOPE,
} from "@/lib/google-sheets";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="currentColor"
        d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z"
      />
      <path
        fill="currentColor"
        opacity=".82"
        d="M12 22c2.7 0 4.97-.9 6.63-2.42l-3.24-2.54c-.9.6-2.04.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.05v2.62A10 10 0 0 0 12 22Z"
      />
      <path
        fill="currentColor"
        opacity=".64"
        d="M6.39 13.87A6.02 6.02 0 0 1 6.07 12c0-.65.11-1.28.32-1.87V7.51H3.05A10 10 0 0 0 2 12c0 1.61.38 3.14 1.05 4.49l3.34-2.62Z"
      />
      <path
        fill="currentColor"
        opacity=".46"
        d="M12 6c1.47 0 2.79.5 3.82 1.5l2.88-2.88A9.66 9.66 0 0 0 12 2a10 10 0 0 0-8.95 5.51l3.34 2.62C7.18 7.76 9.39 6 12 6Z"
      />
    </svg>
  );
}

export function GoogleSignInButton({
  next = "/overdue",
  label = "Google-ээр нэвтрэх",
  className,
}: {
  next?: string;
  label?: string;
  className?: string;
}) {
  const [isPending, setIsPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleGoogleSignIn() {
    setIsPending(true);
    setError(null);

    const callbackUrl = new URL("/auth/callback", window.location.origin);
    callbackUrl.searchParams.set("next", next.startsWith("/") ? next : "/overdue");

    const supabase = createBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl.toString(),
        scopes: GOOGLE_SHEETS_READONLY_SCOPE,
        queryParams: {
          include_granted_scopes: "true",
        },
      },
    });

    if (signInError) {
      setError("Google нэвтрэлтийг эхлүүлж чадсангүй. Дахин оролдоно уу.");
      setIsPending(false);
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      <Button
        type="button"
        size="lg"
        variant="outline"
        className="h-11 w-full"
        disabled={isPending}
        onClick={() => void handleGoogleSignIn()}
      >
        {isPending ? (
          <LoaderCircle className="animate-spin" aria-hidden="true" />
        ) : (
          <GoogleMark />
        )}
        {isPending ? "Google руу шилжиж байна…" : label}
      </Button>
      {error ? (
        <p className="text-center text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
