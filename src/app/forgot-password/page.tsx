import type { Metadata } from "next";
import { KeyRound, Landmark } from "lucide-react";

import { ForgotPasswordForm } from "@/components/auth/password-recovery-forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Нууц үг сэргээх",
  description: "Loan NPL нууц үг шинэчлэх нэг удаагийн линк авах.",
};

export default function ForgotPasswordPage() {
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
              <CardTitle className="text-2xl tracking-tight">Нууц үг сэргээх</CardTitle>
              <CardDescription>
                Бүртгэлтэй имэйл хаягтаа нэг удаагийн reset линк авна.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <ForgotPasswordForm />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
