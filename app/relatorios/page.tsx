import type { Metadata } from "next";
import { MonthlyReports } from "@/components/monthly-reports";

export const metadata: Metadata = {
  title: "Relatórios mensais | Rota Lucro",
  description: "Consulte seus ganhos, despesas e lucro por mês.",
};

export default function ReportsPage() {
  return <MonthlyReports />;
}
