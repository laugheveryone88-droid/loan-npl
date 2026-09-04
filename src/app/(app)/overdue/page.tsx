import type { Metadata } from "next";

import { OverdueDashboard } from "@/features/workbook-data/components/overdue-dashboard";

export const metadata: Metadata = {
  title: "Хугацаа хэтрэлт",
};

export default function OverduePage() {
  return <OverdueDashboard />;
}
