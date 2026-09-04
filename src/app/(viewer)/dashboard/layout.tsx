import Link from "next/link";
import { ArrowLeft, BarChart3, Database, Eye } from "lucide-react";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GoogleSheetsDataProvider } from "@/features/workbook-data/components/google-sheets-data-provider";
import { createServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function DashboardViewerLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    redirect("/login?next=/dashboard");
  }

  return (
    <GoogleSheetsDataProvider>
      <div className="dark m-business-dashboard-theme flex min-h-screen flex-col bg-background text-foreground">
        <header className="sticky top-0 z-20 min-h-[72px] border-b border-border bg-background/90 backdrop-blur">
          <div className="mx-auto flex min-h-[72px] w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-lg shadow-blue-500/10">
                <BarChart3 className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold leading-tight sm:text-lg">
                  Loan NPL · Хугацаа хэтрэлтийн дашбоард
                </p>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Database className="size-3.5" aria-hidden="true" />
                  <span>Google Sheets шууд өгөгдөл</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="hidden gap-1.5 font-normal sm:inline-flex">
                <Eye className="size-3" aria-hidden="true" />
                Зөвхөн харах горим
              </Badge>
              <Button asChild variant="outline" size="sm">
                <Link href="/overdue">
                  <ArrowLeft aria-hidden="true" />
                  <span className="hidden sm:inline">Бүтэн веб рүү</span>
                  <span className="sm:hidden">Буцах</span>
                </Link>
              </Button>
            </div>
          </div>
        </header>
        <main className="flex flex-1 flex-col">{children}</main>
      </div>
    </GoogleSheetsDataProvider>
  );
}
