import { TrendingDown } from "lucide-react";
import { MetricCard } from "@/features/workbook-data/components/dashboard-primitives";
import { formatMoney, formatNumber } from "@/features/workbook-data/lib/format";
import { summarizePaymentProgress } from "@/features/workbook-data/lib/payment-progress";
import type { OverdueLoanRecord, PaymentProgressData } from "@/features/workbook-data/types";

export function PaymentProgressMetric({ progress, records, historical = false }: {
  progress: PaymentProgressData | null;
  records: OverdueLoanRecord[];
  historical?: boolean;
}) {
  const summary = summarizePaymentProgress(progress, records);
  const needsReview = summary && (summary.excludedCustomers > 0 || summary.missingCifRows > 0);
  const description = !summary
    ? historical ? "Энэ хувилбарт төлбөрийн зөрүү хадгалагдаагүй." : "Суурь дүнг уншиж, хадгалж чадсангүй. Дахин шалгана."
    : needsReview
      ? `Нийлбэр бүрэн бус: ${formatNumber(summary.excludedCustomers)} CIF-ийн дүн эсвэл зээлийн мөрийг шалгана; CIF дутуу ${formatNumber(summary.missingCifRows)} мөр.`
      : `${historical ? "Тухайн үеийн" : "Хамгийн өндөр хадгалсан I дүнгээс буурсан"} зөрүү · ${formatNumber(summary.customerCount)} CIF.`;
  return <MetricCard
    title="Төлөгдөж байгаа"
    value={formatMoney(summary?.amount)}
    description={description}
    showDescription={historical}
    icon={TrendingDown}
    tone={!summary || needsReview ? "warning" : "success"}
  />;
}
