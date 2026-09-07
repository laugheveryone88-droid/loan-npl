import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { parseOverdueGoogleSheet } from "@/features/workbook-data/lib/parse-google-sheet";
import { calculatePaymentProgress, groupCifPaymentTotals } from "@/features/workbook-data/lib/payment-progress";
import type { GoogleSheetsPayload, PaymentProgressData } from "@/features/workbook-data/types";
import { LIVE_OVERDUE_SPREADSHEET_ID } from "@/lib/google-sheets";
import type { Database, Tables, TablesInsert } from "@/types/database";

const PAGE_SIZE = 1000;

async function readBaselines(supabase: SupabaseClient<Database>, userId: string) {
  const rows: Tables<"sheet_payment_baselines">[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase.from("sheet_payment_baselines")
      .select("*")
      .eq("user_id", userId)
      .eq("spreadsheet_id", LIVE_OVERDUE_SPREADSHEET_ID)
      .order("customer_cif")
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error("Payment baselines unavailable.");
    rows.push(...data);
    if (data.length < PAGE_SIZE) return rows;
  }
}

export async function loadSheetPaymentProgress({ supabase, userId, payload }: {
  supabase: SupabaseClient<Database>;
  userId: string;
  payload: GoogleSheetsPayload;
}): Promise<PaymentProgressData> {
  const current = groupCifPaymentTotals(parseOverdueGoogleSheet(payload).records);
  const currentByCif = new Map(current.map((customer) => [customer.cif, customer]));
  let baselines = await readBaselines(supabase, userId);
  const knownCifs = new Set(baselines.map((row) => row.customer_cif));
  const missing = current.filter((customer) => customer.amount !== null && !knownCifs.has(customer.cif));
  const observedAt = new Date().toISOString();
  let previousTotals: ReturnType<typeof groupCifPaymentTotals> = [];
  let previousCapturedAt: string | null = null;

  if (missing.length > 0 || baselines.some((row) => {
    const customer = currentByCif.get(row.customer_cif);
    return row.high_water_amount === null && customer?.amount != null && customer.loanSignature === row.loan_signature;
  })) {
    // Use the latest retained source when first enabling this metric, so a
    // change since the user's previous visit can still be measured.
    const { data: previous, error } = await supabase.from("sheet_current_state")
      .select("payload,updated_at")
      .eq("spreadsheet_id", LIVE_OVERDUE_SPREADSHEET_ID)
      .maybeSingle();
    if (error) throw new Error("Previous payment source unavailable.");
    if (previous) {
      previousCapturedAt = previous.updated_at;
      try {
        previousTotals = groupCifPaymentTotals(parseOverdueGoogleSheet(previous.payload as unknown as GoogleSheetsPayload).records);
      } catch {
        // An incompatible old sheet cannot establish a valid baseline.
      }
    }
  }
  const previousByCif = new Map(previousTotals.map((customer) => [customer.cif, customer]));

  if (missing.length > 0) {
    const inserts: TablesInsert<"sheet_payment_baselines">[] = missing.map((customer) => {
      const prior = previousByCif.get(customer.cif);
      const canUsePrior = prior?.amount !== null && prior?.amount !== undefined && prior.loanSignature === customer.loanSignature;
      return {
        user_id: userId,
        spreadsheet_id: LIVE_OVERDUE_SPREADSHEET_ID,
        customer_cif: customer.cif,
        baseline_amount: canUsePrior ? prior.amount! : customer.amount!,
        loan_signature: customer.loanSignature,
        baseline_at: canUsePrior ? previousCapturedAt! : observedAt,
      };
    });
    for (let offset = 0; offset < inserts.length; offset += 500) {
      const { error: insertError } = await supabase.from("sheet_payment_baselines")
        .upsert(inserts.slice(offset, offset + 500), {
          onConflict: "user_id,spreadsheet_id,customer_cif", ignoreDuplicates: true,
        });
      if (insertError) throw new Error("Payment baseline could not be saved.");
    }
    // The unique key decides simultaneous first visits. Always use the winner,
    // never a local candidate that may not have been persisted.
    baselines = await readBaselines(supabase, userId);
  }

  const observations: Array<{ customer_cif: string; loan_signature: string; amount: number; observed_at: string }> = [];
  for (const baseline of baselines) {
    const customer = currentByCif.get(baseline.customer_cif);
    if (customer?.amount === null || customer?.amount === undefined || customer.loanSignature !== baseline.loan_signature) continue;
    let amount = Number(baseline.high_water_amount ?? baseline.baseline_amount);
    let at = baseline.high_water_at ?? baseline.baseline_at;
    // Existing baselines can adopt the last saved compatible amount on upgrade.
    // Older snapshots remain immutable and are not reinterpreted as receipts.
    const prior = previousByCif.get(customer.cif);
    if (baseline.high_water_amount === null && prior?.amount !== null && prior?.amount !== undefined
      && prior.loanSignature === baseline.loan_signature && prior.amount > amount) {
      amount = prior.amount;
      at = previousCapturedAt!;
    }
    if (customer.amount > amount) {
      amount = customer.amount;
      at = observedAt;
    }
    if (baseline.high_water_amount === null || amount > Number(baseline.high_water_amount)) {
      observations.push({ customer_cif: customer.cif, loan_signature: customer.loanSignature, amount, observed_at: at });
    }
  }
  for (let offset = 0; offset < observations.length; offset += 500) {
    const { error } = await supabase.rpc("advance_sheet_payment_baselines", {
      p_spreadsheet_id: LIVE_OVERDUE_SPREADSHEET_ID,
      p_observations: observations.slice(offset, offset + 500),
    });
    if (error) throw new Error("Payment comparison amount could not be saved.");
  }
  if (observations.length > 0) {
    baselines = await readBaselines(supabase, userId);
    const savedByCif = new Map(baselines.map((row) => [row.customer_cif, row]));
    if (observations.some((item) => Number(savedByCif.get(item.customer_cif)?.high_water_amount ?? -1) < item.amount)) {
      throw new Error("Payment comparison amount could not be verified.");
    }
  }

  return calculatePaymentProgress(current, baselines.map((row) => ({
    cif: row.customer_cif,
    amount: Number(row.high_water_amount ?? row.baseline_amount),
    loanSignature: row.loan_signature,
    baselineAt: row.high_water_at ?? row.baseline_at,
  })));
}
