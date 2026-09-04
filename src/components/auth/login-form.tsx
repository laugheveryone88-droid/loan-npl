"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertCircle, ArrowRight, LoaderCircle, LockKeyhole, Mail } from "lucide-react";

import { login, type LoginState } from "@/app/login/actions";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: LoginState = {};

export function LoginForm({ next = "/overdue" }: { next?: string }) {
  const [state, formAction, isPending] = useActionState(login, initialState);
  const searchParams = useSearchParams();
  const requestedNext = searchParams.get("next");
  const safeNext = requestedNext?.startsWith("/") && !requestedNext.startsWith("//")
    ? requestedNext
    : next;

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="next" value={safeNext} />
      {state.error ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="email">Имэйл хаяг</Label>
        <div className="relative">
          <Mail
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="name@company.mn"
            defaultValue={state.email}
            className="h-11 pl-10"
            required
            autoFocus
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="password">Нууц үг</Label>
          <Link href="/forgot-password" className="text-xs font-medium text-primary hover:underline">
            Нууц үгээ мартсан?
          </Link>
        </div>
        <div className="relative">
          <LockKeyhole
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="Нууц үгээ оруулна уу"
            className="h-11 pl-10"
            required
          />
        </div>
      </div>

      <Button type="submit" size="lg" className="h-11 w-full" disabled={isPending}>
        {isPending ? (
          <>
            <LoaderCircle className="animate-spin" aria-hidden="true" />
            Нэвтэрч байна…
          </>
        ) : (
          <>
            Аюулгүй нэвтрэх
            <ArrowRight data-icon="inline-end" aria-hidden="true" />
          </>
        )}
      </Button>

      <div className="relative py-1">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">эсвэл</span>
        </div>
      </div>

      <GoogleSignInButton next={safeNext} />
    </form>
  );
}
