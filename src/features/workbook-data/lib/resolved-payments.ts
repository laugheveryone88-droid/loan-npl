import type { OverdueLoanRecord } from "@/features/workbook-data/types";

export function isPaidStatus(status: string | null | undefined) {
  return status?.normalize("NFKC").trim().toLocaleLowerCase("mn-MN") === "төлсөн";
}

// Recompute from the current source rows. Polls never increment an accumulator,
// and one paid loan must not cause other loans under the same CIF to be counted.
function summarizePayments(records: OverdueLoanRecord[], paid: boolean) {
  let amount = 0;
  let rowCount = 0;
  let missingAmounts = 0;
  for (const record of records) {
    if (isPaidStatus(record.collectionStatus) !== paid) continue;
    rowCount += 1;
    if (record.totalPaymentAmount === null || !Number.isFinite(record.totalPaymentAmount)) {
      missingAmounts += 1;
    } else {
      amount += record.totalPaymentAmount;
    }
  }
  return { amount, rowCount, missingAmounts };
}

export function summarizeResolvedPayments(records: OverdueLoanRecord[]) {
  const { amount, rowCount, missingAmounts } = summarizePayments(records, true);
  return { amount, paidRows: rowCount, missingAmounts };
}

export function summarizeUnpaidPayments(records: OverdueLoanRecord[]) {
  const { amount, rowCount, missingAmounts } = summarizePayments(records, false);
  return { amount, unpaidRows: rowCount, missingAmounts };
}
