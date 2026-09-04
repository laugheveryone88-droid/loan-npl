import { NextResponse } from "next/server";

import { summarizeSheetHistoryKpis } from "@/features/workbook-data/lib/sheet-history-kpis";
import type {
  GoogleSheetsPayload,
  SheetHistoryEntry,
  SheetHistorySnapshot,
  SheetSnapshotChangeSummary,
} from "@/features/workbook-data/types";
import { LIVE_OVERDUE_SPREADSHEET_ID } from "@/lib/google-sheets";
import {
  getSheetHistorySourceFingerprint,
  getSheetHistorySourcePayload,
  getSheetHistorySourceStats,
  isSheetHistorySourcePayload,
  SHEET_HISTORY_SOURCE_TITLE,
} from "@/lib/sheet-history-source";
import { createServerClient } from "@/lib/supabase";

const HISTORY_PAGE_SIZE = 100;

type HistoryRow = {
  id: number;
  spreadsheet_title: string;
  captured_at: string;
  row_count: number;
  column_count: number;
  change_summary: unknown;
  payload: unknown;
};

type CanonicalHistoryRow = {
  row: HistoryRow;
  payload: GoogleSheetsPayload;
};

function noStoreJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "private, no-cache, no-store, max-age=0");
  return response;
}

function toChangeSummary(value: unknown): SheetSnapshotChangeSummary {
  const summary = value as Partial<SheetSnapshotChangeSummary> | null;
  const addedColumns = Array.isArray(summary?.addedColumns)
    ? summary.addedColumns.filter(
        (item): item is string =>
          typeof item === "string" && item.startsWith(`${SHEET_HISTORY_SOURCE_TITLE} · `),
      )
    : [];
  const removedColumns = Array.isArray(summary?.removedColumns)
    ? summary.removedColumns.filter(
        (item): item is string =>
          typeof item === "string" && item.startsWith(`${SHEET_HISTORY_SOURCE_TITLE} · `),
      )
    : [];

  return {
    kind:
      summary?.kind === "initial" ||
      summary?.kind === "columns" ||
      summary?.kind === "columns-and-data"
        ? summary.kind
        : "data",
    addedColumns,
    removedColumns,
    rowCountDelta: typeof summary?.rowCountDelta === "number" ? summary.rowCountDelta : 0,
  };
}

function toHistoryEntry(row: HistoryRow, payload: GoogleSheetsPayload): SheetHistoryEntry {
  const stats = getSheetHistorySourceStats(payload);
  return {
    id: row.id,
    spreadsheetTitle: row.spreadsheet_title,
    capturedAt: row.captured_at,
    rowCount: stats.rowCount,
    columnCount: stats.columnCount,
    changeSummary: toChangeSummary(row.change_summary),
  };
}

async function loadCanonicalHistory(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  userId: string,
) {
  const rows: HistoryRow[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("sheet_snapshot_history")
      .select("id,spreadsheet_title,captured_at,row_count,column_count,change_summary,payload")
      .eq("user_id", userId)
      .eq("spreadsheet_id", LIVE_OVERDUE_SPREADSHEET_ID)
      .order("captured_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + HISTORY_PAGE_SIZE - 1);

    if (error) return { rows: null, error };

    const page = (data ?? []) as HistoryRow[];
    rows.push(...page);
    if (page.length < HISTORY_PAGE_SIZE) break;
    offset += HISTORY_PAGE_SIZE;
  }

  const canonical: CanonicalHistoryRow[] = [];
  let previousFingerprint: string | null = null;
  for (const row of rows) {
    const storedPayload = row.payload as GoogleSheetsPayload;
    if (!isSheetHistorySourcePayload(storedPayload)) continue;
    const payload = getSheetHistorySourcePayload(storedPayload);
    const fingerprint = payload ? getSheetHistorySourceFingerprint(payload) : null;
    if (!payload || !fingerprint || fingerprint === previousFingerprint) continue;
    canonical.push({ row, payload });
    previousFingerprint = fingerprint;
  }

  return { rows: canonical, error: null };
}

export async function GET(request: Request) {
  const supabase = await createServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (userError || !userId) {
    return noStoreJson(
      { code: "UNAUTHENTICATED", error: "Эхлээд системд нэвтэрнэ үү." },
      { status: 401 },
    );
  }

  const searchParams = new URL(request.url).searchParams;
  const snapshotId = searchParams.get("id");

  if (snapshotId !== null) {
    if (!/^\d+$/.test(snapshotId)) {
      return noStoreJson(
        { code: "INVALID_HISTORY_ID", error: "Түүхийн дугаар буруу байна." },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("sheet_snapshot_history")
      .select("id,spreadsheet_title,captured_at,row_count,column_count,change_summary,payload")
      .eq("id", Number(snapshotId))
      .eq("user_id", userId)
      .eq("spreadsheet_id", LIVE_OVERDUE_SPREADSHEET_ID)
      .maybeSingle();

    if (error) {
      return noStoreJson(
        { code: "HISTORY_READ_ERROR", error: "Түүхэн мэдээллийг уншиж чадсангүй." },
        { status: 500 },
      );
    }
    if (!data) {
      return noStoreJson(
        { code: "HISTORY_NOT_FOUND", error: "Сонгосон түүх олдсонгүй." },
        { status: 404 },
      );
    }

    const storedPayload = data.payload as unknown as GoogleSheetsPayload;
    const sourcePayload = isSheetHistorySourcePayload(storedPayload)
      ? getSheetHistorySourcePayload(storedPayload)
      : null;
    if (!sourcePayload) {
      return noStoreJson(
        { code: "HISTORY_SOURCE_NOT_FOUND", error: `Сонгосон түүхэнд “${SHEET_HISTORY_SOURCE_TITLE}” Sheet олдсонгүй.` },
        { status: 422 },
      );
    }

    const row = data as unknown as HistoryRow;
    const snapshot: SheetHistorySnapshot = {
      ...toHistoryEntry(row, sourcePayload),
      payload: sourcePayload,
    };
    return noStoreJson(snapshot);
  }

  const history = await loadCanonicalHistory(supabase, userId);
  if (history.error || !history.rows) {
    return noStoreJson(
      { code: "HISTORY_READ_ERROR", error: "Өөрчлөлтийн түүхийг уншиж чадсангүй." },
      { status: 500 },
    );
  }

  if (searchParams.get("aggregate") === "all") {
    return noStoreJson({
      summary: summarizeSheetHistoryKpis(history.rows.map((item) => item.payload)),
    });
  }

  return noStoreJson({
    entries: history.rows
      .map(({ row, payload }) => toHistoryEntry(row, payload))
      .reverse(),
  });
}
