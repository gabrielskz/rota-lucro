export type DailyEntry = {
  id: string;
  user_id?: string;
  entry_date: string;
  gross_revenue: number;
  kilometers: number;
  fuel_efficiency: number;
  fuel_price: number;
  fuel_cost: number;
  net_profit: number;
  created_at: string;
};

export type EntryForm = {
  entryDate: string;
  grossRevenue: string;
  kilometers: string;
  fuelEfficiency: string;
  fuelPrice: string;
};
