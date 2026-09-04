import assert from "node:assert/strict";
import test from "node:test";
import { parseOverdueGoogleSheet } from "../src/features/workbook-data/lib/parse-google-sheet.ts";
import { summarizeResolvedPayments, summarizeUnpaidPayments } from "../src/features/workbook-data/lib/resolved-payments.ts";

const headers = ["CIF", "Харилцагчийн нэр", "Утас", "Олгосон огноо", "Эргэн төлөх огноо", "Дуусах огноо", "Олгосон дүн", "Зээлийн үлдэгдэл дүн", "Нийт төлбөрийн дүн", "Хаах дүн", "Хугацаа хэтэрсэн хоног", "Төлөв"];
const row = (amount, status, cif = "TEST-001") => [cif, "Туршилтын нэр", "00000000", "2026-01-01", "2026-02-01", "2026-03-01", 9000, 8000, amount, 7000, 100, status];
const payload = (rows, columns = headers) => ({ spreadsheetTitle: "Synthetic test", sheets: [{ title: "Туршилт", values: [columns, ...rows] }] });

test("unpaid KPI includes blank and other statuses and excludes only paid loans", () => {
  const data = parseOverdueGoogleSheet(payload([
    row(1000, " ТӨЛСӨН "), row(2000, "Төлөхөө амласан"),
    row(3000, ""), row(4000, "Хэсэгчлэн төлнө"), row(500, "Төлөөгүй"),
  ]));
  const unpaid = summarizeUnpaidPayments(data.records);
  assert.deepEqual(unpaid, { amount: 9500, unpaidRows: 4, missingAmounts: 0 });
  assert.equal(unpaid.amount + summarizeResolvedPayments(data.records).amount, 10500);
  assert.equal(summarizeUnpaidPayments(data.records.slice(0, 2)).amount, 2000);
});

test("status changes transfer the same row's amount between KPIs without losing sibling loans", () => {
  const input = payload([row(1000, "Төлсөн"), row(2000, "Төлөхөө амласан")]);
  const amounts = () => {
    const { records } = parseOverdueGoogleSheet(input);
    return [summarizeUnpaidPayments(records).amount, summarizeResolvedPayments(records).amount];
  };
  assert.deepEqual(amounts(), [2000, 1000]);
  input.sheets[0].values[2][11] = "Төлсөн";
  assert.deepEqual(amounts(), [0, 3000]);
  assert.deepEqual(amounts(), [0, 3000]);
  input.sheets[0].values[1][11] = "";
  assert.deepEqual(amounts(), [1000, 2000]);
  input.sheets[0].values[1][8] = 1500;
  assert.deepEqual(amounts(), [1500, 2000]);
});

test("unpaid missing amounts are flagged and snapshots without status keep all amounts unpaid", () => {
  const data = parseOverdueGoogleSheet(payload([row("", ""), row("алдаа", "Холбогдох боломжгүй"), row(0, ""), row(100, "Төлсөн")]));
  assert.deepEqual(summarizeUnpaidPayments(data.records), { amount: 0, unpaidRows: 3, missingAmounts: 2 });
  const legacy = parseOverdueGoogleSheet(payload([row(100, "Төлсөн").slice(0, 11)], headers.slice(0, 11)));
  assert.deepEqual(summarizeUnpaidPayments(legacy.records), { amount: 100, unpaidRows: 1, missingAmounts: 0 });
});

test("counts only paid individual loans, not all loans of a paid customer's CIF", () => {
  const data = parseOverdueGoogleSheet(payload([
    row("1,234.50", "  Төлсөн  "), row(9000, "Төлөхөө амласан"),
    row("2 000.25 ₮", "ТӨЛСӨН", "TEST-002"), row(500, "Төлсөн эсэх тодорхойгүй"),
  ]));
  assert.deepEqual(summarizeResolvedPayments(data.records), { amount: 3234.75, paidRows: 2, missingAmounts: 0 });
  assert.equal(summarizeResolvedPayments(data.records.slice(0, 1)).amount, 1234.5);
});

test("refreshes status and amount without double counting; current source corrections win", () => {
  const input = payload([row(1000, "Төлсөн"), row(2000, "Төлөхөө амласан")]);
  for (let i = 0; i < 3; i++) assert.equal(summarizeResolvedPayments(parseOverdueGoogleSheet(input).records).amount, 1000);
  input.sheets[0].values[2][11] = "Төлсөн";
  assert.equal(summarizeResolvedPayments(parseOverdueGoogleSheet(input).records).amount, 3000);
  input.sheets[0].values[1][8] = 1500;
  assert.equal(summarizeResolvedPayments(parseOverdueGoogleSheet(input).records).amount, 3500);
  input.sheets[0].values[1][11] = "";
  assert.equal(summarizeResolvedPayments(parseOverdueGoogleSheet(input).records).amount, 2000);
  input.sheets[0].values.splice(2, 1);
  assert.equal(summarizeResolvedPayments(parseOverdueGoogleSheet(input).records).amount, 0);
});

test("preserves new, duplicate, unnamed columns and every edited source value", () => {
  const columns = [...headers, "Тайлбар", "Тайлбар", ""];
  const input = payload([[...row(1000, "Төлсөн"), "эхний", "хоёр дахь", "нэргүй", "цааш"]], columns);
  let data = parseOverdueGoogleSheet(input);
  assert.equal(data.sourceColumns.length, 16);
  assert.equal(data.sourceColumns[11], "Төлөв");
  assert.equal(data.sourceColumns[14], "Багана 15");
  assert.equal(data.records[0].sourceValues[15], "цааш");
  for (let col = 0; col < 16; col++) input.sheets[0].values[1][col] = `өөрчлөлт-${col}`;
  data = parseOverdueGoogleSheet(input);
  for (let col = 0; col < 16; col++) assert.equal(data.records[0].sourceValues[col], `өөрчлөлт-${col}`);
});

test("accepts an emptied sheet and missing first CIF while preserving source row numbers", () => {
  assert.equal(parseOverdueGoogleSheet(payload([])).records.length, 0);
  const data = parseOverdueGoogleSheet(payload([[], row(100, "Төлсөн", ""), [], row(200, "Төлсөн")]));
  assert.deepEqual(data.records.map((r) => r.sourceRow), [3, 5]);
  assert.equal(summarizeResolvedPayments(data.records).amount, 300);
});

test("missing paid amounts are explicit and legacy snapshots without L report zero", () => {
  const data = parseOverdueGoogleSheet(payload([row("", "Төлсөн"), row("алдаа", "Төлсөн"), row(0, "Төлсөн")]));
  assert.deepEqual(summarizeResolvedPayments(data.records), { amount: 0, paidRows: 3, missingAmounts: 2 });
  const legacy = parseOverdueGoogleSheet(payload([row(100, "Төлсөн").slice(0, 11)], headers.slice(0, 11)));
  assert.deepEqual(summarizeResolvedPayments(legacy.records), { amount: 0, paidRows: 0, missingAmounts: 0 });
});
