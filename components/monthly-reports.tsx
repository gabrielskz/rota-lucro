"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Session } from "@supabase/supabase-js";
import { summarize } from "@/lib/calculations";
import { supabase } from "@/lib/supabase";
import type { DailyEntry } from "@/lib/types";
import { ChartIcon, FuelIcon, HomeIcon, RoadIcon, RouteIcon, WalletIcon } from "./icons";

const STORAGE_KEY = "rota-lucro-entries";
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

function currentMonth() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 7);
}

function readLocalEntries(): DailyEntry[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as DailyEntry[];
  } catch {
    return [];
  }
}

function monthLabel(value: string) {
  const [year, month] = value.split("-").map(Number);
  const label = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function dayLabel(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
}

export function MonthlyReports() {
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadEntries() {
      if (!supabase) {
        if (active) {
          setEntries(readLocalEntries());
          setLoading(false);
        }
        return;
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (!active) return;
      if (sessionError) setError("Não foi possível restaurar seu login.");
      setSession(sessionData.session);

      if (!sessionData.session) {
        setEntries(readLocalEntries());
        setLoading(false);
        return;
      }

      const { data, error: entriesError } = await supabase
        .from("daily_entries")
        .select("*")
        .eq("user_id", sessionData.session.user.id)
        .order("entry_date", { ascending: false });

      if (!active) return;
      if (entriesError) setError("Não foi possível carregar os relatórios.");
      else setEntries((data || []) as DailyEntry[]);
      setLoading(false);
    }

    void loadEntries();
    return () => { active = false; };
  }, []);

  const monthEntries = useMemo(
    () => entries.filter((entry) => entry.entry_date.startsWith(selectedMonth)).sort((a, b) => a.entry_date.localeCompare(b.entry_date)),
    [entries, selectedMonth],
  );
  const totals = useMemo(() => summarize(monthEntries), [monthEntries]);
  const days = monthEntries.length;
  const averageProfit = days > 0 ? totals.profit / days : 0;
  const profitPerKm = totals.kilometers > 0 ? totals.profit / totals.kilometers : 0;
  const fuelShare = totals.gross > 0 ? Math.min(100, Math.max(0, (totals.fuel / totals.gross) * 100)) : 0;
  const profitShare = totals.gross > 0 ? Math.min(100, Math.max(0, (totals.profit / totals.gross) * 100)) : 0;
  const maxDailyValue = Math.max(1, ...monthEntries.map((entry) => Math.max(entry.gross_revenue, entry.fuel_cost, Math.abs(entry.net_profit))));

  return (
    <main className="min-h-screen pb-14">
      <header className="border-b border-white/[0.07] bg-ink/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <img src="/rota-lucro-icon.png" alt="Logo Rota Lucro" className="h-10 w-10 rounded-xl object-cover shadow-glow" />
            <div><p className="text-lg font-bold leading-tight tracking-tight">Rota Lucro</p><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">Relatórios</p></div>
          </Link>
          <Link href="/" className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm font-semibold text-white/80 transition hover:bg-white/[0.08]">
            <HomeIcon className="h-4 w-4" /><span className="hidden sm:inline">Início</span>
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8 lg:pt-8">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-lime">Relatório mensal</p>
            <h1 className="text-3xl font-bold tracking-[-0.04em] sm:text-4xl">Seus números do mês</h1>
            <p className="mt-2 text-sm text-white/40">Acompanhe o resultado consolidado e o desempenho de cada dia.</p>
          </div>
          <label className="w-full sm:w-56"><span className="mb-2 block text-xs font-semibold text-white/50">Escolha o mês</span><input className="field text-sm font-semibold" type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} /></label>
        </section>

        {error && <p className="mt-5 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">{error}</p>}
        {loading ? <div className="mt-6 grid min-h-72 place-items-center text-sm text-white/40">Carregando relatório...</div> : (
          <>
            <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <ReportCard label="Faturamento bruto" value={money.format(totals.gross)} icon={<WalletIcon className="h-5 w-5" />} />
              <ReportCard label="Combustível" value={money.format(totals.fuel)} icon={<FuelIcon className="h-5 w-5" />} color="orange" />
              <ReportCard label="Lucro líquido" value={money.format(totals.profit)} icon={<ChartIcon className="h-5 w-5" />} color={totals.profit < 0 ? "red" : "lime"} />
              <ReportCard label="Quilômetros" value={`${number.format(totals.kilometers)} km`} icon={<RoadIcon className="h-5 w-5" />} />
            </section>

            <section className="mt-4 grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
              <article className="card rounded-3xl p-6">
                <p className="font-bold">Distribuição do faturamento</p><p className="mt-1 text-xs text-white/35">{monthLabel(selectedMonth)}</p>
                <div className="flex flex-col items-center gap-7 py-7 sm:flex-row sm:justify-center lg:flex-col">
                  <div className="grid h-48 w-48 place-items-center rounded-full" style={{ background: totals.gross > 0 ? `conic-gradient(#c8f135 0 ${profitShare}%, #ff985b ${profitShare}% ${profitShare + fuelShare}%, rgba(255,255,255,.06) ${profitShare + fuelShare}% 100%)` : "rgba(255,255,255,.06)" }}>
                    <div className="grid h-36 w-36 place-items-center rounded-full bg-surface text-center"><div><p className="text-3xl font-bold text-lime">{profitShare.toFixed(0)}%</p><p className="mt-1 text-[10px] uppercase tracking-wider text-white/35">margem de lucro</p></div></div>
                  </div>
                  <div className="grid w-full grid-cols-2 gap-3"><Legend label="Lucro" value={profitShare} color="bg-lime" /><Legend label="Gasolina" value={fuelShare} color="bg-[#ff985b]" /></div>
                </div>
              </article>

              <article className="card rounded-3xl p-6">
                <div className="flex items-start justify-between"><div><p className="font-bold">Desempenho diário</p><p className="mt-1 text-xs text-white/35">Lucro de cada dia trabalhado</p></div><RouteIcon className="h-5 w-5 text-lime" /></div>
                {monthEntries.length === 0 ? <EmptyMonth /> : <div className="mt-7 flex h-56 items-end gap-2 overflow-x-auto pb-1 scrollbar-none">{monthEntries.map((entry) => {
                  const height = Math.max(8, (Math.abs(entry.net_profit) / maxDailyValue) * 100);
                  return <div key={entry.id} className="flex h-full min-w-10 flex-1 flex-col items-center justify-end gap-2" title={`${dayLabel(entry.entry_date)}: ${money.format(entry.net_profit)}`}><span className={`w-full max-w-12 rounded-t-lg ${entry.net_profit < 0 ? "bg-red-400" : "bg-lime"}`} style={{ height: `${height}%` }} /><span className="text-[9px] text-white/35">{entry.entry_date.slice(8, 10)}</span></div>;
                })}</div>}
              </article>
            </section>

            <section className="mt-4 grid gap-4 sm:grid-cols-3">
              <SmallMetric label="Dias trabalhados" value={`${days} ${days === 1 ? "dia" : "dias"}`} />
              <SmallMetric label="Lucro médio por dia" value={money.format(averageProfit)} />
              <SmallMetric label="Lucro por quilômetro" value={money.format(profitPerKm)} />
            </section>

            <article className="card mt-4 overflow-hidden rounded-3xl">
              <div className="border-b border-white/[0.07] px-5 py-5 sm:px-7"><p className="text-lg font-bold">Detalhamento diário</p><p className="mt-1 text-xs text-white/35">Todos os lançamentos de {monthLabel(selectedMonth)}</p></div>
              {monthEntries.length === 0 ? <EmptyMonth /> : <div className="divide-y divide-white/[0.06]">{[...monthEntries].reverse().map((entry) => <DailyReportRow key={entry.id} entry={entry} />)}</div>}
            </article>
          </>
        )}
        <p className="mt-5 text-center text-[11px] text-white/25">{session ? `Relatório da conta ${session.user.email}` : "Relatório salvo neste dispositivo"}</p>
      </div>
    </main>
  );
}

function ReportCard({ label, value, icon, color = "white" }: { label: string; value: string; icon: React.ReactNode; color?: "white" | "lime" | "orange" | "red" }) {
  const colors = { white: "text-white", lime: "text-lime", orange: "text-[#ff985b]", red: "text-red-400" };
  return <article className="card rounded-2xl p-5"><div className="flex items-center justify-between text-xs text-white/40"><span>{label}</span><span className={colors[color]}>{icon}</span></div><p className={`mt-3 text-2xl font-bold ${colors[color]}`}>{value}</p></article>;
}

function Legend({ label, value, color }: { label: string; value: number; color: string }) {
  return <div className="rounded-xl bg-white/[0.035] p-3"><div className="flex items-center gap-2 text-[11px] text-white/40"><span className={`h-2 w-2 rounded-full ${color}`} />{label}</div><p className="mt-1 text-lg font-bold">{value.toFixed(0)}%</p></div>;
}

function SmallMetric({ label, value }: { label: string; value: string }) {
  return <div className="card rounded-2xl px-5 py-4"><p className="text-xs text-white/35">{label}</p><p className="mt-1.5 text-lg font-bold">{value}</p></div>;
}

function DailyReportRow({ entry }: { entry: DailyEntry }) {
  return <div className="px-5 py-5 sm:px-7"><div className="flex items-center justify-between gap-3"><div><p className="font-semibold capitalize">{dayLabel(entry.entry_date)}</p><p className="mt-1 text-xs text-white/35">{number.format(entry.kilometers)} km · {number.format(entry.fuel_efficiency)} km/L</p></div><p className={`text-base font-bold ${entry.net_profit < 0 ? "text-red-400" : "text-lime"}`}>{money.format(entry.net_profit)}</p></div><div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3"><span className="rounded-lg bg-white/[0.03] px-3 py-2 text-white/45">Bruto: <strong className="text-white/80">{money.format(entry.gross_revenue)}</strong></span><span className="rounded-lg bg-white/[0.03] px-3 py-2 text-white/45">Gasolina: <strong className="text-[#ffad7a]">{money.format(entry.fuel_cost)}</strong></span><span className="col-span-2 rounded-lg bg-white/[0.03] px-3 py-2 text-white/45 sm:col-span-1">Preço/L: <strong className="text-white/80">{money.format(entry.fuel_price)}</strong></span></div></div>;
}

function EmptyMonth() {
  return <div className="grid min-h-52 place-items-center px-5 text-center"><div><ChartIcon className="mx-auto h-8 w-8 text-white/20" /><p className="mt-3 font-semibold">Nenhum lançamento neste mês</p><p className="mt-1 text-sm text-white/35">Volte ao início para registrar um dia.</p></div></div>;
}
