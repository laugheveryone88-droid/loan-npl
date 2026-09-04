import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNumber, maskIdentifier, maskPhone } from "@/features/workbook-data/lib/format";
import type { OverdueCustomerSummary } from "@/features/workbook-data/lib/overdue-customer-analysis";
import { isPaidStatus } from "@/features/workbook-data/lib/resolved-payments";
import type { OverdueLoanRecord } from "@/features/workbook-data/types";

function columnLetter(index: number) {
  let result = "";
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) {
    result = String.fromCharCode(65 + (value - 1) % 26) + result;
  }
  return result;
}

function SourceCell({ header, value, customer }: {
  header: string;
  value: unknown;
  customer: OverdueCustomerSummary | undefined;
}) {
  const normalized = header.normalize("NFKC").trim().toLocaleLowerCase("mn-MN");
  const text = String(value ?? "").trim();
  if (normalized.includes("cif") || normalized.includes("сиф")) {
    return <div className="flex min-w-40 flex-col items-start gap-1.5">
      <span className="font-mono">{maskIdentifier(text)}</span>
      <Badge variant="secondary" className="font-mono tabular-nums">
        {formatNumber(customer?.loanCount ?? 1)} зээлтэй
      </Badge>
    </div>;
  }
  if (normalized.includes("утас") || normalized.includes("phone")) {
    return <span className="font-mono">{maskPhone(text)}</span>;
  }
  if (normalized === "төлөв" && isPaidStatus(text)) {
    return <Badge variant="secondary">{text}</Badge>;
  }
  return <span className="whitespace-pre-wrap break-words">{text || "—"}</span>;
}

export function DetailedRowsTable({ records, columns, customerByRecord, page, pageSize }: {
  records: OverdueLoanRecord[];
  columns: string[];
  customerByRecord: Map<string, OverdueCustomerSummary>;
  page: number;
  pageSize: number;
}) {
  const start = (page - 1) * pageSize;
  return <div className="min-w-0 overflow-x-auto rounded-lg border">
    <Table className="min-w-max">
      <TableHeader>
        <TableRow>
          {columns.map((header, index) => <TableHead key={index} className="min-w-36">
            {columnLetter(index)} · {header}
          </TableHead>)}
        </TableRow>
      </TableHeader>
      <TableBody>
        {records.slice(start, start + pageSize).map((record) => <TableRow key={record.id}>
          {columns.map((header, index) => <TableCell key={index} className="max-w-72 align-top">
            <SourceCell header={header} value={record.sourceValues[index]} customer={customerByRecord.get(record.id)} />
          </TableCell>)}
        </TableRow>)}
        {records.length === 0 ? <TableRow>
          <TableCell colSpan={Math.max(columns.length, 1)} className="h-28 text-center text-muted-foreground">
            Сонгосон шүүлтүүрт тохирох мөр олдсонгүй.
          </TableCell>
        </TableRow> : null}
      </TableBody>
    </Table>
  </div>;
}
