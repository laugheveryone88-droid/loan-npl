import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BarChart3, CheckCircle2, Landmark, ShieldCheck } from "lucide-react";

import { LoginForm } from "@/components/auth/login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createServerClient } from "@/lib/supabase";

export const metadata: Metadata = {
  title: "Нэвтрэх",
  description: "Loan NPL зээлийн багцын удирдлагын системд нэвтрэх.",
};

const highlights = [
  "Зээлийн багцын гүйцэтгэлийг нэг дор хянах",
  "Хугацаа хэтрэлт болон чанаргүй зээлийн эрсдэлийг үнэлэх",
  "Зээлийн нууц мэдээллийг найдвартай хамгаалах",
];

function safeNextPath(value: string | string[] | undefined) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/overdue";
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const next = safeNextPath((await searchParams).next);
  const supabase = await createServerClient();
  const { data } = await supabase.auth.getClaims();

  if (data?.claims) {
    redirect(next);
  }

  return (
    <main className="relative grid min-h-svh overflow-hidden bg-muted/40 lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden bg-[linear-gradient(145deg,oklch(0.28_0.08_170),oklch(0.16_0.035_190))] p-12 text-white lg:flex lg:flex-col lg:justify-between xl:p-16">
        <div className="absolute -right-36 -top-36 size-96 rounded-full border border-white/10 bg-white/5" />
        <div className="absolute -bottom-48 -left-32 size-[30rem] rounded-full border border-white/10 bg-primary/20" />

        <div className="relative flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20 backdrop-blur">
            <Landmark className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="font-semibold tracking-tight">Loan NPL</p>
            <p className="text-xs text-white/60">Багцын шинжилгээ</p>
          </div>
        </div>

        <div className="relative max-w-xl space-y-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/75">
              <BarChart3 className="size-3.5" aria-hidden="true" />
              Зээлийн гүйцэтгэлийг ойлгомжтойгоор
            </div>
            <h1 className="text-balance text-4xl font-semibold leading-tight tracking-[-0.04em] xl:text-5xl">
              Зээлийн багцаа нэг дороос итгэлтэй удирдаарай.
            </h1>
            <p className="max-w-lg text-base leading-7 text-white/65">
              Зээлийн гүйцэтгэл, эрсдэл, эргэн төлөлт болон чанаргүй зээлийн
              мэдээлэлд аюулгүй хандана.
            </p>
          </div>

          <ul className="space-y-3 text-sm text-white/80">
            {highlights.map((highlight) => (
              <li key={highlight} className="flex items-center gap-3">
                <CheckCircle2 className="size-4 text-emerald-300" aria-hidden="true" />
                {highlight}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/45">
          Зээлийн байгууллагын найдвартай багцын удирдлага.
        </p>
      </section>

      <section className="flex min-h-svh items-center justify-center p-5 sm:p-8 lg:p-12">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
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
                <ShieldCheck className="size-5" aria-hidden="true" />
              </div>
              <div className="space-y-1.5">
                <CardTitle className="text-2xl tracking-tight">
                  Тавтай морил
                </CardTitle>
                <CardDescription>
                  Эрх бүхий хэрэглэгчийн бүртгэлээр нэвтэрнэ үү.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <LoginForm next={next} />
              <p className="mt-6 text-center text-xs leading-5 text-muted-foreground">
                Хандах эрхийг Loan NPL системийн админ удирдана.
              </p>
            </CardContent>
          </Card>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Supabase Auth болон Google OAuth хамгаалалттай.
          </p>
        </div>
      </section>
    </main>
  );
}
