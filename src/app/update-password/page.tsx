import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { KeyRound, Landmark } from "lucide-react";

import { UpdatePasswordForm } from "@/components/auth/password-recovery-forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createServerClient } from "@/lib/supabase";

export const metadata: Metadata = {
  title: "Шинэ нууц үг",
  description: "Loan NPL бүртгэлийн шинэ нууц үг тохируулах.",
};

export default async function UpdatePasswordPage() {
  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) redirect("/forgot-password");

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 p-5 sm:p-8">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Landmark className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="font-semibold tracking-tight">Loan NPL</p>
            <p className="text-xs text-muted-foreground">Багцын шинжилгээ</p>
          </div>
        </div>

        <Card className="border-border/70 shadow-xl shadow-black/5">
          <CardHeader className="space-y-3 pb-5">
            <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <KeyRound className="size-5" aria-hidden="true" />
            </div>
            <div className="space-y-1.5">
              <CardTitle className="text-2xl tracking-tight">Шинэ нууц үг</CardTitle>
              <CardDescription>
                Хамгийн багадаа 10 тэмдэгттэй, бусад системд ашиглаагүй нууц үг сонгоно уу.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <UpdatePasswordForm />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
