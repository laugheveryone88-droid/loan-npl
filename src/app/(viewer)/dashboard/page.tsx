import type { Metadata } from "next";

import { OverdueDashboard } from "@/features/workbook-data/components/overdue-dashboard";

export const metadata: Metadata = {
  title: "Самбарын дэлгэц",
  description: "Google Sheets мэдээллийн зөвхөн харах зориулалттай Loan NPL дашбоард.",
};

export default function DashboardViewerPage() {
  return <OverdueDashboard viewOnly />;
}
