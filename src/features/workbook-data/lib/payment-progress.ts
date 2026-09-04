import type { OverdueLoanRecord, PaymentProgressData } from "@/features/workbook-data/types";

export type CifPaymentTotal = {
  cif: string;
  amount: number | null;
  loanSignature: string;
};

export type PaymentBaseline = {
  cif: string;
  amount: number;
  loanSignature: string;
  baselineAt: string;
};

export function groupCifPaymentTotals(records: OverdueLoanRecord[]): CifPaymentTotal[] {
  const groups = new Map<string, OverdueLoanRecord[]>();
  for (const record of records) {
    if (!record.normalizedCustomerCif) continue;
    const group = groups.get(record.normalizedCustomerCif) ?? [];
    group.push(record);
    groups.set(record.normalizedCustomerCif, group);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([cif, rows]) => {
    let cents = 0;
    let valid = true;
    for (const row of rows) {
      const value = row.totalPaymentAmount;
      if (value === null || !Number.isFinite(value) || value < 0) {
        valid = false;
      } else {
        cents += Math.round(value * 100);
        if (!Number.isSafeInteger(cents)) valid = false;
      }
    }
    // Row position, balance, overdue days, and status can change without changing the loan.
    // Without a loan ID, a changed multiset of origination details needs review;
    // deleting a loan must never look like a repayment of its entire balance.
    const loanSignature = JSON.stringify(rows.map((row) => JSON.stringify([
      row.disbursedDate, row.originalAmount, row.maturityDate,
    ])).sort());
    return { cif, amount: valid ? cents / 100 : null, loanSignature };
  });
}

export function calculatePaymentProgress(
  current: CifPaymentTotal[],
  baselines: PaymentBaseline[],
): PaymentProgressData {
  const byCif = new Map(baselines.map((baseline) => [baseline.cif, baseline]));
  return {
    status: "ready",
    entries: current.map((customer) => {
      const baseline = byCif.get(customer.cif);
      const issue = customer.amount === null
        ? "missing-amount" as const
        : !baseline
          ? "missing-baseline" as const
          : customer.loanSignature !== baseline.loanSignature
            ? "changed-loans" as const
            : null;
      return {
        cif: customer.cif,
        baselineAmount: baseline?.amount ?? null,
        currentAmount: customer.amount,
        baselineAt: baseline?.baselineAt ?? null,
        amount: issue || !baseline || customer.amount === null ? null
          : Math.max(0, Math.round(baseline.amount * 100) - Math.round(customer.amount * 100)) / 100,
        issue,
      };
    }),
  };
}

export function summarizePaymentProgress(progress: PaymentProgressData | null, records: OverdueLoanRecord[]) {
  if (!progress || progress.status !== "ready") return null;
  const cifs = new Set(records.map((record) => record.normalizedCustomerCif).filter(Boolean));
  const entries = progress.entries.filter((entry) => cifs.has(entry.cif));
  return {
    amount: entries.reduce((total, entry) => total + Math.round((entry.amount ?? 0) * 100), 0) / 100,
    customerCount: entries.filter((entry) => (entry.amount ?? 0) > 0).length,
    excludedCustomers: entries.filter((entry) => entry.issue !== null).length,
    missingCifRows: records.filter((record) => !record.normalizedCustomerCif).length,
  };
}
