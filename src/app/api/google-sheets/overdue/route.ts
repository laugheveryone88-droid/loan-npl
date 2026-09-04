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
} from "@/lib/sheet-history-source";
import { persistSheetSnapshot } from "@/lib/sheet-snapshot-history";
import { loadSheetPaymentProgress } from "@/lib/sheet-payment-progress";
import { createServerClient } from "@/lib/supabase";

const MAX_SHEETS = 50;
const MAX_RESPONSE_BYTES = 25 * 1024 * 1024;
// Share only service-account reads within one server instance. User OAuth reads
// are never served from this cache; each caller still passes Supabase Auth first.
let cachedServiceRead: { body: string; expiresAt: number } | null = null;
let serviceReadInFlight: Promise<string | Response> | null = null;

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
  return { supabase, userId };
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
      { code: "GOOGLE_RATE_LIMIT", error: "Google Sheets-ийн унших хязгаарт хүрлээ. Түр хүлээгээд автоматаар дахин шалгана." },
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

async function readServiceAccountSheet(accessToken: string) {
  if (cachedServiceRead && cachedServiceRead.expiresAt > Date.now()) return cachedServiceRead.body;
  if (!serviceReadInFlight) {
    const startedAt = Date.now();
    serviceReadInFlight = readGoogleSheet(accessToken).then((result) => {
      if (typeof result === "string") {
        cachedServiceRead = { body: result, expiresAt: startedAt + 10_000 };
      }
      return result;
    }).finally(() => { serviceReadInFlight = null; });
  }
  const result = await serviceReadInFlight;
  return result instanceof Response ? result.clone() : result;
}

function sheetResponse(
  body: string,
  snapshotHash: string,
  historyStatus: "captured" | "unchanged" | "unavailable",
  ifNoneMatch?: string | null,
) {
  const etag = `"${snapshotHash}"`;
  const headers = {
    "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
    "Content-Type": "application/json; charset=utf-8",
    ETag: etag,
    "X-Sheet-History": historyStatus,
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

  let accessToken: string | null;
  let usesServiceAccount = false;
  try {
    accessToken = await getGoogleServiceAccountAccessToken();
    usesServiceAccount = Boolean(accessToken);
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
    body = usesServiceAccount
      ? await readServiceAccountSheet(accessToken)
      : await readGoogleSheet(accessToken);
  } catch {
    return NextResponse.json(
      { code: "GOOGLE_SHEETS_UNAVAILABLE", error: "Google Sheets-тэй холбогдож чадсангүй. Автоматаар дахин шалгана." },
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
  const responseBody = JSON.stringify(payload);
  const responseHash = createHash("sha256").update(responseBody).digest("hex");
  // Keep the last good snapshot as the baseline source when the baseline store
  // is temporarily unavailable. A retry must not silently reset the comparison.
  if (payload.paymentProgress.status === "unavailable") {
    return sheetResponse(responseBody, responseHash, "unavailable", request.headers.get("if-none-match"));
  }
  const historyPayload = getSheetHistorySourcePayload(payload);
  const historyFingerprint = historyPayload
    ? getSheetHistorySourceFingerprint(historyPayload)
    : null;
  const historyStatus = historyPayload && historyFingerprint
    ? await persistSheetSnapshot({
        supabase: auth.supabase,
        userId: auth.userId,
        payload: historyPayload,
        snapshotHash: createHash("sha256").update(historyFingerprint).digest("hex"),
      }).catch(() => "unavailable" as const)
    : "unavailable" as const;

  return sheetResponse(
    responseBody,
    responseHash,
    historyStatus,
    request.headers.get("if-none-match"),
  );
}
