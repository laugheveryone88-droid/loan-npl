import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  GoogleSheetsPayload,
  SheetSnapshotChangeSummary,
} from "@/features/workbook-data/types";
import { LIVE_OVERDUE_SPREADSHEET_ID } from "@/lib/google-sheets";
import {
  getSheetHistorySourceFingerprint,
  getSheetHistorySourcePayload,
} from "@/lib/sheet-history-source";
import type { Database, Json } from "@/types/database";

type SnapshotHistoryStatus = "captured" | "unchanged" | "unavailable";

function getSheetHeaders(payload: GoogleSheetsPayload) {
  const result = new Map<string, string[]>();

  payload.sheets.forEach((sheet) => {
    const headers = (sheet.values[0] ?? []).map((value, index) => {
      const text = String(value ?? "").normalize("NFKC").trim();
      return text || `Баган ${index + 1}`;
    });
    result.set(sheet.title, headers);
  });

  return result;
}

function getPayloadStats(payload: GoogleSheetsPayload) {
  return {
    rowCount: payload.sheets.reduce(
      (total, sheet) => total + Math.max(sheet.values.length - 1, 0),
      0,
    ),
    columnCount: payload.sheets.reduce(
      (maximum, sheet) => Math.max(maximum, sheet.values[0]?.length ?? 0),
      0,
    ),
  };
}

function buildChangeSummary(
  current: GoogleSheetsPayload,
  previous: GoogleSheetsPayload | null,
): SheetSnapshotChangeSummary {
  const currentStats = getPayloadStats(current);
  if (!previous) {
    return {
      kind: "initial",
      addedColumns: [...getSheetHeaders(current).entries()].flatMap(([sheet, headers]) =>
        headers.map((header) => `${sheet} · ${header}`),
      ),
      removedColumns: [],
      rowCountDelta: currentStats.rowCount,
    };
  }

  const previousStats = getPayloadStats(previous);
  const currentHeaders = getSheetHeaders(current);
  const previousHeaders = getSheetHeaders(previous);
  const sheetTitles = new Set([...currentHeaders.keys(), ...previousHeaders.keys()]);
  const addedColumns: string[] = [];
  const removedColumns: string[] = [];

  sheetTitles.forEach((sheet) => {
    const currentSet = new Set(currentHeaders.get(sheet) ?? []);
    const previousSet = new Set(previousHeaders.get(sheet) ?? []);
    currentSet.forEach((header) => {
      if (!previousSet.has(header)) addedColumns.push(`${sheet} · ${header}`);
    });
    previousSet.forEach((header) => {
      if (!currentSet.has(header)) removedColumns.push(`${sheet} · ${header}`);
    });
  });

  const hasColumnChanges = addedColumns.length > 0 || removedColumns.length > 0;
  const rowCountDelta = currentStats.rowCount - previousStats.rowCount;
  return {
    kind: hasColumnChanges
      ? rowCountDelta === 0
        ? "columns"
        : "columns-and-data"
      : "data",
    addedColumns,
    removedColumns,
    rowCountDelta,
  };
}

export async function persistSheetSnapshot({
  supabase,
  userId,
  payload,
  snapshotHash,
}: {
  supabase: SupabaseClient<Database>;
  userId: string;
  payload: GoogleSheetsPayload;
  snapshotHash: string;
}): Promise<SnapshotHistoryStatus> {
  const { data: previous, error: previousError } = await supabase
    .from("sheet_snapshot_history")
    .select("id,snapshot_hash,payload")
    .eq("user_id", userId)
    .eq("spreadsheet_id", LIVE_OVERDUE_SPREADSHEET_ID)
    .order("captured_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (previousError) return "unavailable";
  if (previous?.snapshot_hash === snapshotHash) return "unchanged";

  const stats = getPayloadStats(payload);
  const previousPayload = previous?.payload
    ? getSheetHistorySourcePayload(previous.payload as unknown as GoogleSheetsPayload)
    : null;
  if (
    previousPayload &&
    getSheetHistorySourceFingerprint(previousPayload) === getSheetHistorySourceFingerprint(payload)
  ) {
    return "unchanged";
  }
  const { data: inserted, error: insertError } = await supabase
    .from("sheet_snapshot_history")
    .insert({
      user_id: userId,
      spreadsheet_id: LIVE_OVERDUE_SPREADSHEET_ID,
      spreadsheet_title: payload.spreadsheetTitle,
      snapshot_hash: snapshotHash,
      row_count: stats.rowCount,
      column_count: stats.columnCount,
      change_summary: buildChangeSummary(payload, previousPayload) as unknown as Json,
      payload: payload as unknown as Json,
    })
    .select("id")
    .maybeSingle();

  if (insertError) return "unavailable";
  return inserted ? "captured" : "unchanged";
}
