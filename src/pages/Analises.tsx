import { useMemo, useState } from "react";
import { addMonths, format, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bar, CartesianGrid, Cell, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownRight, ArrowUpRight, Minus, Search, X } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useCategories } from "@/hooks/useCategories";
import { useAccounts } from "@/hooks/useAccounts";
import { useSpendAnalysis, type AnalysisFilters } from "@/hooks/useSpendAnalysis";
import { byCategory, matchesSearch, monthWindow, summarize, totalsByMonth, trendOf } from "@/lib/spendAnalysis";
import { formatIsoDateBR } from "@/lib/cardCycle";

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const fmtK = (v: number) => new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(v);
const monthLabel = (ym: string, long = false) => {
  const [y, m] = ym.split("-").map(Number);
  return format(new Date(y, m - 1, 1), long ? "MMMM yyyy" : "MMM/yy", { locale: ptBR }).replace(/^\w/, (c) => c.toUpperCase());
};
const pct = (v: number | null) => (v === null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(1).replace(".", ",")}%`);

export default function Analises() {
  const currentMonth = format(new Date(), "yyyy-MM");
  const monthOptions = useMemo(() => Array.from({ length: 24 }, (_, i) => format(addMonths(startOfMonth(new Date()), -i), "yyyy-MM")), []);
  const [filters, setFilters] = useState<AnalysisFilters>({ type: "expense", status: "all", categoryId: "all", accountId: "all", month: currentMonth, period: 6 });
  const [search, setSearch] = useState("");
  const set = (p: Partial<AnalysisFilters>) => setFilters((f) => ({ ...f, ...p }));

  const { data: categories = [] } = useCategories();
  const { data: accounts = [] } = useAccounts();
  const { data: rows = [], isLoading, error } = useSpendAnalysis(filters);

  const months = useMemo(() => monthWindow(filters.month, filters.period), [filters.month, filters.period]);
  const visible = useMemo(() => rows.filter((r) => matchesSearch(r, search)), [rows, search]);
  const points = useMemo(() => totalsByMonth(visible, months), [visible, months]);
  const summary = useMemo(() => summarize(points), [points]);
  const trend = useMemo(() => trendOf(points.map((p) => p.total)), [points]);
  const cats = useMemo(() => byCategory(visible, months), [visible, months]);
  const monthRows = useMemo(() => visible.filter((r) => r.date.slice(0, 7) === filters.month).sort((a, b) => b.amount - a.amount), [visible, filters.month]);
  const [showAll, setShowAll] = useState(false);

  const isExpense = filters.type === "expense";
  // Para despesa, subir é ruim (vermelho); para receita, subir é bom (verde).
  const tone = (v: number | null) => (v === null || Math.abs(v) < 0.05 ? "text-muted-foreground" : (v > 0) === isExpense ? "text-destructive" : "text-emerald-600");
  const chartData = points.map((p, i) => ({ ...p, label: monthLabel(p.month), trend: trend.fitted[i], selected: p.month === filters.month }));
  const TrendIcon = trend.direction === "up" ? ArrowUpRight : trend.direction === "down" ? ArrowDownRight : Minus;
  const typeCats = categories.filter((c: any) => c.is_active !== false && (!c.transaction_nature || c.transaction_nature === filters.type));

  return (
    <AppLayout>
      <PageHeader title="Análises por Despesas ou Receitas" description="Evolução mês a mês do que foi filtrado: está subindo ou caindo?" />

      {/* Filtros */}
      <Card className="mb-3">
        <CardContent className="p-3 grid gap-3 md:grid-cols-6">
          <div className="md:col-span-2 flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <p className="text-[11px] text-muted-foreground">Tipo</p>
              <ToggleGroup type="single" value={filters.type} onValueChange={(v) => v && set({ type: v as AnalysisFilters["type"], categoryId: "all" })} className="justify-start">
                <ToggleGroupItem value="expense" className="h-8 text-xs">Despesas</ToggleGroupItem>
                <ToggleGroupItem value="income" className="h-8 text-xs">Receitas</ToggleGroupItem>
              </ToggleGroup>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] text-muted-foreground">Período</p>
              <ToggleGroup type="single" value={String(filters.period)} onValueChange={(v) => v && set({ period: Number(v) })} className="justify-start">
                <ToggleGroupItem value="3" className="h-8 text-xs">3 meses</ToggleGroupItem>
                <ToggleGroupItem value="6" className="h-8 text-xs">6 meses</ToggleGroupItem>
                <ToggleGroupItem value="12" className="h-8 text-xs">1 ano</ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-[11px] text-muted-foreground">Mês</p>
            <Select value={filters.month} onValueChange={(v) => set({ month: v })}>
              <SelectTrigger id="analise-mes" className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{monthOptions.map((m) => <SelectItem key={m} value={m}>{monthLabel(m, true)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <p className="text-[11px] text-muted-foreground">Status</p>
            <Select value={filters.status} onValueChange={(v) => set({ status: v as AnalysisFilters["status"] })}>
              <SelectTrigger id="analise-status" className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="paid">Realizado</SelectItem>
                <SelectItem value="planned">Previsto</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <p className="text-[11px] text-muted-foreground">Categoria</p>
            <Select value={filters.categoryId} onValueChange={(v) => set({ categoryId: v })}>
              <SelectTrigger id="analise-categoria" className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="__none">Sem categoria</SelectItem>
                {typeCats.sort((a: any, b: any) => a.name.localeCompare(b.name)).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <p className="text-[11px] text-muted-foreground">Conta</p>
            <Select value={filters.accountId} onValueChange={(v) => set({ accountId: v })}>
              <SelectTrigger id="analise-conta" className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="__none">Sem conta</SelectItem>
                {accounts.filter((a) => a.is_active).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-6 relative">
            <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
            <Input id="analise-busca" value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 pl-8 text-sm"
              placeholder="Buscar qualquer palavra: supermercado, posto, ifood, cartão, favorecido, valor…" />
            {search && <Button size="icon" variant="ghost" className="absolute right-1 top-0 h-8 w-8" onClick={() => setSearch("")} aria-label="Limpar busca"><X className="h-4 w-4" /></Button>}
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Card><CardContent className="py-10 text-center text-sm text-destructive">Não foi possível carregar a análise. Recarregue a página.</CardContent></Card>
      ) : isLoading ? (
        <Card><CardContent className="p-6"><div className="h-40 animate-pulse bg-muted rounded" /></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {/* Resumo */}
          <Card>
            <CardContent className="p-3 grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <p className="text-[11px] text-muted-foreground">{isExpense ? "Despesas" : "Receitas"} em {monthLabel(filters.month, true)} (fato)</p>
                <p className="text-lg font-semibold">{fmt(summary.current)}</p>
                <p className="text-[11px] text-muted-foreground">
                  {points[points.length - 1]?.count ?? 0} lançamento(s)
                  {(points[points.length - 1]?.forecast ?? 0) > 0 && <span className="text-sky-700 dark:text-sky-400"> · + {fmt(points[points.length - 1].forecast)} previsto</span>}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Vs. mês anterior</p>
                <p className={`text-lg font-semibold ${tone(summary.deltaPrev)}`}>{pct(summary.deltaPrev)}</p>
                <p className="text-[11px] text-muted-foreground">{summary.previous !== null ? fmt(summary.previous) : "—"}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Vs. média dos {filters.period - 1} meses anteriores</p>
                <p className={`text-lg font-semibold ${tone(summary.deltaAvg)}`}>{pct(summary.deltaAvg)}</p>
                <p className="text-[11px] text-muted-foreground">média {fmt(summary.average)}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Tendência no período</p>
                <p className={`text-lg font-semibold flex items-center gap-1 ${tone(trend.direction === "flat" ? 0 : trend.slope)}`}>
                  <TrendIcon className="h-5 w-5" />
                  {trend.direction === "up" ? "Subindo" : trend.direction === "down" ? "Caindo" : "Estável"}
                </p>
                <p className="text-[11px] text-muted-foreground">{trend.slopePct === null ? "—" : `${trend.slope > 0 ? "+" : ""}${fmt(trend.slope)}/mês (${pct(trend.slopePct)})`}</p>
              </div>
            </CardContent>
          </Card>

          {/* Evolução */}
          <Card>
            <CardHeader className="pb-0 pt-3"><CardTitle className="text-sm">Evolução mês a mês</CardTitle></CardHeader>
            <CardContent className="pt-1 pb-3">
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtK} width={44} />
                  <defs>
                    <pattern id="prevStripes" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                      <rect width="6" height="6" fill="hsl(199 89% 48% / 0.25)" />
                      <rect width="3" height="6" fill="hsl(199 89% 48% / 0.6)" />
                    </pattern>
                  </defs>
                  <Tooltip formatter={(v: number, n: string) => [fmt(v), n === "trend" ? "Tendência (fato)" : n === "forecast" ? "Previsão" : "Fato"]} />
                  {summary.average > 0 && <ReferenceLine y={summary.average} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" label={{ value: "média", fontSize: 10, position: "insideTopLeft" }} />}
                  <Bar dataKey="total" stackId="m" name="total">
                    {chartData.map((d) => <Cell key={d.month} fill={d.selected ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.35)"} />)}
                  </Bar>
                  <Bar dataKey="forecast" stackId="m" radius={[4, 4, 0, 0]} name="forecast" fill="url(#prevStripes)" />
                  <Line type="linear" dataKey="trend" stroke={trend.direction === "flat" ? "hsl(var(--muted-foreground))" : (trend.slope > 0) === isExpense ? "hsl(0 72% 50%)" : "hsl(152 60% 38%)"} strokeWidth={2} strokeDasharray="6 4" dot={false} name="trend" />
                </ComposedChart>
              </ResponsiveContainer>
              <p className="text-[11px] text-muted-foreground">Barra cheia: fato (mês selecionado mais escuro) · parte listrada azul: previsão · tracejado cinza: média do fato · linha colorida: tendência do fato.</p>
            </CardContent>
          </Card>

          <div className="grid gap-3 lg:grid-cols-2">
            {/* Por categoria */}
            <Card>
              <CardHeader className="pb-1 pt-3"><CardTitle className="text-sm">Por categoria: mês x média</CardTitle></CardHeader>
              <CardContent className="pb-3 overflow-x-auto">
                {cats.length === 0 ? <p className="text-sm text-muted-foreground">Nada encontrado com esses filtros.</p> : (
                  <table className="w-full text-sm min-w-[380px]">
                    <thead><tr className="text-xs text-muted-foreground border-b"><th className="text-left py-1 font-medium">Categoria</th><th className="text-right font-medium">Mês (fato)</th>{cats.some((c) => c.forecast > 0) && <th className="text-right font-medium">Previsto</th>}<th className="text-right font-medium">Média</th><th className="text-right font-medium">Variação</th></tr></thead>
                    <tbody>
                      {cats.slice(0, 15).map((c) => {
                        const v = c.average ? (c.delta / c.average) * 100 : null;
                        return (
                          <tr key={c.categoryId ?? "sem"} className={`border-b last:border-0 ${c.categoryId ? "cursor-pointer hover:bg-muted/50" : ""}`}
                            onClick={() => c.categoryId && set({ categoryId: c.categoryId })} title={c.categoryId ? "Filtrar por esta categoria" : undefined}>
                            <td className="py-1.5">{c.name}</td>
                            <td className="text-right font-mono text-xs">{fmt(c.current)}</td>
                            {cats.some((x) => x.forecast > 0) && <td className="text-right font-mono text-xs text-sky-700 dark:text-sky-400">{c.forecast ? fmt(c.forecast) : "—"}</td>}
                            <td className="text-right font-mono text-xs text-muted-foreground">{fmt(c.average)}</td>
                            <td className={`text-right text-xs ${tone(v ?? (c.delta ? Math.sign(c.delta) : 0))}`}>{c.delta > 0 ? "+" : ""}{fmt(c.delta)}{v !== null && <span className="text-[10px]"> ({pct(v)})</span>}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
                {filters.categoryId !== "all" && <Button size="sm" variant="ghost" className="h-7 text-xs mt-2" onClick={() => set({ categoryId: "all" })}>Ver todas as categorias</Button>}
              </CardContent>
            </Card>

            {/* Lançamentos do mês */}
            <Card>
              <CardHeader className="pb-1 pt-3"><CardTitle className="text-sm">Lançamentos de {monthLabel(filters.month, true)} ({monthRows.length})</CardTitle></CardHeader>
              <CardContent className="pb-3 overflow-x-auto">
                {monthRows.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum lançamento no mês com esses filtros.</p> : (
                  <table className="w-full text-sm min-w-[420px]">
                    <tbody>
                      {(showAll ? monthRows : monthRows.slice(0, 15)).map((r) => (
                        <tr key={r.id} className="border-b last:border-0">
                          <td className="py-1.5 text-xs text-muted-foreground whitespace-nowrap pr-2">{formatIsoDateBR(r.date).slice(0, 5)}</td>
                          <td className="py-1.5 min-w-0">
                            <span className="block truncate max-w-[220px]">{r.description}</span>
                            <span className="text-[11px] text-muted-foreground">{[r.categoryName, r.cardName || r.accountName].filter(Boolean).join(" · ")}</span>
                          </td>
                          <td className="text-right font-mono text-xs whitespace-nowrap">{fmt(r.amount)}</td>
                          <td className="text-right pl-2 whitespace-nowrap">
                            {r.forecast
                              ? <Badge variant="outline" className="text-[10px] border-sky-500 text-sky-700 dark:text-sky-400">Previsão</Badge>
                              : r.status === "planned" && <Badge variant="outline" className="text-[10px]">A pagar</Badge>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {monthRows.length > 15 && <Button size="sm" variant="ghost" className="h-7 text-xs mt-2" onClick={() => setShowAll((v) => !v)}>{showAll ? "Mostrar só os maiores" : `Mostrar todos (${monthRows.length})`}</Button>}
              </CardContent>
            </Card>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Fato = o que foi pago ou comprado (inclui compras já lançadas ainda a pagar). Previsão = estimativas (recorrências ou itens marcados como previsão), mostradas à parte e fora da média e da tendência.
            O mês de cada lançamento é o do vencimento (o mesmo critério de Movimentações); itens de cartão entram no mês do vencimento da fatura. Cancelados não entram.
          </p>
        </div>
      )}
    </AppLayout>
  );
}
