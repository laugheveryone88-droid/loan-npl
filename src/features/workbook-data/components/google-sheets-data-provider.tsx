"use client";

import * as React from "react";

import { parseOverdueGoogleSheet } from "@/features/workbook-data/lib/parse-google-sheet";
import type {
  GoogleSheetsPayload,
  OverdueSheetData,
} from "@/features/workbook-data/types";
import { LIVE_OVERDUE_SYNC_INTERVAL_MS, LIVE_OVERDUE_SYNC_MAX_RETRY_MS } from "@/lib/google-sheets";

export type LiveOverdueSyncState = {
  status: "idle" | "syncing" | "ready" | "auth-required" | "error";
  lastCheckedAt: string | null;
  lastUpdatedAt: string | null;
  error: string | null;
  historyWarning: string | null;
};

type GoogleSheetsDataContextValue = {
  overdueData: OverdueSheetData | null;
  liveOverdueSync: LiveOverdueSyncState;
  refreshLiveOverdue: () => Promise<void>;
};

type ErrorPayload = {
  code?: string;
  error?: string;
};

const initialLiveSyncState: LiveOverdueSyncState = {
  status: "idle",
  lastCheckedAt: null,
  lastUpdatedAt: null,
  error: null,
  historyWarning: null,
};

const GoogleSheetsDataContext = React.createContext<GoogleSheetsDataContextValue | null>(null);

export function GoogleSheetsDataProvider({ children }: { children: React.ReactNode }) {
  const [overdueData, setOverdueData] = React.useState<OverdueSheetData | null>(null);
  const [liveOverdueSync, setLiveOverdueSync] =
    React.useState<LiveOverdueSyncState>(initialLiveSyncState);
  const etagRef = React.useRef<string | null>(null);
  const inFlightRef = React.useRef<Promise<void> | null>(null);
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const retryDelayRef = React.useRef(LIVE_OVERDUE_SYNC_INTERVAL_MS);

  const refreshLiveOverdue = React.useCallback(() => {
    if (inFlightRef.current) return inFlightRef.current;

    const request = (async () => {
      setLiveOverdueSync((current) => ({ ...current, status: "syncing", error: null }));

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const headers = new Headers();
        if (etagRef.current) headers.set("If-None-Match", etagRef.current);

        const response = await fetch("/api/google-sheets/overdue", {
          method: "GET",
          headers,
          cache: "no-store",
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]),
        });
        if (controller.signal.aborted) return;
        const checkedAt = new Date().toISOString();
        const historyWarning = response.headers.get("X-Sheet-History") === "unavailable"
          ? "Одоогийн өгөгдөл шинэчлэгдсэн боловч өөрчлөлтийн түүхийг хадгалж чадсангүй. Дараагийн шалгалтаар дахин оролдоно."
          : null;

        if (response.status === 304) {
          retryDelayRef.current = LIVE_OVERDUE_SYNC_INTERVAL_MS;
          setLiveOverdueSync((current) => ({
            ...current,
            status: "ready",
            lastCheckedAt: checkedAt,
            error: null,
            historyWarning,
          }));
          return;
        }

        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as ErrorPayload;
          if (controller.signal.aborted) return;
          retryDelayRef.current = Math.min(retryDelayRef.current * 2, LIVE_OVERDUE_SYNC_MAX_RETRY_MS);
          if (response.status === 429) retryDelayRef.current = Math.max(retryDelayRef.current, 60_000);
          setLiveOverdueSync((current) => ({
            ...current,
            status: payload.code === "GOOGLE_RECONNECT" || payload.code === "UNAUTHENTICATED" ? "auth-required" : "error",
            lastCheckedAt: checkedAt,
            error: payload.error ?? "Google Sheets өгөгдлийг шинэчилж чадсангүй.",
          }));
          return;
        }

        const payload = (await response.json()) as GoogleSheetsPayload;
        if (controller.signal.aborted) return;
        const parsed = parseOverdueGoogleSheet(payload);
        retryDelayRef.current = LIVE_OVERDUE_SYNC_INTERVAL_MS;
        etagRef.current = response.headers.get("etag");
        setOverdueData(parsed);
        setLiveOverdueSync({
          status: "ready",
          lastCheckedAt: checkedAt,
          lastUpdatedAt: checkedAt,
          error: null,
          historyWarning,
        });
      } catch (syncError) {
        if (controller.signal.aborted) return;
        retryDelayRef.current = Math.min(retryDelayRef.current * 2, LIVE_OVERDUE_SYNC_MAX_RETRY_MS);

        setLiveOverdueSync((current) => ({
          ...current,
          status: "error",
          lastCheckedAt: new Date().toISOString(),
          error: syncError instanceof Error && syncError.name === "TimeoutError"
            ? "Google Sheets-ийн хариу удаж байна. Автоматаар дахин шалгана."
            : "Google Sheets өгөгдлийг шинэчлэх үед алдаа гарлаа. Автоматаар дахин шалгана.",
        }));
      }
    })();

    inFlightRef.current = request;
    void request.finally(() => {
      if (inFlightRef.current === request) inFlightRef.current = null;
    });
    return request;
  }, []);

  React.useEffect(() => {
    let disposed = false;
    let timeoutId: number | undefined;
    const check = () => {
      window.clearTimeout(timeoutId);
      if (disposed || document.visibilityState === "hidden" || !navigator.onLine) return;
      void refreshLiveOverdue().finally(() => {
        if (disposed) return;
        window.clearTimeout(timeoutId);
        timeoutId = window.setTimeout(check, retryDelayRef.current);
      });
    };

    check();
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    window.addEventListener("online", check);

    return () => {
      disposed = true;
      window.clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
      window.removeEventListener("online", check);
      abortControllerRef.current?.abort();
      inFlightRef.current = null;
    };
  }, [refreshLiveOverdue]);

  const value = React.useMemo(
    () => ({ overdueData, liveOverdueSync, refreshLiveOverdue }),
    [overdueData, liveOverdueSync, refreshLiveOverdue],
  );

  return (
    <GoogleSheetsDataContext.Provider value={value}>
      {children}
    </GoogleSheetsDataContext.Provider>
  );
}

export function useGoogleSheetsData() {
  const context = React.useContext(GoogleSheetsDataContext);
  if (!context) {
    throw new Error("useGoogleSheetsData must be used within GoogleSheetsDataProvider.");
  }
  return context;
}
