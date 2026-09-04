"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ reset }: ErrorPageProps) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/35 p-6">
      <div className="w-full max-w-lg text-center">
        <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="size-7" aria-hidden="true" />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Алдаа гарлаа</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
          Хуудсыг ачаалах үед асуудал гарлаа. Түр хүлээгээд дахин оролдоно уу.
        </p>
        <Button type="button" size="lg" className="mt-7" onClick={reset}>
          <RefreshCw aria-hidden="true" />
          Дахин оролдох
        </Button>
      </div>
    </main>
  );
}
