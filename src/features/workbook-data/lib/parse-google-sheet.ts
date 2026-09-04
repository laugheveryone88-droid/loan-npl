import type {
  GoogleSheetTab,
  GoogleSheetsPayload,
  OverdueLoanRecord,
  OverdueSheetData,
} from "@/features/workbook-data/types";

type SourceRow = Record<string, unknown>;

function normalizedHeader(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("mn-MN")
    .replace(/\s+/g, " ");
}

function findValue(row: SourceRow, aliases: string[]) {
  const aliasSet = new Set(aliases.map(normalizedHeader));
  const entry = Object.entries(row).find(([key]) => aliasSet.has(normalizedHeader(key)));
  return entry?.[1] ?? null;
}

function toText(value: unknown) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
}

function toNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;

  const normalized = value.replace(/[,\s₮]/g, "").replace(/MNT/gi, "").trim();
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function toInteger(value: unknown) {
  const parsed = toNumber(value);
  return parsed === null ? null : Math.trunc(parsed);
}

function toDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;

  const normalized = value.trim();
  const yearFirst = normalized.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
  if (yearFirst) {
    return `${yearFirst[1]}-${yearFirst[2].padStart(2, "0")}-${yearFirst[3].padStart(2, "0")}`;
  }

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? normalized : parsed.toISOString().slice(0, 10);
}

export function normalizePhone(value: unknown) {
  const text = toText(value);
  if (!text) return null;

  const digits = text.replace(/\D/g, "");
  return digits.length < 8 ? null : digits.slice(-8);
}

export function normalizeCustomerCif(value: unknown) {
  const text = toText(value);
  if (!text) return null;

  return text
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .toLocaleUpperCase("mn-MN");
}

function buildUniqueHeaders(values: unknown[]) {
  const counts = new Map<string, number>();

  return values.map((value) => {
    const base = toText(value) ?? "__EMPTY";
    const count = counts.get(base) ?? 0;
    counts.set(base, count + 1);
    return count === 0 ? base : `${base}_${count}`;
  });
}

function rowsFromSheet(sheet: GoogleSheetTab) {
  const [headerValues = [], ...dataValues] = sheet.values;
  const width = sheet.values.reduce((max, row) => Math.max(max, row.length), 0);
  const headers = buildUniqueHeaders(Array.from({ length: width }, (_, index) => headerValues[index]));

  return dataValues
    .map((values, index) => ({
      sourceRow: index + 2,
      values,
      row: Object.fromEntries(headers.map((header, index) => [header, values[index] ?? null])),
    }))
    .filter(({ values }) => values.some((value) => toText(value) !== null));
}

function findDataSheet(sheets: GoogleSheetTab[]) {
  for (const sheet of sheets) {
    const headers = (sheet.values[0] ?? []).map((value) => normalizedHeader(String(value ?? "")));
    if (
      headers.some((header) => ["сиф", "cif", "сиф дугаар", "cif дугаар"].includes(header)) &&
      headers.includes("харилцагчийн нэр") &&
      headers.some((header) => ["утас", "phone"].includes(header))
    ) {
      return { sheet, rows: rowsFromSheet(sheet) };
    }
  }

  throw new Error("Хугацаа хэтрэлтийн үндсэн Google Sheet tab-ийг таньж чадсангүй.");
}

export function parseOverdueGoogleSheet(payload: GoogleSheetsPayload): OverdueSheetData {
  const main = findDataSheet(payload.sheets);

  const records: OverdueLoanRecord[] = main.rows.map(({ row, values, sourceRow }) => {
    const dpdMeasurements = Object.entries(row)
      .filter(([header]) => normalizedHeader(header).startsWith("хугацаа хэтэрсэн хоног"))
      .map(([header, value]) => ({ label: header, value: toInteger(value) }));
    const paymentMeasurements = Object.entries(row)
      .filter(([header]) => normalizedHeader(header).startsWith("төлөгдсөн дүн"))
      .map(([header, value]) => ({ label: header, value: toNumber(value) }));
    const latestDpd = dpdMeasurements.at(-1)?.value ?? null;
    const previousDpd = dpdMeasurements.at(-2)?.value ?? null;
    const customerCif = toText(
      findValue(row, ["сиф", "cif", "сиф дугаар", "cif дугаар"]),
    );
    const phoneNumber = toText(findValue(row, ["утас", "phone"]));

    return {
      id: `${main.sheet.title}:${sourceRow}`,
      sourceSheet: main.sheet.title,
      sourceRow,
      sourceValues: values,
      collectionStatus: toText(findValue(row, ["төлөв"])),
      customerCif,
      normalizedCustomerCif: normalizeCustomerCif(customerCif),
      customerName: toText(findValue(row, ["харилцагчийн нэр"])),
      phoneNumber,
      normalizedPhone: normalizePhone(phoneNumber),
      disbursedDate: toDate(findValue(row, ["олгосон огноо"])),
      repaymentDate: toDate(findValue(row, ["эргэн төлөх огноо"])),
      maturityDate: toDate(findValue(row, ["дуусах огноо"])),
      originalAmount: toNumber(findValue(row, ["олгосон дүн"])),
      outstandingAmount: toNumber(findValue(row, ["зээлийн үлдэгдэл дүн"])),
      totalPaymentAmount: toNumber(findValue(row, ["нийт төлбөрийн дүн"])),
      closingAmount: toNumber(findValue(row, ["хаах дүн"])),
      dpdMeasurements,
      dashboardDpd: dpdMeasurements.at(0)?.value ?? null,
      paymentMeasurements,
      latestDpd,
      previousDpd,
      dpdDelta:
        latestDpd !== null && previousDpd !== null ? latestDpd - previousDpd : null,
      latestPayment: paymentMeasurements.at(-1)?.value ?? null,
      posStatus: toText(findValue(row, ["pos төлөв", "пос төлөв"])),
      repaymentStatus: toText(findValue(row, ["зээл төлөгдсөн эсэх", "төлөгдсөн"])),
    };
  });

  return {
    paymentProgress: payload.paymentProgress ?? null,
    sourceColumns: Array.from(
      { length: main.sheet.values.reduce((max, row) => Math.max(max, row.length), 0) },
      (_, index) => toText(main.sheet.values[0]?.[index]) ?? `Багана ${index + 1}`,
    ),
    summary: {
      title: payload.spreadsheetTitle,
      loadedAt: new Date().toISOString(),
      sheetCount: payload.sheets.length,
      sourceRows: records.length,
      sheets: payload.sheets.map((sheet) => ({
        title: sheet.title,
        rowCount: sheet.values.length,
        columnCount: Math.max(...sheet.values.map((row) => row.length), 0),
        isDataSheet: sheet.title === main.sheet.title,
      })),
    },
    records,
  };
}
