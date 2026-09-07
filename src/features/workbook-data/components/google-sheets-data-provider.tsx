"use client";

import * as React from "react";

import { parseOverdueGoogleSheet } from "@/features/workbook-data/lib/parse-google-sheet";
import type {
  GoogleSheetsPayload,
  OverdueSheetData,
} from "@/features/workbook-data/types";

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
  canRefresh: boolean;
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

export function GoogleSheetsDataProvider({
  children,
  isAdmin = false,
}: {
  children: React.ReactNode;
  isAdmin?: boolean;
}) {
  const [overdueData, setOverdueData] = React.useState<OverdueSheetData | null>(null);
  const [liveOverdueSync, setLiveOverdueSync] =
    React.useState<LiveOverdueSyncState>(initialLiveSyncState);
  const inFlightRef = React.useRef<Promise<void> | null>(null);
  const abortControllerRef = React.useRef<AbortController | null>(null);

  const requestOverdueData = React.useCallback((manualRefresh: boolean) => {
    if (inFlightRef.current) return inFlightRef.current;

    const request = (async () => {
      setLiveOverdueSync((current) => ({ ...current, status: "syncing", error: null }));
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const response = await fetch("/api/google-sheets/overdue", {
          method: manualRefresh ? "POST" : "GET",
          cache: "no-store",
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]),
        });
        if (controller.signal.aborted) return;

        const checkedAt = manualRefresh ? new Date().toISOString() : null;
        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as ErrorPayload;
          if (controller.signal.aborted) return;
          setLiveOverdueSync((current) => ({
            ...current,
            status: payload.code === "GOOGLE_RECONNECT" || payload.code === "UNAUTHENTICATED"
              ? "auth-required"
              : "error",
            lastCheckedAt: checkedAt ?? current.lastCheckedAt,
            error: payload.error ?? "Хадгалсан Google Sheets өгөгдлийг уншиж чадсангүй.",
          }));
          return;
        }

        const payload = (await response.json()) as GoogleSheetsPayload;
        if (controller.signal.aborted) return;
        const parsed = parseOverdueGoogleSheet(payload);
        const updatedAt = response.headers.get("X-Sheet-Updated-At");
        const historyWarning = response.headers.get("X-Sheet-History") === "unavailable"
          ? "Самбарын өгөгдөл шинэчлэгдсэн боловч өөрчлөлтийн түүхийг хадгалж чадсангүй."
          : null;

        setOverdueData(parsed);
        setLiveOverdueSync((current) => ({
          status: "ready",
          lastCheckedAt: checkedAt ?? current.lastCheckedAt,
          lastUpdatedAt: updatedAt ?? current.lastUpdatedAt,
          error: null,
          historyWarning,
        }));
      } catch (requestError) {
        if (controller.signal.aborted) return;
        setLiveOverdueSync((current) => ({
          ...current,
          status: "error",
          lastCheckedAt: manualRefresh ? new Date().toISOString() : current.lastCheckedAt,
          error: requestError instanceof Error && requestError.name === "TimeoutError"
            ? "Google Sheets-ийн хариу удаж байна. Дахин оролдоно уу."
            : "Google Sheets өгөгдлийг унших үед алдаа гарлаа.",
        }));
      }
    })();

    inFlightRef.current = request;
    void request.finally(() => {
      if (inFlightRef.current === request) inFlightRef.current = null;
    });
    return request;
  }, []);

  const refreshLiveOverdue = React.useCallback(() => {
    if (!isAdmin) return Promise.resolve();
    return requestOverdueData(true);
  }, [isAdmin, requestOverdueData]);

  React.useEffect(() => {
    void requestOverdueData(false);
    return () => {
      abortControllerRef.current?.abort();
      inFlightRef.current = null;
    };
  }, [requestOverdueData]);

  const value = React.useMemo(
    () => ({
      overdueData,
      liveOverdueSync,
      canRefresh: isAdmin,
      refreshLiveOverdue,
    }),
    [isAdmin, overdueData, liveOverdueSync, refreshLiveOverdue],
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
