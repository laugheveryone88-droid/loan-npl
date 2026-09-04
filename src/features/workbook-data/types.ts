export type GoogleSheetTab = {
  title: string;
  values: unknown[][];
};

export type GoogleSheetsPayload = {
  spreadsheetTitle: string;
  sheets: GoogleSheetTab[];
  paymentProgress?: PaymentProgressData;
};

export type PaymentProgressEntry = {
  cif: string;
  baselineAmount: number | null;
  currentAmount: number | null;
  amount: number | null;
  baselineAt: string | null;
  issue: "missing-amount" | "changed-loans" | "missing-baseline" | null;
};

export type PaymentProgressData = {
  status: "ready" | "unavailable";
  entries: PaymentProgressEntry[];
};

export type SheetSnapshotChangeSummary = {
  kind: "initial" | "data" | "columns" | "columns-and-data";
  addedColumns: string[];
  removedColumns: string[];
  rowCountDelta: number;
};

export type SheetHistoryEntry = {
  id: number;
  spreadsheetTitle: string;
  capturedAt: string;
  rowCount: number;
  columnCount: number;
  changeSummary: SheetSnapshotChangeSummary;
};

export type SheetHistorySnapshot = SheetHistoryEntry & {
  payload: GoogleSheetsPayload;
};

export type SheetHistoryKpiSummary = {
  snapshotCount: number;
  parsedSnapshotCount: number;
  uniqueCustomers: number;
  duplicatedCustomers: number;
  unpaidAmount: number;
  unpaidRows: number;
  unpaidMissingAmounts: number;
  resolvedAmount: number;
  paidRows: number;
  resolvedMissingAmounts: number;
  paymentProgressAmount: number | null;
  paymentProgressCustomerCount: number;
  paymentProgressExcludedCustomers: number;
  paymentProgressMissingCifRows: number;
  paymentProgressUnavailableSnapshots: number;
};

export type GoogleSheetSummary = {
  title: string;
  loadedAt: string;
  sheetCount: number;
  sourceRows: number;
  sheets: Array<{
    title: string;
    rowCount: number;
    columnCount: number;
    isDataSheet: boolean;
  }>;
};

export type DpdMeasurement = {
  label: string;
  value: number | null;
};

export type PaymentMeasurement = {
  label: string;
  value: number | null;
};

export type OverdueLoanRecord = {
  id: string;
  sourceSheet: string;
  sourceRow: number;
  sourceValues: unknown[];
  collectionStatus: string | null;
  customerCif: string | null;
  normalizedCustomerCif: string | null;
  customerName: string | null;
  phoneNumber: string | null;
  normalizedPhone: string | null;
  disbursedDate: string | null;
  repaymentDate: string | null;
  maturityDate: string | null;
  originalAmount: number | null;
  outstandingAmount: number | null;
  totalPaymentAmount: number | null;
  closingAmount: number | null;
  dpdMeasurements: DpdMeasurement[];
  dashboardDpd: number | null;
  paymentMeasurements: PaymentMeasurement[];
  latestDpd: number | null;
  previousDpd: number | null;
  dpdDelta: number | null;
  latestPayment: number | null;
  posStatus: string | null;
  repaymentStatus: string | null;
};

export type OverdueSheetData = {
  summary: GoogleSheetSummary;
  sourceColumns: string[];
  records: OverdueLoanRecord[];
  paymentProgress: PaymentProgressData | null;
};
