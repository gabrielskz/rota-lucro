"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import Link from "next/link";
import { calculateFuelCost, parseDecimal, roundMoney, summarize } from "@/lib/calculations";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { DailyEntry, EntryForm } from "@/lib/types";
import { ChartIcon, CheckIcon, ChevronIcon, FuelIcon, LogInIcon, PlusIcon, RoadIcon, RouteIcon, TrashIcon, WalletIcon, XIcon } from "./icons";

const STORAGE_KEY = "rota-lucro-entries";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

function localDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function monthLabel(value: string) {
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) return "Este mês";
  const label = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function displayDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
}

function readLocalEntries(): DailyEntry[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as DailyEntry[];
  } catch {
    return [];
  }
}

function writeLocalEntries(entries: DailyEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

const initialForm = (): EntryForm => ({
  entryDate: localDate(),
  grossRevenue: "",
  kilometers: "",
  fuelEfficiency: "10",
  fuelPrice: "",
});

export function Dashboard() {
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [form, setForm] = useState<EntryForm>(initialForm);
  const [selectedMonth, setSelectedMonth] = useState(localDate().slice(0, 7));
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    let active = true;

    async function initialize() {
      if (!supabase) {
        if (active) {
          setEntries(readLocalEntries());
          setLoading(false);
        }
        return;
      }

      const { data, error } = await supabase.auth.getSession();
      if (!active) return;
      if (error) showToast("Não foi possível restaurar seu login.");
      setSession(data.session);
      if (data.session) await loadRemoteEntries(data.session.user.id);
      else setEntries(readLocalEntries());
      setLoading(false);
    }

    void initialize();
    const authSubscription = supabase?.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) void loadRemoteEntries(nextSession.user.id);
      else setEntries(readLocalEntries());
    });

    return () => {
      active = false;
      authSubscription?.data.subscription.unsubscribe();
    };
  }, []);

  async function loadRemoteEntries(userId: string) {
    if (!supabase) return;
    const localEntries = readLocalEntries();
    if (localEntries.length > 0) {
      const entriesToSync = localEntries.map((entry) => ({ ...entry, user_id: userId }));
      const { error: syncError } = await supabase.from("daily_entries").upsert(entriesToSync);
      if (!syncError) localStorage.removeItem(STORAGE_KEY);
    }
    const { data, error } = await supabase.from("daily_entries").select("*").eq("user_id", userId).order("entry_date", { ascending: false });
    if (error) {
      showToast("Não foi possível carregar os dados da nuvem.");
      return;
    }
    setEntries((data || []) as DailyEntry[]);
  }

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 3000);
  }

  const preview = useMemo(() => {
    const kilometers = parseDecimal(form.kilometers);
    const efficiency = parseDecimal(form.fuelEfficiency);
    const fuelPrice = parseDecimal(form.fuelPrice);
    const gross = parseDecimal(form.grossRevenue);
    const fuel = roundMoney(calculateFuelCost(kilometers, efficiency, fuelPrice));
    return { fuel, profit: roundMoney(gross - fuel), liters: efficiency > 0 ? kilometers / efficiency : 0 };
  }, [form]);

  const monthEntries = useMemo(
    () => entries.filter((entry) => entry.entry_date.startsWith(selectedMonth)).sort((a, b) => b.entry_date.localeCompare(a.entry_date)),
    [entries, selectedMonth],
  );
  const totals = useMemo(() => summarize(monthEntries), [monthEntries]);
  const chartTotal = Math.max(0, totals.fuel) + Math.max(0, totals.profit);
  const fuelPercent = chartTotal > 0 ? (Math.max(0, totals.fuel) / chartTotal) * 100 : 0;
  const profitPercent = chartTotal > 0 ? 100 - fuelPercent : 0;

  async function submitEntry(event: FormEvent) {
    event.preventDefault();
    const gross = parseDecimal(form.grossRevenue);
    const kilometers = parseDecimal(form.kilometers);
    const efficiency = parseDecimal(form.fuelEfficiency);
    const fuelPrice = parseDecimal(form.fuelPrice);

    if (!form.entryDate || gross < 0 || kilometers <= 0 || efficiency <= 0 || fuelPrice <= 0) {
      showToast("Confira os campos antes de salvar.");
      return;
    }

    const entry: DailyEntry = {
      id: crypto.randomUUID(),
      ...(session ? { user_id: session.user.id } : {}),
      entry_date: form.entryDate,
      gross_revenue: roundMoney(gross),
      kilometers,
      fuel_efficiency: efficiency,
      fuel_price: fuelPrice,
      fuel_cost: preview.fuel,
      net_profit: preview.profit,
      created_at: new Date().toISOString(),
    };

    setSaving(true);
    if (supabase && session) {
      const { error } = await supabase.from("daily_entries").insert(entry);
      if (error) {
        showToast("Erro ao salvar. Tente novamente.");
        setSaving(false);
        return;
      }
    } else {
      writeLocalEntries([entry, ...entries]);
    }

    setEntries((current) => [entry, ...current]);
    setSelectedMonth(form.entryDate.slice(0, 7));
    setForm((current) => ({ ...initialForm(), fuelEfficiency: current.fuelEfficiency, fuelPrice: current.fuelPrice }));
    setSaving(false);
    showToast("Dia salvo no relatório.");
  }

  async function deleteEntry(entry: DailyEntry) {
    if (supabase && session) {
      const { error } = await supabase.from("daily_entries").delete().eq("id", entry.id).eq("user_id", session.user.id);
      if (error) {
        showToast("Não foi possível excluir o lançamento.");
        return;
      }
    }
    const next = entries.filter((item) => item.id !== entry.id);
    setEntries(next);
    if (!session) writeLocalEntries(next);
    showToast("Lançamento excluído.");
  }

  async function signOut() {
    await supabase?.auth.signOut();
    showToast("Você saiu da conta.");
  }

  return (
    <main className="min-h-screen pb-14">
      <header className="border-b border-white/[0.07] bg-ink/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-3 sm:px-6 sm:py-4 lg:px-8">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <img
              src="/rota-lucro-icon.png"
              alt="Logo Rota Lucro"
              className="h-9 w-9 shrink-0 rounded-xl object-cover shadow-glow sm:h-10 sm:w-10"
            />
            <div className="min-w-0">
              <p className="truncate text-base font-bold leading-tight tracking-tight sm:text-lg">Rota Lucro</p>
              <p className="hidden truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40 min-[430px]:block sm:text-[11px] sm:tracking-[0.18em]">Seu corre, seus números</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <Link href="/relatorios" aria-label="Abrir relatórios" className="flex h-10 w-10 items-center justify-center rounded-xl border border-lime/20 bg-lime/[0.07] text-sm font-semibold text-lime transition hover:bg-lime/[0.12] sm:h-auto sm:w-auto sm:gap-2 sm:px-3 sm:py-2.5">
              <ChartIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Relatórios</span>
            </Link>
            <button
              onClick={session ? signOut : () => setAuthOpen(true)}
              aria-label={session ? "Sair da conta" : "Entrar na conta"}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-sm font-semibold text-white/80 transition hover:border-white/20 hover:bg-white/[0.07] sm:h-auto sm:w-auto sm:gap-2 sm:px-3 sm:py-2.5"
            >
              <span className={`hidden h-2 w-2 rounded-full sm:block ${session ? "bg-lime" : "bg-amber-400"}`} />
              <span className="hidden sm:inline">{session ? session.user.email : isSupabaseConfigured ? "Entrar" : "Modo local"}</span>
              <LogInIcon className="h-4 w-4 sm:hidden" />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-col overflow-x-clip px-3 pt-3 sm:px-6 sm:pt-4 lg:px-8 lg:pt-8">
        <section className="order-2 mb-7 hidden flex-col justify-between gap-5 lg:order-1 lg:flex lg:flex-row lg:items-end">
          <div className="animate-enter">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-lime">Visão geral</p>
            <h1 className="max-w-2xl text-3xl font-bold tracking-[-0.04em] sm:text-4xl">Quanto o seu dia realmente rendeu?</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/45">Registre a rota, desconte o combustível e acompanhe o que ficou no bolso.</p>
          </div>
          <label className="w-full sm:w-auto">
            <span className="sr-only">Mês do relatório</span>
            <input className="field min-w-48 text-sm font-semibold" type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} />
          </label>
        </section>

        <section className="order-3 mt-4 grid min-w-0 gap-4 lg:order-2 lg:mt-0 lg:grid-cols-[1.45fr_0.8fr]">
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <article className="card relative overflow-hidden rounded-3xl p-6 sm:col-span-2 sm:p-7">
              <div className="absolute -right-12 -top-16 h-52 w-52 rounded-full bg-lime/10 blur-3xl" />
              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-white/45">Lucro líquido em {monthLabel(selectedMonth)}</p>
                  <p className={`mt-3 text-4xl font-bold tracking-[-0.05em] sm:text-5xl ${totals.profit < 0 ? "text-red-400" : "text-lime"}`}>{money.format(totals.profit)}</p>
                  <p className="mt-3 text-xs text-white/35">Faturamento menos o custo estimado de combustível</p>
                </div>
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-lime text-ink"><WalletIcon className="h-6 w-6" /></span>
              </div>
            </article>
            <MetricCard label="Faturamento bruto" value={money.format(totals.gross)} icon={<WalletIcon className="h-5 w-5" />} />
            <MetricCard label="Gasto com gasolina" value={money.format(totals.fuel)} icon={<FuelIcon className="h-5 w-5" />} accent="orange" />
            <MetricCard label="Distância rodada" value={`${number.format(totals.kilometers)} km`} icon={<RoadIcon className="h-5 w-5" />} />
            <MetricCard label="Dias trabalhados" value={`${monthEntries.length} ${monthEntries.length === 1 ? "dia" : "dias"}`} icon={<RouteIcon className="h-5 w-5" />} />
          </div>

          <article className="card flex min-h-80 flex-col rounded-3xl p-6 sm:p-7">
            <div>
              <p className="text-sm font-semibold">Gasto x lucro</p>
              <p className="mt-1 text-xs text-white/35">Distribuição do faturamento no mês</p>
            </div>
            <div className="my-auto flex flex-col items-center justify-center gap-6 py-6 sm:flex-row lg:flex-col">
              <div
                className="relative grid h-44 w-44 place-items-center rounded-full"
                style={{ background: chartTotal > 0 ? `conic-gradient(#c8f135 0 ${profitPercent}%, #ff985b ${profitPercent}% 100%)` : "rgba(255,255,255,.06)" }}
                role="img"
                aria-label={`${profitPercent.toFixed(0)}% de lucro e ${fuelPercent.toFixed(0)}% de gasto`}
              >
                <div className="grid h-[124px] w-[124px] place-items-center rounded-full bg-surface text-center shadow-xl">
                  <div><p className="text-2xl font-bold">{chartTotal > 0 ? `${profitPercent.toFixed(0)}%` : "—"}</p><p className="mt-0.5 text-[10px] uppercase tracking-wider text-white/35">é lucro</p></div>
                </div>
              </div>
              <div className="grid w-full grid-cols-2 gap-3">
                <ChartLegend color="bg-lime" label="Lucro" value={profitPercent} />
                <ChartLegend color="bg-[#ff985b]" label="Gasolina" value={fuelPercent} />
              </div>
            </div>
            {totals.profit < 0 && <p className="rounded-xl bg-red-400/10 px-3 py-2 text-center text-xs text-red-300">O custo de combustível superou o faturamento neste período.</p>}
          </article>
        </section>

        <section className="order-1 grid min-w-0 items-start gap-4 lg:order-3 lg:mt-4 lg:grid-cols-[0.85fr_1.4fr]">
          <form onSubmit={submitEntry} className="card w-full min-w-0 max-w-full overflow-hidden rounded-3xl p-4 sm:p-7 lg:sticky lg:top-5">
            <div className="mb-6 flex items-center justify-between">
              <div><p className="text-lg font-bold">Registrar um dia</p><p className="mt-1 text-xs text-white/35">Preencha os dados da sua jornada</p></div>
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-lime/10 text-lime"><PlusIcon className="h-5 w-5" /></span>
            </div>
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <InputField label="Data" type="date" value={form.entryDate} onChange={(value) => setForm({ ...form, entryDate: value })} />
              <InputField label="Valor bruto" prefix="R$" placeholder="350,00" value={form.grossRevenue} onChange={(value) => setForm({ ...form, grossRevenue: value })} />
              <InputField label="Km rodados" suffix="km" placeholder="180" value={form.kilometers} onChange={(value) => setForm({ ...form, kilometers: value })} />
              <InputField label="Média do carro" suffix="km/L" placeholder="10" value={form.fuelEfficiency} onChange={(value) => setForm({ ...form, fuelEfficiency: value })} />
              <InputField label="Preço da gasolina" prefix="R$" placeholder="5,89" value={form.fuelPrice} onChange={(value) => setForm({ ...form, fuelPrice: value })} className="sm:col-span-2 lg:col-span-1 xl:col-span-2" />
            </div>
            <div className="my-5 min-w-0 rounded-2xl border border-lime/15 bg-lime/[0.055] p-4">
              <div className="flex min-w-0 items-center justify-between gap-3 text-sm"><span className="min-w-0 truncate text-white/45">Combustível ({number.format(preview.liters)} L)</span><strong className="shrink-0 whitespace-nowrap text-[#ffad7a]">− {money.format(preview.fuel)}</strong></div>
              <div className="my-3 h-px bg-white/[0.07]" />
              <div className="flex min-w-0 items-center justify-between gap-3"><span className="min-w-0 truncate font-semibold">Lucro estimado</span><strong className={`shrink-0 whitespace-nowrap text-lg sm:text-xl ${preview.profit < 0 ? "text-red-400" : "text-lime"}`}>{money.format(preview.profit)}</strong></div>
            </div>
            <button disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-lime px-4 py-4 text-sm font-bold text-ink transition hover:bg-[#d7fa5a] disabled:cursor-wait disabled:opacity-60">
              {saving ? "Salvando..." : "Salvar no relatório"}<ChevronIcon className="h-4 w-4" />
            </button>
            <p className="mt-3 text-center text-[11px] text-white/25">Cálculo: (km ÷ média) × preço da gasolina</p>
          </form>

          <article className="card overflow-hidden rounded-3xl">
            <div className="flex items-center justify-between gap-4 border-b border-white/[0.07] px-5 py-5 sm:px-7">
              <div><p className="text-lg font-bold">Relatório diário</p><p className="mt-1 text-xs text-white/35">{monthLabel(selectedMonth)} · {monthEntries.length} lançamentos</p></div>
              <label className="w-36 shrink-0 lg:hidden">
                <span className="sr-only">Mês do relatório</span>
                <input className="field px-3 py-2 text-xs font-semibold" type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} />
              </label>
            </div>
            {loading ? (
              <div className="grid min-h-72 place-items-center text-sm text-white/35">Carregando seus números...</div>
            ) : monthEntries.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="divide-y divide-white/[0.06]">
                {monthEntries.map((entry) => <EntryRow key={entry.id} entry={entry} onDelete={() => void deleteEntry(entry)} />)}
              </div>
            )}
          </article>
        </section>
      </div>

      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} onSuccess={() => { setAuthOpen(false); showToast("Conta conectada com sucesso."); }} />}
      {toast && <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-2xl border border-white/10 bg-cream px-4 py-3 text-sm font-semibold text-ink shadow-2xl"><CheckIcon className="h-4 w-4" />{toast}</div>}
    </main>
  );
}

function MetricCard({ label, value, icon, accent = "lime" }: { label: string; value: string; icon: React.ReactNode; accent?: "lime" | "orange" }) {
  return <article className="card rounded-2xl p-5"><div className="flex items-center justify-between"><p className="text-xs font-medium text-white/40">{label}</p><span className={accent === "orange" ? "text-[#ff985b]" : "text-lime"}>{icon}</span></div><p className="mt-3 text-2xl font-bold tracking-tight">{value}</p></article>;
}

function ChartLegend({ color, label, value }: { color: string; label: string; value: number }) {
  return <div className="rounded-xl bg-white/[0.035] p-3"><div className="flex items-center gap-2 text-[11px] text-white/40"><span className={`h-2 w-2 rounded-full ${color}`} />{label}</div><p className="mt-1.5 text-lg font-bold">{value.toFixed(0)}%</p></div>;
}

function InputField({ label, value, onChange, placeholder, prefix, suffix, type = "text", className = "" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; prefix?: string; suffix?: string; type?: string; className?: string }) {
  if (type === "date") {
    const [year, month, day] = value.split("-");
    const formattedDate = year && month && day ? `${day}/${month}/${year}` : "Selecione a data";

    return <label className={`min-w-0 ${className}`}><span className="mb-2 block text-xs font-semibold text-white/55">{label}</span><div className="relative min-w-0"><div className="field flex h-12 items-center text-sm"><span>{formattedDate}</span></div><input className="date-picker-input absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0" type="date" value={value} onChange={(event) => onChange(event.target.value)} aria-label={label} required /></div></label>;
  }

  return <label className={`min-w-0 ${className}`}><span className="mb-2 block text-xs font-semibold text-white/55">{label}</span><div className="relative min-w-0">{prefix && <span className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-sm font-semibold text-white/35">{prefix}</span>}<input className="field min-w-0 text-sm" style={{ paddingLeft: prefix ? "3.25rem" : undefined, paddingRight: suffix ? "4rem" : undefined }} type={type} inputMode={type === "text" ? "decimal" : undefined} placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} required />{suffix && <span className="pointer-events-none absolute right-4 top-1/2 z-10 -translate-y-1/2 text-xs font-semibold text-white/35">{suffix}</span>}</div></label>;
}

function EntryRow({ entry, onDelete }: { entry: DailyEntry; onDelete: () => void }) {
  return <div className="group px-5 py-5 transition hover:bg-white/[0.018] sm:px-7"><div className="flex items-start justify-between gap-4"><div><p className="font-semibold">{displayDate(entry.entry_date)}</p><p className="mt-1.5 text-xs text-white/35">{number.format(entry.kilometers)} km · {number.format(entry.fuel_efficiency)} km/L · gasolina {money.format(entry.fuel_price)}</p></div><button onClick={onDelete} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white/25 transition hover:bg-red-400/10 hover:text-red-300" aria-label={`Excluir lançamento de ${displayDate(entry.entry_date)}`}><TrashIcon className="h-4 w-4" /></button></div><div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-white/[0.025] p-3 text-center"><EntryValue label="Bruto" value={money.format(entry.gross_revenue)} /><EntryValue label="Gasolina" value={`− ${money.format(entry.fuel_cost)}`} color="text-[#ffad7a]" /><EntryValue label="Lucro" value={money.format(entry.net_profit)} color={entry.net_profit < 0 ? "text-red-400" : "text-lime"} /></div></div>;
}

function EntryValue({ label, value, color = "text-white" }: { label: string; value: string; color?: string }) {
  return <div><p className="text-[9px] font-semibold uppercase tracking-wider text-white/25">{label}</p><p className={`mt-1 text-xs font-bold sm:text-sm ${color}`}>{value}</p></div>;
}

function EmptyState() {
  return <div className="grid min-h-72 place-items-center px-6 text-center"><div><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white/[0.04] text-white/25"><RoadIcon className="h-7 w-7" /></span><p className="mt-4 font-semibold">Nenhum dia registrado</p><p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-white/35">Preencha sua jornada ao lado para começar o relatório deste mês.</p></div></div>;
}

function AuthModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);

  async function authenticate(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setWorking(true);
    setMessage("");
    const result = mode === "signin" ? await supabase.auth.signInWithPassword({ email, password }) : await supabase.auth.signUp({ email, password });
    setWorking(false);
    if (result.error) { setMessage(result.error.message); return; }
    if (mode === "signup" && !result.data.session) { setMessage("Confira seu e-mail para confirmar o cadastro."); return; }
    onSuccess();
  }

  return <div className="fixed inset-0 z-40 grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><div className="card w-full max-w-md rounded-3xl p-6 shadow-2xl sm:p-8"><div className="flex items-start justify-between"><div><p className="text-xl font-bold">{mode === "signin" ? "Entrar na sua conta" : "Criar sua conta"}</p><p className="mt-2 text-sm leading-5 text-white/40">Acesse seus relatórios em qualquer celular.</p></div><button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-xl text-white/40 hover:bg-white/[0.06] hover:text-white" aria-label="Fechar"><XIcon className="h-5 w-5" /></button></div><form onSubmit={authenticate} className="mt-6 space-y-4"><InputField label="E-mail" type="email" value={email} onChange={setEmail} placeholder="voce@email.com" /><InputField label="Senha" type="password" value={password} onChange={setPassword} placeholder="Mínimo de 6 caracteres" />{message && <p className="rounded-xl bg-white/[0.05] px-3 py-2 text-xs leading-5 text-white/60">{message}</p>}<button disabled={working} className="w-full rounded-2xl bg-lime px-4 py-3.5 text-sm font-bold text-ink disabled:opacity-60">{working ? "Aguarde..." : mode === "signin" ? "Entrar" : "Cadastrar"}</button></form><button onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMessage(""); }} className="mt-4 w-full text-center text-xs font-semibold text-white/45 hover:text-lime">{mode === "signin" ? "Ainda não tenho conta" : "Já tenho uma conta"}</button></div></div>;
}
