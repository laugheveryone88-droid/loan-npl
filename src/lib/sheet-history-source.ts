import "server-only";

import type { GoogleSheetsPayload } from "@/features/workbook-data/types";

export const SHEET_HISTORY_SOURCE_TITLE = "Үндсэн";

function normalizeSheetTitle(value: string) {
  return value.normalize("NFKC").trim().toLocaleLowerCase("mn-MN");
}

export function isSheetHistorySourcePayload(payload: GoogleSheetsPayload) {
  return (
    payload.sheets.length === 1 &&
    normalizeSheetTitle(payload.sheets[0]?.title ?? "") ===
      normalizeSheetTitle(SHEET_HISTORY_SOURCE_TITLE)
  );
}

export function getSheetHistorySourcePayload(
  payload: GoogleSheetsPayload,
): GoogleSheetsPayload | null {
  const sourceSheet = payload.sheets.find(
    (sheet) => normalizeSheetTitle(sheet.title) === normalizeSheetTitle(SHEET_HISTORY_SOURCE_TITLE),
  );
  if (!sourceSheet) return null;

  return {
    spreadsheetTitle: payload.spreadsheetTitle,
    sheets: [sourceSheet],
    ...(payload.paymentProgress ? { paymentProgress: payload.paymentProgress } : {}),
  };
}

export function getSheetHistorySourceFingerprint(payload: GoogleSheetsPayload) {
  const source = getSheetHistorySourcePayload(payload);
  return source ? JSON.stringify(source.sheets[0]) : null;
}

export function getSheetHistorySourceStats(payload: GoogleSheetsPayload) {
  const source = getSheetHistorySourcePayload(payload);
  const values = source?.sheets[0]?.values ?? [];
  return {
    rowCount: Math.max(values.length - 1, 0),
    columnCount: values.reduce((maximum, row) => Math.max(maximum, row.length), 0),
  };
}
