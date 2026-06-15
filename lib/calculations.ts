import type { DailyEntry } from "./types";

export function parseDecimal(value: string) {
  const normalized = value.trim().replace(/\s/g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function calculateFuelCost(kilometers: number, efficiency: number, fuelPrice: number) {
  if (kilometers < 0 || efficiency <= 0 || fuelPrice < 0) return 0;
  return (kilometers / efficiency) * fuelPrice;
}

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function summarize(entries: DailyEntry[]) {
  return entries.reduce(
    (totals, entry) => ({
      gross: totals.gross + Number(entry.gross_revenue),
      fuel: totals.fuel + Number(entry.fuel_cost),
      profit: totals.profit + Number(entry.net_profit),
      kilometers: totals.kilometers + Number(entry.kilometers),
    }),
    { gross: 0, fuel: 0, profit: 0, kilometers: 0 },
  );
}
