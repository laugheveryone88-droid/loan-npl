import { NextResponse } from "next/server";

import type {
  GoogleSheetsPayload,
  SheetHistoryEntry,
  SheetHistorySnapshot,
  SheetSnapshotChangeSummary,
} from "@/features/workbook-data/types";
import { summarizeSheetHistoryKpis } from "@/features/workbook-data/lib/sheet-history-kpis";
import { LIVE_OVERDUE_SPREADSHEET_ID } from "@/lib/google-sheets";
import { createServerClient } from "@/lib/supabase";

const HISTORY_PAGE_SIZE = 100;

function noStoreJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "private, no-cache, no-store, max-age=0");
  return response;
}

function toChangeSummary(value: unknown): SheetSnapshotChangeSummary {
  const summary = value as Partial<SheetSnapshotChangeSummary> | null;
  return {
    kind:
      summary?.kind === "initial" ||
      summary?.kind === "columns" ||
      summary?.kind === "columns-and-data"
        ? summary.kind
        : "data",
    addedColumns: Array.isArray(summary?.addedColumns)
      ? summary.addedColumns.filter((item): item is string => typeof item === "string")
      : [],
    removedColumns: Array.isArray(summary?.removedColumns)
      ? summary.removedColumns.filter((item): item is string => typeof item === "string")
      : [],
    rowCountDelta: typeof summary?.rowCountDelta === "number" ? summary.rowCountDelta : 0,
  };
}

function toHistoryEntry(row: {
  id: number;
  spreadsheet_title: string;
  captured_at: string;
  row_count: number;
  column_count: number;
  change_summary: unknown;
}): SheetHistoryEntry {
  return {
    id: row.id,
    spreadsheetTitle: row.spreadsheet_title,
    capturedAt: row.captured_at,
    rowCount: row.row_count,
    columnCount: row.column_count,
    changeSummary: toChangeSummary(row.change_summary),
  };
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
  if (searchParams.get("aggregate") === "all") {
    const payloads: GoogleSheetsPayload[] = [];
    let offset = 0;

    while (true) {
      const { data, error } = await supabase
        .from("sheet_snapshot_history")
        .select("payload")
        .eq("user_id", userId)
        .eq("spreadsheet_id", LIVE_OVERDUE_SPREADSHEET_ID)
        .order("captured_at", { ascending: false })
        .order("id", { ascending: false })
        .range(offset, offset + HISTORY_PAGE_SIZE - 1);

      if (error) {
        return noStoreJson(
          { code: "HISTORY_READ_ERROR", error: "Өөрчлөлтийн түүхийн нийлбэрийг уншиж чадсангүй." },
          { status: 500 },
        );
      }

      const page = data ?? [];
      payloads.push(...page.map((row) => row.payload as unknown as GoogleSheetsPayload));
      if (page.length < HISTORY_PAGE_SIZE) break;
      offset += HISTORY_PAGE_SIZE;
    }

    return noStoreJson({ summary: summarizeSheetHistoryKpis(payloads) });
  }

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

    const snapshot: SheetHistorySnapshot = {
      ...toHistoryEntry(data),
      payload: data.payload as unknown as GoogleSheetsPayload,
    };
    return noStoreJson(snapshot);
  }

  const rows: Parameters<typeof toHistoryEntry>[0][] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("sheet_snapshot_history")
      .select("id,spreadsheet_title,captured_at,row_count,column_count,change_summary")
      .eq("user_id", userId)
      .eq("spreadsheet_id", LIVE_OVERDUE_SPREADSHEET_ID)
      .order("captured_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + HISTORY_PAGE_SIZE - 1);

    if (error) {
      return noStoreJson(
        { code: "HISTORY_READ_ERROR", error: "Өөрчлөлтийн түүхийг уншиж чадсангүй." },
        { status: 500 },
      );
    }

    const page = data ?? [];
    rows.push(...page);
    if (page.length < HISTORY_PAGE_SIZE) break;
    offset += HISTORY_PAGE_SIZE;
  }

  return noStoreJson({ entries: rows.map(toHistoryEntry) });
}
