import assert from "node:assert/strict";
import test from "node:test";
import { parseOverdueGoogleSheet } from "../src/features/workbook-data/lib/parse-google-sheet.ts";
import { calculatePaymentProgress, groupCifPaymentTotals, summarizePaymentProgress } from "../src/features/workbook-data/lib/payment-progress.ts";

const headers = ["CIF", "Харилцагчийн нэр", "Утас", "Олгосон огноо", "Эргэн төлөх огноо", "Дуусах огноо", "Олгосон дүн", "Зээлийн үлдэгдэл дүн", "Нийт төлбөрийн дүн", "Хаах дүн", "Хугацаа хэтэрсэн хоног", "Төлөв"];
const row = (cif, amount, disbursed = "2026-01-01") => [cif, "Туршилтын нэр", "00000000", disbursed, "2026-02-01", "2026-12-01", 5000000, amount, amount, amount, 100, ""];
const parse = (rows) => parseOverdueGoogleSheet({ spreadsheetTitle: "Synthetic", sheets: [{ title: "Туршилт", values: [headers, ...rows] }] });
const baseline = (records) => groupCifPaymentTotals(records).map((customer) => ({ ...customer, baselineAt: "2026-09-03T08:00:00.000Z" }));

test("5m -> 4m -> 3m gives 1m -> 2m against one immutable baseline, not a running addition", () => {
  const baselines = baseline(parse([row("123", 5000000)]).records);
  const progress = (amount) => calculatePaymentProgress(groupCifPaymentTotals(parse([row("123", amount)]).records), baselines);
  assert.equal(progress(5000000).entries[0].amount, 0);
  assert.equal(progress(4000000).entries[0].amount, 1000000);
  assert.equal(progress(4000000).entries[0].amount, 1000000);
  assert.equal(progress(3000000).entries[0].amount, 2000000);
  assert.equal(progress(4500000).entries[0].amount, 500000);
  assert.equal(progress(6000000).entries[0].amount, 0);
  assert.equal(progress(0).entries[0].amount, 5000000);
  assert.equal(baselines[0].amount, 5000000);
});

test("CIF normalization, multiple loans, and row reorder preserve one customer's total", () => {
  const original = parse([row(" ab 123 ", 3000000), row("AB123", 2000000, "2026-02-01"), row("456", 1000000)]);
  const current = parse([row("456", 1000000), row("AB123", 1500000, "2026-02-01"), row(" ab123 ", 2500000)]);
  const progress = calculatePaymentProgress(groupCifPaymentTotals(current.records), baseline(original.records));
  assert.equal(summarizePaymentProgress(progress, current.records).amount, 1000000);
  assert.equal(summarizePaymentProgress(progress, current.records.filter((r) => r.normalizedCustomerCif === "456")).amount, 0);
  assert.equal(summarizePaymentProgress(progress, current.records).customerCount, 1);
});

test("adding/deleting/replacing loans cannot turn structural changes into payments", () => {
  const original = parse([row("123", 3000000), row("123", 2000000, "2026-02-01")]);
  const baselines = baseline(original.records);
  for (const rows of [
    [row("123", 2000000, "2026-02-01")],
    [...original.records.map((r) => r.sourceValues), row("123", 1000000, "2026-03-01")],
    [row("123", 1000000, "2026-04-01"), row("123", 2000000, "2026-02-01")],
  ]) {
    const progress = calculatePaymentProgress(groupCifPaymentTotals(parse(rows).records), baselines);
    assert.equal(progress.entries[0].issue, "changed-loans");
    assert.equal(progress.entries[0].amount, null);
  }
  assert.equal(calculatePaymentProgress([], baselines).entries.length, 0);
});

test("missing/invalid I amounts, missing CIF, and missing baselines are explicit", () => {
  const baselines = baseline(parse([row("123", 5000000)]).records);
  for (const value of [null, "", "алдаа", -1]) {
    const current = parse([row("123", value), row("", 1000000)]);
    const progress = calculatePaymentProgress(groupCifPaymentTotals(current.records), baselines);
    assert.equal(progress.entries[0].amount, null);
    assert.equal(progress.entries[0].issue, "missing-amount");
    assert.equal(summarizePaymentProgress(progress, current.records).missingCifRows, 1);
  }
  assert.equal(calculatePaymentProgress(groupCifPaymentTotals(parse([row("999", 1)]).records), baselines).entries[0].issue, "missing-baseline");
  assert.equal(summarizePaymentProgress(null, []), null);
  assert.equal(summarizePaymentProgress({ status: "unavailable", entries: [] }, []), null);
});

test("decimal money stays exact and L/DPD/contact edits do not reset the baseline", () => {
  const rows = [row("123", 100.30)];
  const baselines = baseline(parse(rows).records);
  rows[0][8] = 100.10;
  rows[0][11] = "Төлсөн";
  rows[0][10] = 0;
  rows[0][1] = "Шинэ нэр";
  rows[0][2] = "00001111";
  const data = parse(rows);
  const progress = calculatePaymentProgress(groupCifPaymentTotals(data.records), baselines);
  assert.equal(progress.entries[0].amount, 0.20);
  const payload = { spreadsheetTitle: "Saved synthetic", sheets: [{title:"Туршилт",values:[headers,...rows]}], paymentProgress: progress };
  assert.deepEqual(parseOverdueGoogleSheet(JSON.parse(JSON.stringify(payload))).paymentProgress, progress);
});
