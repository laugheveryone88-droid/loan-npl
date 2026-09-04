import type { OverdueLoanRecord } from "@/features/workbook-data/types";

export type CustomerIdentityStatus =
  | "verified-cif"
  | "cif-name-conflict"
  | "missing-cif";

export type OverdueCustomerSummary = {
  key: string;
  customerCif: string | null;
  normalizedCustomerCif: string | null;
  normalizedPhone: string | null;
  phoneNumber: string | null;
  names: string[];
  records: OverdueLoanRecord[];
  loanCount: number;
  totalOriginalAmount: number;
  totalOutstandingAmount: number;
  totalPaymentAmount: number;
  totalClosingAmount: number;
  maximumDpd: number | null;
  identityStatus: CustomerIdentityStatus;
  hasPotentialDuplicateRows: boolean;
  potentialDuplicateExtraRows: number;
  hasSameNameOnOtherCifs: boolean;
};

export type OverdueCustomerAnalysis = {
  customers: OverdueCustomerSummary[];
  recordToCustomer: Map<string, OverdueCustomerSummary>;
  potentialDuplicateRecordIds: Set<string>;
  cifNameConflictCount: number;
  missingCifRowCount: number;
  potentialDuplicateGroupCount: number;
  potentialDuplicateExtraRowCount: number;
  sameNameDifferentCifCount: number;
};

function normalizeIdentityText(value: string | null) {
  return value
    ?.normalize("NFKC")
    .trim()
    .toLocaleLowerCase("mn-MN")
    .replace(/\s+/g, " ") ?? "";
}

function sumValues(records: OverdueLoanRecord[], selector: (record: OverdueLoanRecord) => number | null) {
  return records.reduce((total, record) => total + (selector(record) ?? 0), 0);
}

function duplicateFingerprint(record: OverdueLoanRecord) {
  return [
    record.normalizedCustomerCif ?? normalizeIdentityText(record.customerCif),
    normalizeIdentityText(record.customerName),
    record.normalizedPhone ?? normalizeIdentityText(record.phoneNumber),
    record.disbursedDate ?? "",
    record.repaymentDate ?? "",
    record.maturityDate ?? "",
    record.originalAmount ?? "",
    record.outstandingAmount ?? "",
    record.totalPaymentAmount ?? "",
    record.closingAmount ?? "",
    record.dashboardDpd ?? "",
  ].join("|");
}

export function analyzeOverdueCustomers(records: OverdueLoanRecord[]): OverdueCustomerAnalysis {
  const groups = new Map<string, OverdueLoanRecord[]>();
  const duplicateGroups = new Map<string, OverdueLoanRecord[]>();
  const cifsByName = new Map<string, Set<string>>();

  records.forEach((record) => {
    // A missing CIF must never be merged by name or phone. Keeping the source row
    // in the key prevents two unrelated people with the same name from collapsing.
    const key = record.normalizedCustomerCif
      ? `cif:${record.normalizedCustomerCif}`
      : `row:${record.id}`;
    const group = groups.get(key) ?? [];
    group.push(record);
    groups.set(key, group);

    const fingerprint = duplicateFingerprint(record);
    const duplicateGroup = duplicateGroups.get(fingerprint) ?? [];
    duplicateGroup.push(record);
    duplicateGroups.set(fingerprint, duplicateGroup);

    const normalizedName = normalizeIdentityText(record.customerName);
    if (normalizedName && record.normalizedCustomerCif) {
      const cifs = cifsByName.get(normalizedName) ?? new Set<string>();
      cifs.add(record.normalizedCustomerCif);
      cifsByName.set(normalizedName, cifs);
    }
  });

  const potentialDuplicateRecordIds = new Set<string>();
  let potentialDuplicateGroupCount = 0;
  let potentialDuplicateExtraRowCount = 0;
  duplicateGroups.forEach((group) => {
    if (group.length < 2) return;
    potentialDuplicateGroupCount += 1;
    potentialDuplicateExtraRowCount += group.length - 1;
    group.forEach((record) => potentialDuplicateRecordIds.add(record.id));
  });

  const sameNameDifferentCifNames = new Set(
    [...cifsByName.entries()]
      .filter(([, cifs]) => cifs.size > 1)
      .map(([name]) => name),
  );

  const recordToCustomer = new Map<string, OverdueCustomerSummary>();
  const customers = [...groups.entries()].map(([key, group]) => {
    const normalizedNames = new Map<string, string>();
    group.forEach((record) => {
      const normalized = normalizeIdentityText(record.customerName);
      if (normalized && !normalizedNames.has(normalized)) {
        normalizedNames.set(normalized, record.customerName?.trim() ?? normalized);
      }
    });
    const dpdValues = group
      .map((record) => record.dashboardDpd)
      .filter((value): value is number => value !== null);
    const duplicateExtraRows = [...duplicateGroups.values()]
      .filter((duplicateGroup) => duplicateGroup.length > 1)
      .reduce(
        (count, duplicateGroup) =>
          count + Math.max(duplicateGroup.filter((record) => group.includes(record)).length - 1, 0),
        0,
      );
    const normalizedCustomerCif = group[0]?.normalizedCustomerCif ?? null;
    const hasNameConflict = normalizedCustomerCif !== null && normalizedNames.size > 1;
    const summary: OverdueCustomerSummary = {
      key,
      customerCif: group.find((record) => record.customerCif)?.customerCif ?? null,
      normalizedCustomerCif,
      normalizedPhone: group.find((record) => record.normalizedPhone)?.normalizedPhone ?? null,
      phoneNumber: group.find((record) => record.phoneNumber)?.phoneNumber ?? null,
      names: [...normalizedNames.values()],
      records: group,
      loanCount: group.length,
      totalOriginalAmount: sumValues(group, (record) => record.originalAmount),
      totalOutstandingAmount: sumValues(group, (record) => record.outstandingAmount),
      totalPaymentAmount: sumValues(group, (record) => record.totalPaymentAmount),
      totalClosingAmount: sumValues(group, (record) => record.closingAmount),
      maximumDpd: dpdValues.length ? Math.max(...dpdValues) : null,
      identityStatus: normalizedCustomerCif === null
        ? "missing-cif"
        : hasNameConflict
          ? "cif-name-conflict"
          : "verified-cif",
      hasPotentialDuplicateRows: group.some((record) => potentialDuplicateRecordIds.has(record.id)),
      potentialDuplicateExtraRows: duplicateExtraRows,
      hasSameNameOnOtherCifs: [...normalizedNames.keys()].some((name) =>
        sameNameDifferentCifNames.has(name),
      ),
    };
    group.forEach((record) => recordToCustomer.set(record.id, summary));
    return summary;
  });

  return {
    customers,
    recordToCustomer,
    potentialDuplicateRecordIds,
    cifNameConflictCount: customers.filter(
      (customer) => customer.identityStatus === "cif-name-conflict",
    ).length,
    missingCifRowCount: records.filter((record) => !record.normalizedCustomerCif).length,
    potentialDuplicateGroupCount,
    potentialDuplicateExtraRowCount,
    sameNameDifferentCifCount: sameNameDifferentCifNames.size,
  };
}
