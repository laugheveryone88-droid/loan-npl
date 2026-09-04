import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const root = fileURLToPath(new URL("..", import.meta.url));
const modules = new Map();
// Load the actual server adapter with a test-only server-only marker shim.
// No application auth code or database client is replaced in production.
function loadSource(relative) {
  const file = path.resolve(root, relative);
  if (modules.has(file)) return modules.get(file).exports;
  const loadedModule = { exports: {} };
  modules.set(file, loadedModule);
  const code = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, {
    module: loadedModule, exports: loadedModule.exports,
    require: (name) => name === "server-only" ? {} : name.startsWith("@/") ? loadSource(`src/${name.slice(2)}.ts`) : require(name),
  }, { filename: file });
  return loadedModule.exports;
}
const { loadSheetPaymentProgress } = loadSource("src/lib/sheet-payment-progress.ts");
const { LIVE_OVERDUE_SPREADSHEET_ID } = loadSource("src/lib/google-sheets.ts");
const headers = ["CIF", "Харилцагчийн нэр", "Утас", "Олгосон огноо", "Эргэн төлөх огноо", "Дуусах огноо", "Олгосон дүн", "Зээлийн үлдэгдэл дүн", "Нийт төлбөрийн дүн"];
const payload = (amount) => ({ spreadsheetTitle: "Synthetic", sheets: [{ title: "Test", values: [headers, ["123", "Test", "00000000", "2026-01-01", "2026-02-01", "2026-12-01", 5000000, amount, amount]] }] });

function store(previous = payload(5000000)) {
  const state = { baselines: [], writes: 0, advances: 0, failRead: false, failAdvance: false, competingAmount: null, competingPeak: null, previous };
  const supabase = { from(table) {
    const filters = []; let range = null; let insert = null;
    const query = {
      select() { return query; }, eq(key, value) { filters.push([key, value]); return query; },
      order() { return query; }, range(start, end) { range = [start, end]; return query; },
      limit() { return query; },
      maybeSingle() { return Promise.resolve({ data: state.previous ? { payload: state.previous, captured_at: "2026-09-03T08:00:00Z" } : null, error: null }); },
      upsert(rows) { insert = rows; return query; },
      then(resolve, reject) { return Promise.resolve().then(() => {
        if (state.failRead) return { data: null, error: new Error("Storage offline") };
        if (insert) {
          state.writes += insert.length;
          for (const row of insert) if (!state.baselines.some((b) => b.customer_cif === row.customer_cif && b.user_id === row.user_id)) {
            state.baselines.push({ ...row, baseline_amount: state.competingAmount ?? row.baseline_amount, high_water_amount: null, high_water_at: null });
          }
          return { data: null, error: null };
        }
        assert.equal(table, "sheet_payment_baselines");
        let data = state.baselines.filter((row) => filters.every(([key, value]) => row[key] === value));
        if (range) data = data.slice(range[0], range[1] + 1);
        return { data, error: null };
      }).then(resolve, reject); },
    };
    return query;
  }, async rpc(name, args) {
    assert.equal(name, "advance_sheet_payment_baselines");
    if (state.failAdvance) return { data: null, error: new Error("Storage offline") };
    for (const observation of args.p_observations) {
      const row = state.baselines.find((b) => b.user_id === "owner-a" && b.spreadsheet_id === args.p_spreadsheet_id
        && b.customer_cif === observation.customer_cif && b.loan_signature === observation.loan_signature);
      if (!row) continue;
      const amount = Math.max(row.baseline_amount, observation.amount, state.competingPeak ?? 0);
      if (row.high_water_amount === null || amount > row.high_water_amount) {
        row.high_water_amount = amount;
        row.high_water_at = observation.observed_at;
        state.advances++;
      }
    }
    return { data: null, error: null };
  } };
  return { state, supabase };
}

test("first sync seeds from saved 5m; reloads and later syncs keep the same stored baseline", async () => {
  const { state, supabase } = store();
  const sync = (amount) => loadSheetPaymentProgress({ supabase, userId: "owner-a", payload: payload(amount) });
  assert.equal((await sync(4000000)).entries[0].amount, 1000000);
  assert.equal((await sync(4000000)).entries[0].amount, 1000000);
  assert.equal((await sync(3000000)).entries[0].amount, 2000000);
  assert.equal(state.writes, 1);
  assert.equal(state.baselines[0].baseline_amount, 5000000);
});

test("new customer establishes current amount and concurrent inserts use the persisted winner", async () => {
  const fresh = store(null);
  assert.equal((await loadSheetPaymentProgress({ supabase: fresh.supabase, userId: "owner-a", payload: payload(4000000) })).entries[0].amount, 0);
  const concurrent = store();
  concurrent.state.competingAmount = 5500000;
  const result = await loadSheetPaymentProgress({ supabase: concurrent.supabase, userId: "owner-a", payload: payload(4000000) });
  assert.equal(result.entries[0].amount, 1500000);
});

test("reads every baseline page and never silently resets when storage is unavailable", async () => {
  const { state, supabase } = store();
  await loadSheetPaymentProgress({ supabase, userId: "owner-a", payload: payload(4000000) });
  const actual = state.baselines[0];
  state.baselines = Array.from({ length: 1000 }, (_, i) => ({ ...actual, customer_cif: `filler-${i}`, spreadsheet_id: LIVE_OVERDUE_SPREADSHEET_ID }));
  state.baselines.push(actual);
  assert.equal((await loadSheetPaymentProgress({ supabase, userId: "owner-a", payload: payload(3000000) })).entries[0].amount, 2000000);
  assert.equal(state.writes, 1);
  state.failRead = true;
  await assert.rejects(loadSheetPaymentProgress({ supabase, userId: "owner-a", payload: payload(2000000) }), /unavailable/);
  assert.equal(state.writes, 1);
});

test("5m -> 7m -> 6m uses persisted 7m; retries and lower rebounds do not reset it", async () => {
  const { state, supabase } = store();
  const sync = (amount) => loadSheetPaymentProgress({ supabase, userId: "owner-a", payload: payload(amount) });
  assert.equal((await sync(5000000)).entries[0].amount, 0);
  assert.equal((await sync(7000000)).entries[0].amount, 0);
  const highAt = state.baselines[0].high_water_at;
  assert.equal((await sync(6000000)).entries[0].amount, 1000000);
  assert.equal((await sync(6000000)).entries[0].amount, 1000000);
  assert.equal((await sync(5000000)).entries[0].amount, 2000000);
  assert.equal((await sync(6500000)).entries[0].amount, 500000);
  assert.equal(state.baselines[0].high_water_amount, 7000000);
  assert.equal(state.baselines[0].high_water_at, highAt);
  assert.equal(state.baselines[0].baseline_amount, 5000000);
  assert.equal(state.advances, 2);
  assert.equal((await sync(8000000)).entries[0].amount, 0);
  assert.equal((await sync(6000000)).entries[0].amount, 2000000);
});

test("upgrade adopts the last saved compatible higher amount; original baseline remains", async () => {
  const { state, supabase } = store();
  const sync = (amount) => loadSheetPaymentProgress({ supabase, userId: "owner-a", payload: payload(amount) });
  await sync(5000000);
  state.baselines[0].high_water_amount = null;
  state.baselines[0].high_water_at = null;
  state.previous = payload(7000000);
  const result = (await sync(6000000)).entries[0];
  assert.equal(result.amount, 1000000);
  assert.equal(result.baselineAmount, 7000000);
  assert.equal(state.baselines[0].baseline_amount, 5000000);
});

test("concurrent higher observation wins; failed writes do not report an unsaved baseline", async () => {
  const { state, supabase } = store();
  const sync = (amount) => loadSheetPaymentProgress({ supabase, userId: "owner-a", payload: payload(amount) });
  await sync(5000000);
  state.competingPeak = 8000000;
  assert.equal((await sync(7000000)).entries[0].amount, 1000000);
  state.competingPeak = null;
  assert.equal((await sync(6000000)).entries[0].amount, 2000000);
  state.failAdvance = true;
  await assert.rejects(sync(9000000), /could not be saved/);
  assert.equal(state.baselines[0].high_water_amount, 8000000);
  state.failAdvance = false;
  assert.equal((await sync(9000000)).entries[0].amount, 0);
});

test("missing amounts and changed loan membership cannot raise the comparison amount", async () => {
  const { state, supabase } = store();
  const sync = (source) => loadSheetPaymentProgress({ supabase, userId: "owner-a", payload: source });
  await sync(payload(5000000));
  assert.equal((await sync(payload(null))).entries[0].issue, "missing-amount");
  const changed = payload(9000000);
  changed.sheets[0].values.push([...changed.sheets[0].values[1]]);
  assert.equal((await sync(changed)).entries[0].issue, "changed-loans");
  assert.equal(state.baselines[0].high_water_amount, 5000000);
  assert.equal((await sync(payload(4000000))).entries[0].amount, 1000000);
});
