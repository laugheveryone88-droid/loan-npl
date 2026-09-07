import { createHash } from "node:crypto";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import type { GoogleSheetsPayload } from "@/features/workbook-data/types";
import {
  GOOGLE_SHEETS_ACCESS_TOKEN_COOKIE,
  LIVE_OVERDUE_SPREADSHEET_ID,
} from "@/lib/google-sheets";
import { getGoogleServiceAccountAccessToken } from "@/lib/google-sheets-service-account";
import {
  getSheetHistorySourceFingerprint,
  getSheetHistorySourcePayload,
  getSheetHistorySourceStats,
} from "@/lib/sheet-history-source";
import { persistSheetSnapshot } from "@/lib/sheet-snapshot-history";
import { loadSheetPaymentProgress } from "@/lib/sheet-payment-progress";
import { createServerClient } from "@/lib/supabase";
import type { Json } from "@/types/database";

const MAX_SHEETS = 50;
const MAX_RESPONSE_BYTES = 25 * 1024 * 1024;
type GoogleSheetMetadata = {
  properties?: { title?: string };
  sheets?: Array<{
    properties?: { index?: number; title?: string };
  }>;
};

type GoogleValueRange = { values?: unknown[][] };
type GoogleBatchValues = { valueRanges?: GoogleValueRange[] };

async function getAuthenticatedContext() {
  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.getUser();
  const userId = data.user?.id;
  if (error || !userId) return null;
  return {
    supabase,
    userId,
    isAdmin: data.user.app_metadata?.role === "admin",
  };
}

async function getUserGoogleAccessToken() {
  return (await cookies()).get(GOOGLE_SHEETS_ACCESS_TOKEN_COOKIE)?.value ?? null;
}

async function googleFetch(url: string, accessToken: string) {
  return fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
}

function googleErrorResponse(status: number) {
  if (status === 429) {
    return NextResponse.json(
      { code: "GOOGLE_RATE_LIMIT", error: "Google Sheets-ийн унших хязгаарт хүрлээ. Түр хүлээгээд дахин оролдоно уу." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }
  if (status === 401) {
    const response = NextResponse.json(
      {
        code: "GOOGLE_RECONNECT",
        error: "Google эрхийн хугацаа дууссан байна. Эрхээ шинэчилнэ үү.",
      },
      { status: 401 },
    );
    response.cookies.delete(GOOGLE_SHEETS_ACCESS_TOKEN_COOKIE);
    return response;
  }

  if (status === 403) {
    return NextResponse.json(
      {
        code: "GOOGLE_ACCESS_DENIED",
        error: "Энэ Google Sheet-ийг унших эрхгүй эсвэл Sheets API идэвхгүй байна.",
      },
      { status: 403 },
    );
  }

  if (status === 404) {
    return NextResponse.json(
      { code: "SHEET_NOT_FOUND", error: "Тохируулсан Google Sheet олдсонгүй." },
      { status: 404 },
    );
  }

  return NextResponse.json(
    { code: "GOOGLE_SHEETS_ERROR", error: "Google Sheets-ээс өгөгдөл унших үед алдаа гарлаа." },
    { status: 502 },
  );
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function readGoogleSheet(accessToken: string) {
  const metadataUrl = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(LIVE_OVERDUE_SPREADSHEET_ID)}`,
  );
  metadataUrl.searchParams.set("includeGridData", "false");
  metadataUrl.searchParams.set("fields", "properties(title),sheets(properties(title,index))");

  const metadataResponse = await googleFetch(metadataUrl.toString(), accessToken);
  if (!metadataResponse.ok) return googleErrorResponse(metadataResponse.status);

  const metadata = (await metadataResponse.json()) as GoogleSheetMetadata;
  const sheetTitles = (metadata.sheets ?? [])
    .map((sheet) => sheet.properties)
    .filter(
      (properties): properties is { index: number; title: string } =>
        typeof properties?.title === "string" && typeof properties.index === "number",
    )
    .sort((left, right) => left.index - right.index)
    .map((properties) => properties.title);

  if (sheetTitles.length === 0) {
    return NextResponse.json(
      { code: "EMPTY_SHEET", error: "Унших Google Sheet tab олдсонгүй." },
      { status: 422 },
    );
  }
  if (sheetTitles.length > MAX_SHEETS) {
    return NextResponse.json(
      { code: "TOO_MANY_SHEETS", error: `Хамгийн ихдээ ${MAX_SHEETS} tab уншина.` },
      { status: 413 },
    );
  }

  const valueRanges: GoogleValueRange[] = [];
  for (const titleChunk of chunk(sheetTitles, 15)) {
    const valuesUrl = new URL(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(LIVE_OVERDUE_SPREADSHEET_ID)}/values:batchGet`,
    );
    valuesUrl.searchParams.set("majorDimension", "ROWS");
    valuesUrl.searchParams.set("valueRenderOption", "FORMATTED_VALUE");
    titleChunk.forEach((title) =>
      valuesUrl.searchParams.append("ranges", `'${title.replaceAll("'", "''")}'!A:ZZZ`),
    );

    const valuesResponse = await googleFetch(valuesUrl.toString(), accessToken);
    if (!valuesResponse.ok) return googleErrorResponse(valuesResponse.status);

    const values = (await valuesResponse.json()) as GoogleBatchValues;
    valueRanges.push(...(values.valueRanges ?? []));
  }

  const payload: GoogleSheetsPayload = {
    spreadsheetTitle: metadata.properties?.title ?? "Google Sheets өгөгдлийн сан",
    sheets: sheetTitles.map((title, index) => ({
      title,
      values: valueRanges[index]?.values ?? [],
    })),
  };
  const body = JSON.stringify(payload);

  if (Buffer.byteLength(body, "utf8") > MAX_RESPONSE_BYTES) {
    return NextResponse.json(
      { code: "SHEET_TOO_LARGE", error: "Google Sheet-ийн ашиглагдсан өгөгдөл 25 MB-аас их байна." },
      { status: 413 },
    );
  }

  return body;
}

function sheetResponse(
  body: string,
  snapshotHash: string,
  updatedAt: string,
  historyStatus?: "captured" | "unchanged" | "unavailable",
  changed?: boolean,
  ifNoneMatch?: string | null,
) {
  const etag = `"${snapshotHash}"`;
  const headers = {
    "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
    "Content-Type": "application/json; charset=utf-8",
    ETag: etag,
    "X-Sheet-Updated-At": updatedAt,
    ...(historyStatus ? { "X-Sheet-History": historyStatus } : {}),
    ...(typeof changed === "boolean" ? { "X-Sheet-Changed": String(changed) } : {}),
  };

  if (ifNoneMatch === etag) {
    return new Response(null, { status: 304, headers });
  }

  return new Response(body, { headers });
}

export async function GET(request: Request) {
  const auth = await getAuthenticatedContext();
  if (!auth) {
    return NextResponse.json(
      { code: "UNAUTHENTICATED", error: "Эхлээд системд нэвтэрнэ үү." },
      { status: 401 },
    );
  }

  const { data: current, error } = await auth.supabase
    .from("sheet_current_state")
    .select("payload,snapshot_hash,updated_at")
    .eq("spreadsheet_id", LIVE_OVERDUE_SPREADSHEET_ID)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { code: "SAVED_SHEET_READ_ERROR", error: "Хадгалсан Sheet өгөгдлийг уншиж чадсангүй." },
      { status: 500 },
    );
  }
  if (!current) {
    return NextResponse.json(
      { code: "SAVED_SHEET_NOT_FOUND", error: "Админ Google Sheet өгөгдлийг анх удаа шинэчлэх шаардлагатай." },
      { status: 503 },
    );
  }

  return sheetResponse(
    JSON.stringify(current.payload),
    current.snapshot_hash,
    current.updated_at,
    undefined,
    undefined,
    request.headers.get("if-none-match"),
  );
}

export async function POST() {
  const auth = await getAuthenticatedContext();
  if (!auth) {
    return NextResponse.json(
      { code: "UNAUTHENTICATED", error: "Эхлээд системд нэвтэрнэ үү." },
      { status: 401 },
    );
  }
  if (!auth.isAdmin) {
    return NextResponse.json(
      { code: "ADMIN_REQUIRED", error: "Google Sheet өгөгдлийг зөвхөн админ шинэчилнэ." },
      { status: 403 },
    );
  }

  let accessToken: string | null;
  try {
    accessToken = await getGoogleServiceAccountAccessToken();
    accessToken ??= await getUserGoogleAccessToken();
  } catch {
    return NextResponse.json(
      {
        code: "GOOGLE_DATABASE_CONFIG_ERROR",
        error: "Google Sheets өгөгдлийн сангийн серверийн тохиргоо дутуу байна.",
      },
      { status: 503 },
    );
  }

  if (!accessToken) {
    return NextResponse.json(
      { code: "GOOGLE_RECONNECT", error: "Google Sheets унших эрхээ холбоно уу." },
      { status: 401 },
    );
  }

  let body: string | Response;
  try {
    body = await readGoogleSheet(accessToken);
  } catch {
    return NextResponse.json(
      { code: "GOOGLE_SHEETS_UNAVAILABLE", error: "Google Sheets-тэй холбогдож чадсангүй. Дахин оролдоно уу." },
      { status: 502 },
    );
  }
  if (body instanceof Response) return body;

  const payload = JSON.parse(body) as GoogleSheetsPayload;
  try {
    payload.paymentProgress = await loadSheetPaymentProgress({
      supabase: auth.supabase, userId: auth.userId, payload,
    });
  } catch {
    payload.paymentProgress = { status: "unavailable", entries: [] };
  }
  const historyPayload = getSheetHistorySourcePayload(payload);
  const historyFingerprint = historyPayload
    ? getSheetHistorySourceFingerprint(historyPayload)
    : null;
  if (!historyPayload || !historyFingerprint || payload.paymentProgress.status === "unavailable") {
    return NextResponse.json(
      { code: "SHEET_REFRESH_INCOMPLETE", error: "Шинэ өгөгдлийг бүрэн тооцоолж чадсангүй. Хадгалсан хувилбар өөрчлөгдөөгүй." },
      { status: 503 },
    );
  }

  const snapshotHash = createHash("sha256").update(historyFingerprint).digest("hex");
  const { data: current, error: currentError } = await auth.supabase
    .from("sheet_current_state")
    .select("payload,snapshot_hash,updated_at")
    .eq("spreadsheet_id", LIVE_OVERDUE_SPREADSHEET_ID)
    .maybeSingle();
  if (currentError) {
    return NextResponse.json(
      { code: "SAVED_SHEET_READ_ERROR", error: "Хадгалсан Sheet өгөгдлийг уншиж чадсангүй." },
      { status: 500 },
    );
  }

  if (current?.snapshot_hash === snapshotHash) {
    return sheetResponse(
      JSON.stringify(current.payload),
      current.snapshot_hash,
      current.updated_at,
      "unchanged",
      false,
    );
  }

  const updatedAt = new Date().toISOString();
  const stats = getSheetHistorySourceStats(historyPayload);
  const { error: publishError } = await auth.supabase
    .from("sheet_current_state")
    .upsert({
      spreadsheet_id: LIVE_OVERDUE_SPREADSHEET_ID,
      spreadsheet_title: historyPayload.spreadsheetTitle,
      snapshot_hash: snapshotHash,
      payload: historyPayload as unknown as Json,
      row_count: stats.rowCount,
      column_count: stats.columnCount,
      updated_at: updatedAt,
      updated_by: auth.userId,
    });
  if (publishError) {
    return NextResponse.json(
      { code: "SHEET_PUBLISH_ERROR", error: "Шинэ Sheet өгөгдлийг аппд хадгалж чадсангүй." },
      { status: 500 },
    );
  }

  const historyStatus = await persistSheetSnapshot({
    supabase: auth.supabase,
    userId: auth.userId,
    payload: historyPayload,
    snapshotHash,
  }).catch(() => "unavailable" as const);

  return sheetResponse(
    JSON.stringify(historyPayload),
    snapshotHash,
    updatedAt,
    historyStatus,
    true,
  );
}
