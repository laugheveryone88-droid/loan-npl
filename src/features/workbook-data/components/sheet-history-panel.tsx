"use client";

import * as React from "react";
import {
  CheckCircle2,
  Columns3,
  Database,
  History,
  Rows3,
  Users,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DistributionBars,
  MetricCard,
} from "@/features/workbook-data/components/dashboard-primitives";
import { formatMoney, formatNumber, maskIdentifier, maskPhone } from "@/features/workbook-data/lib/format";
import { analyzeOverdueCustomers } from "@/features/workbook-data/lib/overdue-customer-analysis";
import { summarizeResolvedPayments, summarizeUnpaidPayments } from "@/features/workbook-data/lib/resolved-payments";
import { PaymentProgressMetric } from "@/features/workbook-data/components/payment-progress-metric";
import { parseOverdueGoogleSheet } from "@/features/workbook-data/lib/parse-google-sheet";
import type {
  GoogleSheetTab,
  SheetHistoryEntry,
  SheetHistorySnapshot,
} from "@/features/workbook-data/types";

const HISTORY_PAGE_SIZE = 50;

type HistoryListResponse = { entries?: SheetHistoryEntry[]; error?: string };
type ErrorResponse = { error?: string };

function formatHistoryTime(value: string) {
  return new Intl.DateTimeFormat("mn-MN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
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

function dpdBucket(value: number | null) {
  if (value === null) return "DPD тодорхойгүй";
  if (value <= 5) return "0–5 хоног";
  if (value <= 10) return "6–10 хоног";
  if (value <= 30) return "11–30 хоног";
  if (value <= 60) return "31–60 хоног";
  if (value <= 90) return "61–90 хоног";
  if (value <= 180) return "91–180 хоног";
  return "181+ хоног";
}

function maskHistoricalValue(header: string, value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return "—";
  const normalized = header.normalize("NFKC").trim().toLocaleLowerCase("mn-MN");
  if (normalized.includes("сиф") || normalized.includes("cif")) return maskIdentifier(text);
  if (normalized.includes("утас") || normalized.includes("phone")) return maskPhone(text);
  return text;
}

function HistoricalRawTable({ snapshot }: { snapshot: SheetHistorySnapshot }) {
  const [sheetTitle, setSheetTitle] = React.useState(snapshot.payload.sheets[0]?.title ?? "");
  const [page, setPage] = React.useState(1);

  const sheet: GoogleSheetTab | undefined =
    snapshot.payload.sheets.find((item) => item.title === sheetTitle) ?? snapshot.payload.sheets[0];
  const headers = (sheet?.values[0] ?? []).map((value, index) =>
    String(value ?? "").trim() || `Баган ${index + 1}`,
  );
  const rows = sheet?.values.slice(1) ?? [];
  const pageCount = Math.max(1, Math.ceil(rows.length / HISTORY_PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * HISTORY_PAGE_SIZE;

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Тухайн үеийн дэлгэрэнгүй лист</CardTitle>
            <CardDescription>
              Snapshot-д байсан бүх багана, мөрийг хадгалсан хувилбараар харуулна. CIF болон утсыг далдлав.
            </CardDescription>
          </div>
          {snapshot.payload.sheets.length > 0 ? (
            <Select
              value={sheet?.title ?? ""}
              onValueChange={(value) => {
                setSheetTitle(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-64" aria-label="Түүхэн Sheet tab сонгох">
                <SelectValue placeholder="Sheet tab сонгох" />
              </SelectTrigger>
              <SelectContent>
                {snapshot.payload.sheets.map((item) => (
                  <SelectItem key={item.title} value={item.title}>{item.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-x-auto rounded-lg border">
          <Table className="min-w-max">
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-background">Мөр</TableHead>
                {headers.map((header, index) => (
                  <TableHead key={`${header}:${index}`} className="min-w-40">
                    {header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.slice(start, start + HISTORY_PAGE_SIZE).map((row, rowIndex) => (
                <TableRow key={`${sheet?.title}:${start + rowIndex}`}>
                  <TableCell className="sticky left-0 bg-background font-mono text-xs text-muted-foreground">
                    {formatNumber(start + rowIndex + 2)}
                  </TableCell>
                  {headers.map((header, columnIndex) => (
                    <TableCell key={`${start + rowIndex}:${columnIndex}`} className="max-w-72 truncate">
                      {maskHistoricalValue(header, row[columnIndex])}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={Math.max(headers.length + 1, 1)} className="h-28 text-center text-muted-foreground">
                    Энэ snapshot-д өгөгдлийн мөр алга байна.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {formatNumber(rows.length)} мөр · {formatNumber(headers.length)} багана · {formatNumber(safePage)}/{formatNumber(pageCount)} хуудас
          </p>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
              Өмнөх
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={safePage >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>
              Дараах
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function HistoricalDashboard({ snapshot }: { snapshot: SheetHistorySnapshot }) {
  const parsed = React.useMemo(() => {
    try {
      return parseOverdueGoogleSheet(snapshot.payload);
    } catch {
      return null;
    }
  }, [snapshot]);
  const analysis = React.useMemo(
    () => analyzeOverdueCustomers(parsed?.records ?? []),
    [parsed],
  );
  const unpaidPayments = summarizeUnpaidPayments(parsed?.records ?? []);
  const resolvedPayments = summarizeResolvedPayments(parsed?.records ?? []);
  const bucketLabels = [
    "0–5 хоног",
    "6–10 хоног",
    "11–30 хоног",
    "31–60 хоног",
    "61–90 хоног",
    "91–180 хоног",
    "181+ хоног",
    "DPD тодорхойгүй",
  ];
  const distribution = bucketLabels.map((label) => ({
    label,
    value: analysis.customers.filter((customer) => dpdBucket(customer.maximumDpd) === label).length,
    tone: label === "91–180 хоног" || label === "181+ хоног" ? "bg-destructive" : undefined,
  }));

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <MetricCard title="Unique харилцагч" value={parsed ? formatNumber(analysis.customers.length) : "—"} description="Тухайн үеийн A баганын CIF-ээр" icon={Users} />
        <MetricCard title="Зээлийн мөр" value={parsed ? formatNumber(parsed.records.length) : formatNumber(snapshot.rowCount)} description="Snapshot-д хадгалсан эх мөр" icon={Rows3} />
        <MetricCard title="Нийт төлбөрийн дүн" value={parsed ? formatMoney(unpaidPayments.amount) : "—"} description={unpaidPayments.missingAmounts > 0 ? "Төлөгдөөгүй мөрийн дүн дутуу — нийлбэр бүрэн бус." : "Тухайн үед “Төлсөн” болоогүй мөрүүдийн I баганын нийлбэр"} icon="tugrik" tone={unpaidPayments.missingAmounts > 0 ? "warning" : "default"} />
        <MetricCard title="Зөрчил арилгасан дүн" value={parsed ? formatMoney(resolvedPayments.amount) : "—"} description={resolvedPayments.missingAmounts > 0 ? "Төлсөн мөрийн дүн дутуу — нийлбэр бүрэн бус." : "Тухайн үед “Төлсөн” байсан мөрүүдийн дүн"} icon={CheckCircle2} tone={resolvedPayments.missingAmounts > 0 ? "warning" : "success"} />
        <PaymentProgressMetric progress={parsed?.paymentProgress ?? null} records={parsed?.records ?? []} historical />
        <MetricCard title="Хамгийн их багана" value={formatNumber(snapshot.columnCount)} description="Snapshot-д хадгалсан бүтэц" icon={Columns3} />
      </section>

      {parsed ? (
        <section className="grid gap-6 xl:grid-cols-[minmax(0,0.7fr)_minmax(0,1.6fr)]">
          <DistributionBars title="Тухайн үеийн DPD тархалт" description="CIF бүрийн хамгийн их DPD" items={distribution} />
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Тухайн үеийн харилцагчийн жагсаалт</CardTitle>
              <CardDescription>Нэг CIF-ийн зээлийн мөрүүдийг нэгтгэсэн эхний 100 үр дүн.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Харилцагч</TableHead>
                      <TableHead>Зээлийн мөр</TableHead>
                      <TableHead>Нийт төлбөрийн дүн (I)</TableHead>
                      <TableHead>Хамгийн их DPD</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analysis.customers.slice(0, 100).map((customer) => (
                      <TableRow key={customer.key}>
                        <TableCell>
                          <p className="max-w-64 truncate font-medium">{customer.names.join(" / ") || "Нэр тодорхойгүй"}</p>
                          <p className="font-mono text-xs text-muted-foreground">CIF {maskIdentifier(customer.customerCif)}</p>
                        </TableCell>
                        <TableCell className="font-mono tabular-nums">{formatNumber(customer.loanCount)}</TableCell>
                        <TableCell className="font-mono tabular-nums">{formatNumber(customer.totalPaymentAmount)}</TableCell>
                        <TableCell>{customer.maximumDpd === null ? "—" : `${formatNumber(customer.maximumDpd)} хоног`}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </section>
      ) : (
        <Alert>
          <Database aria-hidden="true" />
          <AlertTitle>Энэ snapshot-ийн бүтэц одоогийн самбартай тохирохгүй байна</AlertTitle>
          <AlertDescription>
            Багана хасагдсан эсвэл нэр нь өөрчлөгдсөн байж болно. Доорх дэлгэрэнгүй листээс хадгалсан бүх утгыг харна уу.
          </AlertDescription>
        </Alert>
      )}

      <HistoricalRawTable key={snapshot.id} snapshot={snapshot} />
    </div>
  );
}

export function SheetHistoryPanel({ refreshKey }: { refreshKey: string | null }) {
  const [entries, setEntries] = React.useState<SheetHistoryEntry[]>([]);
  const [selectedId, setSelectedId] = React.useState<string>("");
  const [snapshot, setSnapshot] = React.useState<SheetHistorySnapshot | null>(null);
  const [listLoading, setListLoading] = React.useState(true);
  const [snapshotLoading, setSnapshotLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/google-sheets/history", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as HistoryListResponse;
        if (!response.ok) throw new Error(payload.error ?? "Өөрчлөлтийн түүхийг уншиж чадсангүй.");
        const nextEntries = payload.entries ?? [];
        setEntries(nextEntries);
        setSelectedId((current) =>
          current && nextEntries.some((entry) => String(entry.id) === current)
            ? current
            : nextEntries[0]
              ? String(nextEntries[0].id)
              : "",
        );
        setError(null);
      })
      .catch((fetchError: unknown) => {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") return;
        setError(fetchError instanceof Error ? fetchError.message : "Өөрчлөлтийн түүхийг уншиж чадсангүй.");
      })
      .finally(() => setListLoading(false));
    return () => controller.abort();
  }, [refreshKey]);

  React.useEffect(() => {
    if (!selectedId) return;

    const controller = new AbortController();
    void fetch(`/api/google-sheets/history?id=${encodeURIComponent(selectedId)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as SheetHistorySnapshot & ErrorResponse;
        if (!response.ok) throw new Error(payload.error ?? "Сонгосон түүхийг уншиж чадсангүй.");
        setSnapshot(payload);
        setError(null);
      })
      .catch((fetchError: unknown) => {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") return;
        setError(fetchError instanceof Error ? fetchError.message : "Сонгосон түүхийг уншиж чадсангүй.");
      })
      .finally(() => setSnapshotLoading(false));
    return () => controller.abort();
  }, [selectedId]);

  const selectedEntry = entries.find((entry) => String(entry.id) === selectedId) ?? null;
  const visibleSnapshot = snapshot && String(snapshot.id) === selectedId ? snapshot : null;

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
                Автомат шалгалтаар Sheet-ийн утга эсвэл баганын бүтцийн өөрчлөлт илэрвэл тухайн хувилбарыг хадгална. Өөрчлөлтгүй шалгалтыг давхар хадгалахгүй.
              </CardDescription>
            </div>
            <Badge variant="outline">{formatNumber(entries.length)} хадгалсан хувилбар</Badge>
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
            <SelectTrigger className="w-full" aria-label="Хугацааны түүх сонгох">
              <SelectValue placeholder={listLoading ? "Түүхийг ачаалж байна" : "Хадгалсан хугацаа сонгох"} />
            </SelectTrigger>
            <SelectContent>
              {entries.map((entry) => (
                <SelectItem key={entry.id} value={String(entry.id)}>
                  {formatHistoryTime(entry.capturedAt)} · {changeKindLabel(entry)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedEntry ? (
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="secondary">{changeKindLabel(selectedEntry)}</Badge>
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
        <Card><CardContent className="py-12 text-center text-muted-foreground">Сонгосон хугацааны самбарыг ачаалж байна…</CardContent></Card>
      ) : visibleSnapshot ? (
        <HistoricalDashboard snapshot={visibleSnapshot} />
      ) : !listLoading && entries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Түүх хараахан үүсээгүй байна. Дараагийн Sheet шалгалтаар анхны snapshot хадгалагдана.
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
