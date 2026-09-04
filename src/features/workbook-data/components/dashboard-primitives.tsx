import type { LucideIcon } from "lucide-react";
import { Database } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function DashboardPage({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8", className)}>
      {children}
    </div>
  );
}

export function DashboardHeading({
  eyebrow,
  title,
  description,
  badge,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  badge?: string;
}) {
  return (
    <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="font-normal">
            {eyebrow}
          </Badge>
          {badge ? <span className="text-xs text-muted-foreground">{badge}</span> : null}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
        ) : null}
      </div>
    </section>
  );
}

export function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  tone = "default",
  showDescription = true,
}: {
  title: string;
  value: string;
  description?: string;
  icon: LucideIcon | "tugrik";
  tone?: "default" | "warning" | "danger" | "success";
  showDescription?: boolean;
}) {
  return (
    <Card className="min-w-0 gap-3 py-4 shadow-sm" title={showDescription ? undefined : description}>
      <CardHeader className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2 gap-y-3 px-4">
        <CardDescription className="text-xs font-medium tracking-wide">
          {title}
        </CardDescription>
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary",
            tone === "warning" && "bg-amber-500/10 text-amber-700 dark:text-amber-300",
            tone === "danger" && "bg-destructive/10 text-destructive",
            tone === "success" && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
          )}
        >
          {Icon === "tugrik"
            ? <span className="font-sans text-lg leading-none" aria-hidden="true">₮</span>
            : <Icon className="size-4" aria-hidden="true" />}
        </span>
        <CardTitle className="col-span-2 break-words font-sans text-xl font-normal tracking-normal tabular-nums">{value}</CardTitle>
      </CardHeader>
      {showDescription && description ? (
        <CardContent className="px-4">
          <p className="text-xs leading-5 text-muted-foreground">{description}</p>
        </CardContent>
      ) : null}
    </Card>
  );
}

export function DataUnavailable({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card className="border-dashed shadow-sm">
      <CardContent className="flex min-h-80 flex-col items-center justify-center p-8 text-center">
        <span className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Database className="size-6" aria-hidden="true" />
        </span>
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

export function DistributionBars({
  title,
  description,
  items,
  selectedItemId,
  onItemClick,
  layout = "vertical",
}: {
  title: string;
  description?: string;
  items: Array<{ id?: string; label: string; value: number; displayValue?: string; tone?: string }>;
  selectedItemId?: string | null;
  onItemClick?: (item: { id?: string; label: string; value: number }) => void;
  layout?: "vertical" | "horizontal";
}) {
  const maximum = Math.max(...items.map((item) => item.value), 1);

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className={layout === "horizontal" && items.length > 0
        ? "grid grid-cols-2 gap-3 @lg:grid-cols-4 @[56rem]:grid-cols-8"
        : "space-y-4"}>
        {items.length === 0 ? (
          <div className="flex min-h-44 flex-col items-center justify-center rounded-lg border border-dashed text-center">
            <Database className="mb-3 size-7 text-muted-foreground/60" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">Харуулах ангилал алга.</p>
          </div>
        ) : (
          items.map((item) => {
            const isSelected = Boolean(item.id && selectedItemId === item.id);
            const content = (
              <>
              <div className={layout === "horizontal" ? "flex min-w-0 flex-col gap-2 text-sm" : "flex items-center justify-between gap-4 text-sm"}>
                <span className={cn("text-muted-foreground", layout === "vertical" && "truncate", isSelected && "font-medium text-foreground")}>
                  {item.label}
                </span>
                <span className={cn("tabular-nums", layout === "horizontal" ? "font-sans text-xl" : "font-mono")}>{item.displayValue ?? item.value}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full bg-primary", item.tone)}
                  style={{ width: `${Math.max((item.value / maximum) * 100, 2)}%` }}
                />
              </div>
              </>
            );

            return onItemClick ? (
              <button
                key={item.id ?? item.label}
                type="button"
                className={cn(
                  "min-w-0 w-full space-y-1.5 rounded-lg p-2 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isSelected && "bg-primary/10 ring-1 ring-primary/25",
                )}
                aria-pressed={isSelected}
                onClick={() => onItemClick(item)}
              >
                {content}
              </button>
            ) : (
              <div key={item.id ?? item.label} className="space-y-1.5">
                {content}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
