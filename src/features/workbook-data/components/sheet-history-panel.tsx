"use client";

import * as React from "react";
import {
  CheckCircle2,
  Database,
  HandCoins,
  History,
  TrendingDown,
  Users,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MetricCard } from "@/features/workbook-data/components/dashboard-primitives";
import { formatMoney, formatNumber } from "@/features/workbook-data/lib/format";
import { summarizeSheetHistoryKpis } from "@/features/workbook-data/lib/sheet-history-kpis";
import type {
  SheetHistoryEntry,
  SheetHistoryKpiSummary,
  SheetHistorySnapshot,
} from "@/features/workbook-data/types";

const ALL_HISTORY_ID = "all";

type HistoryListResponse = { entries?: SheetHistoryEntry[]; error?: string };
type HistoryAggregateResponse = { summary?: SheetHistoryKpiSummary; error?: string };
type ErrorResponse = { error?: string };

function formatHistoryDate(value: string) {
  return new Intl.DateTimeFormat("mn-MN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function formatHistoryTime(value: string) {
  return new Intl.DateTimeFormat("mn-MN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function changeKindLabel(entry: SheetHistoryEntry) {
  if (entry.changeSummary.kind === "initial") return "Анхны төлөв";
  if (entry.changeSummary.kind === "columns") return "Баганын өөрчлөлт";
  if (entry.changeSummary.kind === "columns-and-data") return "Багана ба өгөгдөл";
  return "Өгөгдлийн өөрчлөлт";
}

function groupEntriesByDate(entries: SheetHistoryEntry[]) {
  const groups = new Map<string, SheetHistoryEntry[]>();
  for (const entry of entries) {
    const date = formatHistoryDate(entry.capturedAt);
    const group = groups.get(date) ?? [];
    group.push(entry);
    groups.set(date, group);
  }
  return [...groups.entries()];
}

function HistoricalKpiCards({
  summary,
  aggregated,
}: {
  summary: SheetHistoryKpiSummary;
  aggregated: boolean;
}) {
  const periodText = aggregated
    ? `${formatNumber(summary.snapshotCount)} хугацааны нийлбэр`
    : "Сонгосон хугацааны үзүүлэлт";
  const progressNeedsReview =
    summary.paymentProgressUnavailableSnapshots > 0 ||
    summary.paymentProgressExcludedCustomers > 0 ||
    summary.paymentProgressMissingCifRows > 0;

  if (summary.parsedSnapshotCount === 0) {
    return (
      <Alert>
        <Database aria-hidden="true" />
        <AlertTitle>Сонгосон түүхийн KPI-г тооцоолж чадсангүй</AlertTitle>
        <AlertDescription>
          Хадгалсан Sheet-ийн баганын бүтэц одоогийн самбартай тохирохгүй байна.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <section aria-label="Түүхэн KPI үзүүлэлтүүд" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <MetricCard
        title="Давхардаагүй харилцагч"
        value={formatNumber(summary.uniqueCustomers)}
        description={`${periodText} · CIF бүрээр тооцов.`}
        icon={Users}
      />
      <MetricCard
        title="Давхардсан харилцагч"
        value={formatNumber(summary.duplicatedCustomers)}
        description={`${periodText} · Хоёр ба түүнээс олон зээлийн мөртэй CIF.`}
        icon={HandCoins}
      />
      <MetricCard
        title="Нийт төлбөрийн дүн"
        value={formatMoney(summary.unpaidAmount)}
        description={summary.unpaidMissingAmounts > 0
          ? `${periodText} · Төлөгдөөгүй ${formatNumber(summary.unpaidMissingAmounts)} мөрийн дүн дутуу.`
          : `${periodText} · “Төлсөн” болоогүй ${formatNumber(summary.unpaidRows)} мөр.`}
        icon="tugrik"
        tone={summary.unpaidMissingAmounts > 0 ? "warning" : "default"}
      />
      <MetricCard
        title="Төлөгдөж байгаа"
        value={formatMoney(summary.paymentProgressAmount)}
        description={progressNeedsReview
          ? `${periodText} · ${formatNumber(summary.paymentProgressUnavailableSnapshots)} хугацаа эсвэл ${formatNumber(summary.paymentProgressExcludedCustomers)} CIF-ийн тооцоог шалгана.`
          : `${periodText} · ${formatNumber(summary.paymentProgressCustomerCount)} CIF.`}
        icon={TrendingDown}
        tone={progressNeedsReview ? "warning" : "success"}
      />
      <MetricCard
        title="Зөрчил арилгасан дүн"
        value={formatMoney(summary.resolvedAmount)}
        description={summary.resolvedMissingAmounts > 0
          ? `${periodText} · Төлсөн ${formatNumber(summary.resolvedMissingAmounts)} мөрийн дүн дутуу.`
          : `${periodText} · “Төлсөн” төлөвтэй ${formatNumber(summary.paidRows)} мөр.`}
        icon={CheckCircle2}
        tone={summary.resolvedMissingAmounts > 0 ? "warning" : "success"}
      />
    </section>
  );
}

export function SheetHistoryPanel({ refreshKey }: { refreshKey: string | null }) {
  const [entries, setEntries] = React.useState<SheetHistoryEntry[]>([]);
  const [selectedId, setSelectedId] = React.useState<string>("");
  const [snapshot, setSnapshot] = React.useState<SheetHistorySnapshot | null>(null);
  const [aggregate, setAggregate] = React.useState<SheetHistoryKpiSummary | null>(null);
  const [listLoading, setListLoading] = React.useState(true);
  const [snapshotLoading, setSnapshotLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/google-sheets/history", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as HistoryListResponse;
        if (!response.ok) throw new Error(payload.error ?? "Өөрчлөлтийн түүхийг уншиж чадсангүй.");
        const nextEntries = payload.entries ?? [];
        setEntries(nextEntries);
        if (nextEntries.length === 0) setSnapshotLoading(false);
        setSelectedId((current) =>
          current === ALL_HISTORY_ID || nextEntries.some((entry) => String(entry.id) === current)
            ? current
            : nextEntries.length > 0
              ? ALL_HISTORY_ID
              : "",
        );
        setError(null);
      })
      .catch((fetchError: unknown) => {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") return;
        setError(fetchError instanceof Error ? fetchError.message : "Өөрчлөлтийн түүхийг уншиж чадсангүй.");
        setSnapshotLoading(false);
      })
      .finally(() => setListLoading(false));
    return () => controller.abort();
  }, [refreshKey]);

  React.useEffect(() => {
    if (!selectedId) return;

    const controller = new AbortController();
    const url = selectedId === ALL_HISTORY_ID
      ? "/api/google-sheets/history?aggregate=all"
      : `/api/google-sheets/history?id=${encodeURIComponent(selectedId)}`;

    void fetch(url, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as
          | HistoryAggregateResponse
          | (SheetHistorySnapshot & ErrorResponse);
        if (!response.ok) {
          throw new Error(payload.error ?? "Сонгосон түүхийг уншиж чадсангүй.");
        }

        if (selectedId === ALL_HISTORY_ID) {
          const nextAggregate = (payload as HistoryAggregateResponse).summary;
          if (!nextAggregate) throw new Error("Өөрчлөлтийн түүхийн нийлбэр олдсонгүй.");
          setAggregate(nextAggregate);
          setSnapshot(null);
        } else {
          setSnapshot(payload as SheetHistorySnapshot);
          setAggregate(null);
        }
        setError(null);
      })
      .catch((fetchError: unknown) => {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") return;
        setError(fetchError instanceof Error ? fetchError.message : "Сонгосон түүхийг уншиж чадсангүй.");
      })
      .finally(() => setSnapshotLoading(false));
    return () => controller.abort();
  }, [selectedId, refreshKey]);

  const groupedEntries = React.useMemo(() => groupEntriesByDate(entries), [entries]);
  const selectedEntry = entries.find((entry) => String(entry.id) === selectedId) ?? null;
  const visibleSnapshot = snapshot && String(snapshot.id) === selectedId ? snapshot : null;
  const visibleSummary = selectedId === ALL_HISTORY_ID
    ? aggregate
    : visibleSnapshot
      ? summarizeSheetHistoryKpis([visibleSnapshot.payload])
      : null;

  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="size-5" aria-hidden="true" />
                Өөрчлөлтийн түүх
              </CardTitle>
              <CardDescription>
                Анхны Sheet болон түүнээс хойших өөрчлөлт бүрийг хугацаагаар хадгална. Хугацаа сонгоход тухайн үеийн KPI, бүх ангиллыг сонгоход хадгалсан хугацаануудын нийлбэр харагдана.
              </CardDescription>
            </div>
            <Badge variant="outline">{formatNumber(entries.length)} хадгалсан хугацаа</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select
            value={selectedId}
            onValueChange={(value) => {
              setSnapshotLoading(true);
              setSelectedId(value);
            }}
            disabled={listLoading || entries.length === 0}
          >
            <SelectTrigger className="w-full" aria-label="Шинэчлэгдсэн хугацаа сонгох">
              <SelectValue placeholder={listLoading ? "Түүхийг ачаалж байна" : "Шинэчлэгдсэн хугацаа сонгох"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_HISTORY_ID}>Бүх ангилал</SelectItem>
              <SelectSeparator />
              {groupedEntries.map(([date, dateEntries]) => (
                <SelectGroup key={date}>
                  <SelectLabel>{date}</SelectLabel>
                  {dateEntries.map((entry) => (
                    <SelectItem key={entry.id} value={String(entry.id)}>
                      {formatHistoryTime(entry.capturedAt)} · {changeKindLabel(entry)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>

          {selectedId === ALL_HISTORY_ID && entries.length > 0 ? (
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="secondary">Бүх ангилал</Badge>
              <Badge variant="outline">{formatNumber(entries.length)} хугацааны нийлбэр</Badge>
            </div>
          ) : selectedEntry ? (
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="secondary">{changeKindLabel(selectedEntry)}</Badge>
              <Badge variant="outline">{formatHistoryDate(selectedEntry.capturedAt)} {formatHistoryTime(selectedEntry.capturedAt)}</Badge>
              <Badge variant="outline">{formatNumber(selectedEntry.rowCount)} мөр</Badge>
              <Badge variant="outline">{formatNumber(selectedEntry.columnCount)} багана</Badge>
              {selectedEntry.changeSummary.addedColumns.length > 0 ? (
                <Badge className="bg-emerald-500/15 text-emerald-900 hover:bg-emerald-500/15 dark:text-emerald-300">
                  +{formatNumber(selectedEntry.changeSummary.addedColumns.length)} багана
                </Badge>
              ) : null}
              {selectedEntry.changeSummary.removedColumns.length > 0 ? (
                <Badge variant="destructive">−{formatNumber(selectedEntry.changeSummary.removedColumns.length)} багана</Badge>
              ) : null}
              {selectedEntry.changeSummary.rowCountDelta !== 0 ? (
                <Badge variant="outline">
                  Мөр {selectedEntry.changeSummary.rowCountDelta > 0 ? "+" : ""}{formatNumber(selectedEntry.changeSummary.rowCountDelta)}
                </Badge>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {error ? (
        <Alert variant="destructive">
          <Database aria-hidden="true" />
          <AlertTitle>Түүхэн мэдээлэл ачаалагдсангүй</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {snapshotLoading ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Сонгосон хугацааны KPI-г ачаалж байна…</CardContent></Card>
      ) : visibleSummary ? (
        <HistoricalKpiCards summary={visibleSummary} aggregated={selectedId === ALL_HISTORY_ID} />
      ) : !listLoading && entries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Түүх хараахан үүсээгүй байна. Дараагийн Sheet шалгалтаар анхны төлөв хадгалагдана.
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
