"use client";

import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Database,
  Monitor,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DashboardHeading,
  DashboardPage,
} from "@/features/workbook-data/components/dashboard-primitives";
import { useGoogleSheetsData } from "@/features/workbook-data/components/google-sheets-data-provider";
import { formatNumber } from "@/features/workbook-data/lib/format";
import {
  LIVE_OVERDUE_SPREADSHEET_URL,
  LIVE_OVERDUE_MANUAL_REFRESH_LABEL,
} from "@/lib/google-sheets";

export function WorkspaceOverview() {
  const { overdueData, liveOverdueSync, canRefresh, refreshLiveOverdue } = useGoogleSheetsData();
  const isSyncing = liveOverdueSync.status === "idle" || liveOverdueSync.status === "syncing";
  const isReady = liveOverdueSync.status === "ready";
  const StatusIcon = isSyncing ? RefreshCw : isReady ? CheckCircle2 : TriangleAlert;

  return (
    <DashboardPage>
      <DashboardHeading
        eyebrow="Google Sheets өгөгдлийн сан"
        title="Хугацаа хэтрэлтийн шууд хяналт"
        description={LIVE_OVERDUE_MANUAL_REFRESH_LABEL}
        badge="Админы гар шинэчлэлт"
      />

      <Card className={isReady ? "border-emerald-600/25 shadow-sm" : "shadow-sm"}>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>Google Sheet холболт</CardTitle>
              <Badge variant={isReady ? "secondary" : "outline"}>
                {isSyncing ? "Уншиж байна" : isReady ? "Шууд холбогдсон" : "Анхаарах"}
              </Badge>
            </div>
            <CardDescription className="mt-2">
              {overdueData
                ? `${overdueData.summary.title} · ${formatNumber(overdueData.records.length)} мөр`
                : liveOverdueSync.error ?? "Google Sheets өгөгдлийг ачаалж байна."}
            </CardDescription>
          </div>
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <StatusIcon className={isSyncing ? "size-5 animate-spin" : "size-5"} aria-hidden="true" />
          </span>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {canRefresh ? (
            <Button type="button" variant="outline" disabled={isSyncing} onClick={() => void refreshLiveOverdue()}>
              <RefreshCw className={isSyncing ? "animate-spin" : undefined} aria-hidden="true" />
              Одоо шинэчлэх
            </Button>
          ) : null}
          <Button asChild variant="ghost">
            <a href={LIVE_OVERDUE_SPREADSHEET_URL} target="_blank" rel="noreferrer">
              <Database aria-hidden="true" />
              Эх Google Sheet нээх
            </a>
          </Button>
        </CardContent>
      </Card>

      <section className="grid gap-6 md:grid-cols-2">
        <Card className="group shadow-sm transition-colors hover:border-primary/35">
          <CardHeader>
            <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <BarChart3 className="size-5" aria-hidden="true" />
            </span>
            <CardTitle className="pt-2">Бүтэн веб самбар</CardTitle>
            <CardDescription>Үндсэн үзүүлэлт, Sheet-ийн бүх баганын дэлгэрэнгүй лист болон өөрчлөлтийн түүх.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full justify-between">
              <Link href="/overdue">
                Самбар нээх
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="group shadow-sm transition-colors hover:border-primary/35">
          <CardHeader>
            <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Monitor className="size-5" aria-hidden="true" />
            </span>
            <CardTitle className="pt-2">Дашбоардын дэлгэц</CardTitle>
            <CardDescription>Зөвхөн харах зориулалттай тусдаа dark dashboard.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full justify-between">
              <Link href="/dashboard">
                Дэлгэц нээх
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </DashboardPage>
  );
}
