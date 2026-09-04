"use client";

import * as React from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, CheckCircle2, LoaderCircle, LockKeyhole, Mail } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export function ForgotPasswordForm() {
  const supabase = React.useMemo(() => createClient(), []);
  const [email, setEmail] = React.useState("");
  const [status, setStatus] = React.useState<"idle" | "sending" | "sent" | "error">("idle");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return;

    setStatus("sending");
    const redirectTo = `${window.location.origin}/auth/callback?next=/update-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, { redirectTo });
    setStatus(error ? "error" : "sent");
  }

  if (status === "sent") {
    return (
      <div className="space-y-5">
        <Alert className="border-emerald-600/25 bg-emerald-500/5">
          <CheckCircle2 className="text-emerald-700" aria-hidden="true" />
          <AlertDescription>
            Хэрэв энэ имэйл Loan NPL-д бүртгэлтэй бол нууц үг шинэчлэх нэг удаагийн линк очно.
            Inbox болон Spam хавтсаа шалгана уу.
          </AlertDescription>
        </Alert>
        <Button asChild variant="outline" className="w-full">
          <Link href="/login">
            <ArrowLeft aria-hidden="true" />
            Нэвтрэх хуудас руу буцах
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {status === "error" ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertDescription>
            Reset линк илгээж чадсангүй. Түр хүлээгээд дахин оролдоно уу.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="recovery-email">Имэйл хаяг</Label>
        <div className="relative">
          <Mail
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="recovery-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@company.mn"
            className="h-11 pl-10"
            required
            autoFocus
          />
        </div>
      </div>

      <Button type="submit" size="lg" className="h-11 w-full" disabled={status === "sending"}>
        {status === "sending" ? (
          <>
            <LoaderCircle className="animate-spin" aria-hidden="true" />
            Линк илгээж байна…
          </>
        ) : (
          "Reset линк авах"
        )}
      </Button>

      <Button asChild variant="ghost" className="w-full">
        <Link href="/login">
          <ArrowLeft aria-hidden="true" />
          Нэвтрэх хуудас руу буцах
        </Link>
      </Button>
    </form>
  );
}

export function UpdatePasswordForm() {
  const supabase = React.useMemo(() => createClient(), []);
  const [password, setPassword] = React.useState("");
  const [confirmation, setConfirmation] = React.useState("");
  const [status, setStatus] = React.useState<"idle" | "updating" | "updated" | "error">("idle");
  const [message, setMessage] = React.useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 10) {
      setStatus("error");
      setMessage("Нууц үг хамгийн багадаа 10 тэмдэгт байна.");
      return;
    }
    if (password !== confirmation) {
      setStatus("error");
      setMessage("Давтан оруулсан нууц үг таарахгүй байна.");
      return;
    }

    setStatus("updating");
    setMessage(null);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setStatus("error");
      setMessage("Нууц үгийг шинэчилж чадсангүй. Reset линкээ дахин нээнэ үү.");
      return;
    }

    await supabase.auth.signOut({ scope: "local" });
    setStatus("updated");
  }

  if (status === "updated") {
    return (
      <div className="space-y-5">
        <Alert className="border-emerald-600/25 bg-emerald-500/5">
          <CheckCircle2 className="text-emerald-700" aria-hidden="true" />
          <AlertDescription>
            Нууц үг амжилттай шинэчлэгдлээ. Одоо шинэ нууц үгээрээ нэвтэрнэ үү.
          </AlertDescription>
        </Alert>
        <Button asChild className="w-full">
          <Link href="/login">Loan NPL-д нэвтрэх</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {status === "error" && message ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="new-password">Шинэ нууц үг</Label>
        <div className="relative">
          <LockKeyhole
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={10}
            className="h-11 pl-10"
            required
            autoFocus
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm-password">Нууц үг давтах</Label>
        <div className="relative">
          <LockKeyhole
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            minLength={10}
            className="h-11 pl-10"
            required
          />
        </div>
      </div>

      <Button type="submit" size="lg" className="h-11 w-full" disabled={status === "updating"}>
        {status === "updating" ? (
          <>
            <LoaderCircle className="animate-spin" aria-hidden="true" />
            Шинэчилж байна…
          </>
        ) : (
          "Нууц үг шинэчлэх"
        )}
      </Button>
    </form>
  );
}
