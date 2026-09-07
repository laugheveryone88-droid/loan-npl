"use client";

import * as React from "react";
import {
  CheckCircle2,
  Database,
  HandCoins,
  ListFilter,
  RefreshCw,
  ShieldAlert,
  TriangleAlert,
  Users,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DashboardHeading,
  DashboardPage,
  DistributionBars,
  DataUnavailable,
  MetricCard,
} from "@/features/workbook-data/components/dashboard-primitives";
import {
  type LiveOverdueSyncState,
  useGoogleSheetsData,
} from "@/features/workbook-data/components/google-sheets-data-provider";
import { SheetHistoryPanel } from "@/features/workbook-data/components/sheet-history-panel";
import { formatMoney, formatNumber } from "@/features/workbook-data/lib/format";
import { summarizeResolvedPayments, summarizeUnpaidPayments } from "@/features/workbook-data/lib/resolved-payments";
import { DetailedRowsTable } from "@/features/workbook-data/components/detailed-rows-table";
import { PaymentProgressMetric } from "@/features/workbook-data/components/payment-progress-metric";
import {
  analyzeOverdueCustomers,
  type OverdueCustomerSummary,
} from "@/features/workbook-data/lib/overdue-customer-analysis";
import {
  LIVE_OVERDUE_SPREADSHEET_URL,
  LIVE_OVERDUE_MANUAL_REFRESH_LABEL,
} from "@/lib/google-sheets";

type DpdBucket =
  | "all"
  | "unknown"
  | "0-5"
  | "6-10"
  | "11-30"
  | "31-60"
  | "61-90"
  | "91-180"
  | "181+";
type IdentityFilter =
  | "all"
  | "verified-cif"
  | "cif-name-conflict"
  | "missing-cif"
  | "potential-duplicate"
  | "same-name-other-cif";

const PAGE_SIZE = 50;
const DPD_BUCKETS: Array<Exclude<DpdBucket, "all">> = [
  "0-5",
  "6-10",
  "11-30",
  "31-60",
  "61-90",
  "91-180",
  "181+",
  "unknown",
];

function getDpdBucket(value: number | null): Exclude<DpdBucket, "all"> {
  if (value === null) return "unknown";
  if (value <= 5) return "0-5";
  if (value <= 10) return "6-10";
  if (value <= 30) return "11-30";
  if (value <= 60) return "31-60";
  if (value <= 90) return "61-90";
  if (value <= 180) return "91-180";
  return "181+";
}

function customerMatchesIdentityFilter(
  customer: OverdueCustomerSummary,
  filter: IdentityFilter,
) {
  if (filter === "all") return true;
  if (filter === "potential-duplicate") return customer.hasPotentialDuplicateRows;
  if (filter === "same-name-other-cif") return customer.hasSameNameOnOtherCifs;
  return customer.identityStatus === filter;
}

function formatSyncTime(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("mn-MN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function LiveDatabaseStatus({
  sync,
  onRefresh,
  canRefresh,
}: {
  sync: LiveOverdueSyncState;
  onRefresh: () => Promise<void>;
  canRefresh: boolean;
}) {
  const isSyncing = sync.status === "syncing" || sync.status === "idle";
  const isReady = sync.status === "ready";
  const Icon = isSyncing
    ? RefreshCw
    : isReady
      ? CheckCircle2
      : sync.status === "auth-required"
        ? Database
        : TriangleAlert;
  const label = isSyncing
    ? "Уншиж байна"
    : isReady
      ? "Хадгалсан өгөгдөл"
      : sync.status === "auth-required"
        ? "Google эрх шаардлагатай"
        : "Sync алдаа";
  const lastChecked = formatSyncTime(sync.lastCheckedAt);
  const lastUpdated = formatSyncTime(sync.lastUpdatedAt);

  return (
    <Alert
      className={isReady ? "border-emerald-600/25 bg-emerald-500/5" : undefined}
      aria-live="polite"
    >
      <Icon
        className={
          isSyncing
            ? "animate-spin"
            : isReady
              ? "text-emerald-700 dark:text-emerald-300"
              : undefined
        }
        aria-hidden="true"
      />
      <AlertTitle className="flex flex-wrap items-center gap-2">
        Google Sheets өгөгдлийн сан
        <Badge variant={isReady ? "secondary" : "outline"}>{label}</Badge>
      </AlertTitle>
      <AlertDescription>
        <p>
          {sync.error
            ? sync.error
            : isReady
              ? `${LIVE_OVERDUE_MANUAL_REFRESH_LABEL}${lastChecked ? ` Сүүлд гараар шалгасан: ${lastChecked}.` : ""}`
              : "Хугацаа хэтрэлтийн хадгалсан мэдээллийг уншиж байна."}
        </p>
        {sync.historyWarning ? <p className="text-amber-700 dark:text-amber-300">{sync.historyWarning}</p> : null}
        {lastUpdated ? <p>Самбарын өгөгдөл сүүлд шинэчлэгдсэн: {lastUpdated}.</p> : null}
        <div className="mt-3 flex flex-wrap gap-2">
          {canRefresh ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isSyncing}
              onClick={() => void onRefresh()}
            >
              <RefreshCw className={isSyncing ? "animate-spin" : undefined} aria-hidden="true" />
              Одоо шинэчлэх
            </Button>
          ) : null}
          <Button asChild size="sm" variant="ghost">
            <a href={LIVE_OVERDUE_SPREADSHEET_URL} target="_blank" rel="noreferrer">
              Эх Google Sheet нээх
            </a>
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}

function customerMatchesQuery(customer: OverdueCustomerSummary, query: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase("mn-MN");
  if (!normalizedQuery) return true;

  const textMatches = [
    customer.names.join(" "),
    customer.customerCif,
    customer.normalizedCustomerCif,
    customer.phoneNumber,
    customer.normalizedPhone,
  ]
    .filter(Boolean)
    .some((value) => value?.toLocaleLowerCase("mn-MN").includes(normalizedQuery));
  if (textMatches) return true;

  const numericQuery = normalizedQuery.replace(/\D/g, "");
  if (!numericQuery) return false;
  return [customer.customerCif, customer.normalizedCustomerCif, customer.phoneNumber, customer.normalizedPhone]
    .filter(Boolean)
    .some((value) => value?.replace(/\D/g, "").includes(numericQuery));
}

export function OverdueDashboard({ viewOnly = false }: { viewOnly?: boolean }) {
  const { overdueData, liveOverdueSync, canRefresh, refreshLiveOverdue } = useGoogleSheetsData();
  const [dpdFilter, setDpdFilter] = React.useState<DpdBucket>("all");
  const [identityFilter, setIdentityFilter] = React.useState<IdentityFilter>("all");
  const [query, setQuery] = React.useState("");
  const [detailPage, setDetailPage] = React.useState(1);
  const [activeTab, setActiveTab] = React.useState("overview");

  const analysis = React.useMemo(
    () => analyzeOverdueCustomers(overdueData?.records ?? []),
    [overdueData],
  );
  const identityAndQueryCustomers = React.useMemo(
    () => analysis.customers.filter((customer) => {
      if (!customerMatchesIdentityFilter(customer, identityFilter)) return false;
      return customerMatchesQuery(customer, query);
    }),
    [analysis.customers, identityFilter, query],
  );
  const filteredCustomers = React.useMemo(
    () => dpdFilter === "all"
      ? identityAndQueryCustomers
      : identityAndQueryCustomers.filter(
          (customer) => getDpdBucket(customer.maximumDpd) === dpdFilter,
        ),
    [dpdFilter, identityAndQueryCustomers],
  );
  const filteredRecords = React.useMemo(
    () => filteredCustomers.flatMap((customer) => customer.records)
      .sort((a, b) => a.sourceRow - b.sourceRow),
    [filteredCustomers],
  );
  const pageCount = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));

  if (!overdueData) {
    return (
      <DashboardPage className={viewOnly ? "max-w-7xl gap-5 px-3 py-4 sm:gap-6 sm:px-6 sm:py-6 lg:p-6" : undefined}>
        <DashboardHeading
          eyebrow={viewOnly ? "Зөвхөн харах горим" : "Google Sheets самбар"}
          title="Хугацаа хэтрэлт ба харилцагч"
        />
        <LiveDatabaseStatus
          sync={liveOverdueSync}
          onRefresh={refreshLiveOverdue}
          canRefresh={canRefresh && !viewOnly}
        />
        <DataUnavailable
          title={
            liveOverdueSync.status === "auth-required"
              ? "Google Sheets унших эрх шаардлагатай"
              : liveOverdueSync.status === "error"
                ? "Google Sheets өгөгдөл ачаалагдсангүй"
                : "Google Sheets өгөгдлийг уншиж байна"
          }
          description="Админ “Одоо шинэчлэх” товчоор Google Sheet-ийг амжилттай уншсаны дараа хадгалсан мэдээлэл энд харагдана."
        />
      </DashboardPage>
    );
  }

  const unpaidPayments = summarizeUnpaidPayments(filteredRecords);
  const resolvedPayments = summarizeResolvedPayments(filteredRecords);
  const duplicatedCustomers = filteredCustomers.filter(
    (customer) => customer.loanCount > 1,
  ).length;
  const dpdDistribution = DPD_BUCKETS.map((bucket) => ({
    id: bucket,
    label: bucket === "unknown" ? "Хугацаа хэтэрсэн хоног тодорхойгүй" : `${bucket} хоног`,
    value: identityAndQueryCustomers.filter((customer) => getDpdBucket(customer.maximumDpd) === bucket).length,
    tone:
      bucket === "91-180" || bucket === "181+"
        ? "bg-destructive"
        : bucket === "61-90"
          ? "bg-amber-500"
          : undefined,
  }));
  const viewerTabClassName = viewOnly
    ? "rounded-none border-b-2 border-transparent px-4 py-2.5 text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
    : "px-4";

  return (
    <DashboardPage className={viewOnly ? "max-w-7xl gap-5 px-3 py-4 sm:gap-6 sm:px-6 sm:py-6 lg:p-6" : undefined}>
        <DashboardHeading
          eyebrow={viewOnly ? "Шууд дашбоард" : "Google Sheets самбар"}
          title={viewOnly ? "Зээлийн эрсдэлийн нэгдсэн тойм" : "Хугацаа хэтрэлт ба харилцагч"}
          badge={`Хадгалсан өгөгдөл · ${formatNumber(overdueData.records.length)} мөр`}
        />

      <LiveDatabaseStatus
        sync={liveOverdueSync}
        onRefresh={refreshLiveOverdue}
        canRefresh={canRefresh && !viewOnly}
      />

      <Alert
        className={
          viewOnly
            ? "border-sky-400/25 bg-sky-400/[0.06]"
            : "border-sky-600/20 bg-sky-500/5"
        }
      >
        <ShieldAlert className="text-sky-700 dark:text-sky-300" aria-hidden="true" />
        <AlertTitle>Unique харилцагчийн дүрэм</AlertTitle>
        <AlertDescription>
          Ижил CIF = нэг харилцагч; CIF өөр бол нэр эсвэл утас ижил байсан ч тусдаа харилцагч.
          CIF дутуу мөрийг нэр, утсаар нэгтгэхгүй. Яг ижил A–K мөрийг автоматаар устгахгүй,
          санхүүгийн нийлбэр өсөх эрсдэлийг тусад нь тэмдэглэнэ.
        </AlertDescription>
      </Alert>

      <Card className={viewOnly ? "border-border bg-card shadow-none" : "shadow-sm"}>
        <CardHeader className="pb-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <ListFilter className="size-4" aria-hidden="true" />
            Хайлт
          </CardTitle>
          <CardDescription>Доорх бүх tab-д ижил шүүлтүүр үйлчилнэ.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 p-4 md:grid-cols-3">
          <Select
            value={dpdFilter}
            onValueChange={(value) => {
              setDpdFilter(value as DpdBucket);
              setDetailPage(1);
            }}
          >
            <SelectTrigger className="w-full" aria-label="Хугацаа хэтэрсэн хоногийн ангилал сонгох">
              <SelectValue placeholder="Хугацаа хэтэрсэн хоног" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Хугацаа хэтэрсэн хоног</SelectItem>
              <SelectItem value="0-5">0–5 хоног</SelectItem>
              <SelectItem value="6-10">6–10 хоног</SelectItem>
              <SelectItem value="11-30">11–30 хоног</SelectItem>
              <SelectItem value="31-60">31–60 хоног</SelectItem>
              <SelectItem value="61-90">61–90 хоног</SelectItem>
              <SelectItem value="91-180">91–180 хоног</SelectItem>
              <SelectItem value="181+">181+ хоног</SelectItem>
              <SelectItem value="unknown">Хугацаа хэтэрсэн хоног тодорхойгүй</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={identityFilter}
            onValueChange={(value) => {
              setIdentityFilter(value as IdentityFilter);
              setDetailPage(1);
            }}
          >
            <SelectTrigger className="w-full" aria-label="Unique шалгалтын төлөв сонгох">
              <SelectValue placeholder="Unique шалгалт" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Бүх unique төлөв</SelectItem>
              <SelectItem value="verified-cif">CIF-ээр unique</SelectItem>
              <SelectItem value="cif-name-conflict">Нэг CIF, өөр нэр</SelectItem>
              <SelectItem value="missing-cif">CIF дутуу</SelectItem>
              <SelectItem value="potential-duplicate">Ижил A–K мөр</SelectItem>
              <SelectItem value="same-name-other-cif">Ижил нэр, өөр CIF</SelectItem>
            </SelectContent>
          </Select>
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setDetailPage(1);
            }}
            placeholder="CIF, нэр эсвэл утсаар хайх"
            aria-label="Харилцагчийг CIF, нэр эсвэл утсаар хайх"
          />
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-5">
        <div className="overflow-x-auto pb-1">
          <TabsList
            className={
              viewOnly
                ? "h-auto min-w-max rounded-none border-b border-border bg-transparent p-0"
                : "h-10 min-w-max"
            }
            aria-label="Хугацаа хэтрэлтийн самбарын хэсгүүд"
          >
            <TabsTrigger value="overview" className={viewerTabClassName}>Үндсэн үзүүлэлт</TabsTrigger>
            {!viewOnly ? (
              <TabsTrigger value="details" className={viewerTabClassName}>Дэлгэрэнгүй лист</TabsTrigger>
            ) : null}
            {!viewOnly ? (
              <TabsTrigger value="history" className={viewerTabClassName}>Өөрчлөлтийн түүх</TabsTrigger>
            ) : null}
          </TabsList>
        </div>

        <TabsContent value="overview" className="@container space-y-4">
          <section aria-label="Үндсэн KPI үзүүлэлтүүд" className="grid gap-3 sm:grid-cols-2 @[56rem]:grid-cols-5">
            <MetricCard
              title="Давхардаагүй харилцагч"
              value={formatNumber(filteredCustomers.length)}
              icon={Users}
            />
            <MetricCard
              title="Давхардсан харилцагч"
              value={formatNumber(duplicatedCustomers)}
              icon={HandCoins}
            />
            <MetricCard
              title="Нийт төлбөрийн дүн"
              value={formatMoney(unpaidPayments.amount)}
              description={unpaidPayments.missingAmounts > 0
                ? `Төлөгдөөгүй ${formatNumber(unpaidPayments.missingAmounts)} мөрийн дүн дутуу — нийлбэр бүрэн бус.`
                : `“Төлсөн” болоогүй ${formatNumber(unpaidPayments.unpaidRows)} мөрийн нийт төлбөр.`}
              icon="tugrik"
              showDescription={false}
              tone={unpaidPayments.missingAmounts > 0 ? "warning" : "default"}
            />
            <PaymentProgressMetric progress={overdueData.paymentProgress} records={filteredRecords} />
            <MetricCard
              title="Зөрчил арилгасан дүн"
              value={formatMoney(resolvedPayments.amount)}
              description={resolvedPayments.missingAmounts > 0
                ? `Төлсөн ${formatNumber(resolvedPayments.missingAmounts)} мөрийн дүн дутуу — нийлбэр бүрэн бус.`
                : `“Төлсөн” төлөвтэй ${formatNumber(resolvedPayments.paidRows)} мөрийн нийт төлбөр.`}
              icon={CheckCircle2}
              showDescription={false}
              tone={resolvedPayments.missingAmounts > 0 ? "warning" : "success"}
            />
          </section>

          <section>
            <DistributionBars
              title="Давхардаагүй харилцагчид"
              layout="horizontal"
              items={dpdDistribution}
              selectedItemId={dpdFilter === "all" ? null : dpdFilter}
              onItemClick={(item) => {
                if (!item.id) return;
                const selectedBucket = item.id as Exclude<DpdBucket, "all">;
                setDpdFilter((current) => current === selectedBucket ? "all" : selectedBucket);
                setDetailPage(1);
                if (!viewOnly) setActiveTab("details");
              }}
            />
          </section>
        </TabsContent>

        {!viewOnly ? (
          <TabsContent value="details" className="space-y-4">
            <Card className="shadow-sm">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>Google Sheet-ийн дэлгэрэнгүй лист</CardTitle>
                  <CardDescription>
                    Админ гараар шинэчлэх үед бүх баганын мэдээллийг Sheet-ээс уншина. Төлөв, огноо, тайлбараа эх Google Sheet дээр засварлана.
                  </CardDescription>
                </div>
                <Badge variant="outline">{formatNumber(filteredRecords.length)} мөр</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <DetailedRowsTable
                records={filteredRecords}
                columns={overdueData.sourceColumns}
                pageSize={PAGE_SIZE}
                customerByRecord={analysis.recordToCustomer}
                page={Math.min(detailPage, pageCount)}
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  {formatNumber(pageCount)} хуудасны {formatNumber(Math.min(detailPage, pageCount))}-р хуудас · Нэг хуудсанд {PAGE_SIZE} мөр
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={detailPage <= 1}
                    onClick={() => setDetailPage((current) => Math.max(1, current - 1))}
                  >
                    Өмнөх
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={detailPage >= pageCount}
                    onClick={() => setDetailPage((current) => Math.min(pageCount, current + 1))}
                  >
                    Дараах
                  </Button>
                </div>
              </div>
            </CardContent>
            </Card>
          </TabsContent>
        ) : null}

        {!viewOnly ? (
          <TabsContent value="history" className="space-y-4">
            <SheetHistoryPanel refreshKey={liveOverdueSync.lastUpdatedAt} />
          </TabsContent>
        ) : null}
      </Tabs>
    </DashboardPage>
  );
}
