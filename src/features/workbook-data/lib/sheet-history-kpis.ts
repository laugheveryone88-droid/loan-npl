import { analyzeOverdueCustomers } from "@/features/workbook-data/lib/overdue-customer-analysis";
import { summarizePaymentProgress } from "@/features/workbook-data/lib/payment-progress";
import { parseOverdueGoogleSheet } from "@/features/workbook-data/lib/parse-google-sheet";
import {
  summarizeResolvedPayments,
  summarizeUnpaidPayments,
} from "@/features/workbook-data/lib/resolved-payments";
import type {
  GoogleSheetsPayload,
  SheetHistoryKpiSummary,
} from "@/features/workbook-data/types";

export function summarizeSheetHistoryKpis(
  payloads: GoogleSheetsPayload[],
): SheetHistoryKpiSummary {
  let parsedSnapshotCount = 0;
  let uniqueCustomers = 0;
  let duplicatedCustomers = 0;
  let unpaidCents = 0;
  let unpaidRows = 0;
  let unpaidMissingAmounts = 0;
  let resolvedCents = 0;
  let paidRows = 0;
  let resolvedMissingAmounts = 0;
  let paymentProgressCents = 0;
  let paymentProgressCustomerCount = 0;
  let paymentProgressExcludedCustomers = 0;
  let paymentProgressMissingCifRows = 0;
  let paymentProgressUnavailableSnapshots = 0;
  let paymentProgressAvailableSnapshots = 0;

  for (const payload of payloads) {
    try {
      const parsed = parseOverdueGoogleSheet(payload);
      const analysis = analyzeOverdueCustomers(parsed.records);
      const unpaid = summarizeUnpaidPayments(parsed.records);
      const resolved = summarizeResolvedPayments(parsed.records);
      const progress = summarizePaymentProgress(parsed.paymentProgress, parsed.records);

      parsedSnapshotCount += 1;
      uniqueCustomers += analysis.customers.length;
      duplicatedCustomers += analysis.customers.filter((customer) => customer.loanCount > 1).length;
      unpaidCents += Math.round(unpaid.amount * 100);
      unpaidRows += unpaid.unpaidRows;
      unpaidMissingAmounts += unpaid.missingAmounts;
      resolvedCents += Math.round(resolved.amount * 100);
      paidRows += resolved.paidRows;
      resolvedMissingAmounts += resolved.missingAmounts;

      if (progress) {
        paymentProgressAvailableSnapshots += 1;
        paymentProgressCents += Math.round(progress.amount * 100);
        paymentProgressCustomerCount += progress.customerCount;
        paymentProgressExcludedCustomers += progress.excludedCustomers;
        paymentProgressMissingCifRows += progress.missingCifRows;
      } else {
        paymentProgressUnavailableSnapshots += 1;
      }
    } catch {
      paymentProgressUnavailableSnapshots += 1;
    }
  }

  return {
    snapshotCount: payloads.length,
    parsedSnapshotCount,
    uniqueCustomers,
    duplicatedCustomers,
    unpaidAmount: unpaidCents / 100,
    unpaidRows,
    unpaidMissingAmounts,
    resolvedAmount: resolvedCents / 100,
    paidRows,
    resolvedMissingAmounts,
    paymentProgressAmount:
      paymentProgressAvailableSnapshots > 0 ? paymentProgressCents / 100 : null,
    paymentProgressCustomerCount,
    paymentProgressExcludedCustomers,
    paymentProgressMissingCifRows,
    paymentProgressUnavailableSnapshots,
  };
}
