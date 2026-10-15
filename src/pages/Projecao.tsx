import { useEffect, useMemo, useState } from "react";
import { addMonths, format, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, CheckCircle2, Info, RotateCcw, Scissors } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useMonthProjection, type ProjectionView } from "@/hooks/useMonthProjection";
import { projectHorizon, projectMonth, suggestActions, type DayPoint, type Simulation, type Suggestion } from "@/lib/monthProjection";
import { formatIsoDateBR } from "@/lib/cardCycle";

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const fmtK = (v: number) => new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(v);
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const label = (d: Date) => format(d, "MMMM yyyy", { locale: ptBR }).replace(/^\w/, (c) => c.toUpperCase());

const LEVEL: Record<Suggestion["level"], { dot: string; icon: typeof AlertTriangle }> = {
  critical: { dot: "text-destructive", icon: AlertTriangle },
  warning: { dot: "text-amber-600", icon: AlertTriangle },
  info: { dot: "text-sky-600", icon: Info },
  positive: { dot: "text-emerald-600", icon: CheckCircle2 },
};

const CUT_OPTIONS = [0, 0.25, 0.5, 1];
const HORIZON = 3;
const emptySim: Required<Simulation> = { postponedTxIds: [], delayedIncomeIds: [], estimateCuts: {} };

function loadSim(key: string): Required<Simulation> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return emptySim;
    const s = JSON.parse(raw);
    return { postponedTxIds: s.postponedTxIds ?? [], delayedIncomeIds: s.delayedIncomeIds ?? [], estimateCuts: s.estimateCuts ?? {} };
  } catch { return emptySim; }
}

export default function Projecao() {
  const today = format(new Date(), "yyyy-MM-dd");
  const months = useMemo(() => Array.from({ length: HORIZON }, (_, i) => {
    const d = addMonths(startOfMonth(new Date()), i);
    return { value: format(d, "yyyy-MM"), label: label(d) };
  }), []);
  const [month, setMonth] = useState(months[1].value);
  const [view, setView] = useState<ProjectionView>("consolidated");
  const [useEstimate, setUseEstimate] = useState(false);
  const [showAllExp, setShowAllExp] = useState(false);

  // Simulação: só em memória (e lembrada neste navegador); nunca altera lançamentos.
  const simKey = `fh-projecao-sim-${view}-${month}`;
  const [sim, setSim] = useState<Required<Simulation>>(() => loadSim(simKey));
  useEffect(() => { setSim(loadSim(simKey)); }, [simKey]);
  useEffect(() => { try { localStorage.setItem(simKey, JSON.stringify(sim)); } catch { /* sem armazenamento */ } }, [simKey, sim]);

  const { data, isLoading, error } = useMonthProjection(view, today, HORIZON);
  const estimates = useMemo(() => data?.estimatesByMonth[month] ?? [], [data, month]);

  const base = useMemo(() => data && projectMonth({ ...data, month, today }), [data, month, today]);
  const proj = useMemo(() => data && projectMonth({ ...data, month, today, sim }), [data, month, today, sim]);
  const horizonRows = useMemo(() => data ? projectHorizon({ ...data, today, sim }, data.months, data.avgIncome) : [], [data, today, sim]);
  const suggestions = useMemo(() => data && proj
    ? suggestActions({ projection: proj, planned: data.planned, estimates, entityType: (id) => data.entityTypes[id] ?? null, today, avgIncome: data.avgIncome, useEstimate })
    : [], [data, proj, today, estimates, useEstimate]);

  const simActive = sim.postponedTxIds.length + sim.delayedIncomeIds.length + Object.values(sim.estimateCuts).filter((v) => v > 0).length;
  const toggle = (list: "postponedTxIds" | "delayedIncomeIds", id: string) =>
    setSim((s) => ({ ...s, [list]: s[list].includes(id) ? s[list].filter((x) => x !== id) : [...s[list], id] }));

  // Valores conforme a base escolhida (só lançado ou com estimativa).
  const pick = (p: NonNullable<typeof proj>) => ({
    start: useEstimate ? p.startWithEstimate : p.startBalance,
    expense: p.expense + (useEstimate ? p.estimate : 0),
    end: useEstimate ? p.endWithEstimate : p.endLaunched,
    worst: useEstimate ? p.worstWithEstimate : p.worstLaunched,
  });

  const chartData = useMemo(() => (proj?.days ?? []).filter((d) => d.inMonth)
    .map((d) => ({ ...d, label: ddmm(d.date), value: useEstimate ? d.withEstimate : d.launched })), [proj, useEstimate]);
  const zeroOffset = useMemo(() => {
    if (!chartData.length) return 0.5;
    const max = Math.max(...chartData.map((d) => d.value));
    const min = Math.min(...chartData.map((d) => d.value));
    if (max <= 0) return 0;
    if (min >= 0) return 1;
    return max / (max - min);
  }, [chartData]);

  const monthLabel = months.find((m) => m.value === month)?.label ?? month;

  return (
    <AppLayout>
      <PageHeader
        title="Projeção"
        description={`Caixa previsto para ${monthLabel}`}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch id="projecao-estimativa" checked={useEstimate} onCheckedChange={setUseEstimate} />
              <Label htmlFor="projecao-estimativa" className="text-xs">Incluir estimativa de variáveis</Label>
            </div>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="h-9 w-[160px] text-xs" id="projecao-mes"><SelectValue /></SelectTrigger>
              <SelectContent>{months.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        }
      />

      <Tabs value={view} onValueChange={(v) => setView(v as ProjectionView)} className="mb-3">
        <TabsList className="h-8">
          <TabsTrigger value="consolidated" className="text-xs">Consolidado</TabsTrigger>
          <TabsTrigger value="personal" className="text-xs">Pessoal</TabsTrigger>
          <TabsTrigger value="business" className="text-xs">Empresarial</TabsTrigger>
        </TabsList>
      </Tabs>

      {error ? (
        <Card><CardContent className="py-10 text-center text-sm text-destructive">Não foi possível carregar a projeção. Recarregue a página.</CardContent></Card>
      ) : isLoading || !proj || !base || !data ? (
        <Card><CardContent className="p-6"><div className="h-24 animate-pulse bg-muted rounded" /></CardContent></Card>
      ) : (() => {
        const v = pick(proj);
        const b = pick(base);
        const delta = (a: number, c: number) => {
          const d = Math.round((a - c) * 100) / 100;
          if (!simActive || Math.abs(d) < 0.01) return null;
          return <span className={`block text-[11px] font-normal ${d > 0 ? "text-emerald-600" : "text-destructive"}`}>{d > 0 ? "+" : ""}{fmt(d)} na simulação</span>;
        };
        return (
        <div className="space-y-3">
          {simActive > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary/40 bg-primary/5 px-3 py-1.5 text-xs">
              <span className="flex items-center gap-2"><Scissors className="h-3.5 w-3.5" />Simulação ativa ({simActive} ajuste{simActive > 1 ? "s" : ""}). Nenhum lançamento foi alterado.</span>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setSim(emptySim)}><RotateCcw className="h-3.5 w-3.5 mr-1" />Limpar</Button>
            </div>
          )}

          {/* Resumo em uma linha */}
          <Card>
            <CardContent className="p-3 grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
              <Stat title={month === months[0].value ? "Saldo hoje" : `Saldo em ${ddmm(proj.monthStart)}`} value={fmt(v.start)} tone={v.start < 0 ? "text-destructive" : ""} />
              <Stat title="Entradas" value={fmt(proj.income)} tone="text-emerald-600" extra={delta(proj.income, base.income)} />
              <Stat title={useEstimate ? "Saídas + estimativa" : "Saídas"} value={fmt(v.expense)} tone="text-destructive" extra={delta(b.expense, v.expense)} />
              <Stat title="Saldo final" value={fmt(v.end)} tone={v.end < 0 ? "text-destructive" : "text-emerald-600"} extra={delta(v.end, b.end)} />
              <Stat title={`Pior dia · ${ddmm(v.worst.date)}`} value={fmt(v.worst.balance)} tone={v.worst.balance < 0 ? "text-destructive" : "text-emerald-600"} extra={delta(v.worst.balance, b.worst.balance)} />
            </CardContent>
          </Card>

          <div className="grid gap-3 lg:grid-cols-5">
            {/* Gráfico */}
            <Card className="lg:col-span-3">
              <CardHeader className="pb-0 pt-3"><CardTitle className="text-sm">Saldo dia a dia</CardTitle></CardHeader>
              <CardContent className="pt-1 pb-3">
                <ResponsiveContainer width="100%" height={230}>
                  <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="saldoFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset={0} stopColor="hsl(152 60% 40%)" stopOpacity={0.35} />
                        <stop offset={zeroOffset} stopColor="hsl(152 60% 40%)" stopOpacity={0.08} />
                        <stop offset={zeroOffset} stopColor="hsl(0 72% 50%)" stopOpacity={0.08} />
                        <stop offset={1} stopColor="hsl(0 72% 50%)" stopOpacity={0.35} />
                      </linearGradient>
                      <linearGradient id="saldoLine" x1="0" y1="0" x2="0" y2="1">
                        <stop offset={zeroOffset} stopColor="hsl(152 60% 35%)" />
                        <stop offset={zeroOffset} stopColor="hsl(0 72% 45%)" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={24} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtK} width={44} />
                    <Tooltip content={<DayTooltip />} />
                    <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" />
                    <ReferenceLine x={ddmm(v.worst.date)} stroke="hsl(var(--destructive))" strokeDasharray="3 3" />
                    <Area type="stepAfter" dataKey="value" stroke="url(#saldoLine)" strokeWidth={2} fill="url(#saldoFill)" />
                  </AreaChart>
                </ResponsiveContainer>
                <p className="text-[11px] text-muted-foreground">Verde: saldo positivo · vermelho: negativo · tracejado: pior dia. Passe o mouse para ver as entradas e saídas do dia.</p>
              </CardContent>
            </Card>

            {/* Prioridades */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-1 pt-3"><CardTitle className="text-sm">Prioridades do mês</CardTitle></CardHeader>
              <CardContent className="pb-3 space-y-2">
                {suggestions.length === 0 && <p className="text-xs text-muted-foreground">Nada a apontar com os dados lançados.</p>}
                {suggestions.map((s) => {
                  const L = LEVEL[s.level];
                  const Icon = L.icon;
                  return (
                    <div key={s.id} className="flex gap-2">
                      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${L.dot}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-snug">{s.title}</p>
                        <p className="text-xs text-muted-foreground leading-snug">{s.detail}</p>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {/* Detalhes */}
          <Tabs defaultValue="simulador">
            <TabsList className="h-8">
              <TabsTrigger value="simulador" className="text-xs">Simulador</TabsTrigger>
              <TabsTrigger value="contas" className="text-xs">Contas</TabsTrigger>
              <TabsTrigger value="faturas" className="text-xs">Faturas ({proj.invoiceList.length})</TabsTrigger>
              <TabsTrigger value="meses" className="text-xs">Próximos meses</TabsTrigger>
            </TabsList>

            <TabsContent value="simulador">
              <Card>
                <CardHeader className="pb-2 pt-3">
                  <p className="text-xs text-muted-foreground">Marque o que adiar, reduzir ou o que pode atrasar e veja o efeito no resumo e no gráfico. Nada é gravado nos lançamentos.</p>
                </CardHeader>
              <CardContent className="grid gap-4 lg:grid-cols-3">
                <div>
                  <p className="text-xs font-medium mb-1">Adiar despesas do mês (fora de faturas)</p>
                  {base.expenseList.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma despesa lançada no mês.</p>}
                  <ul className="text-xs divide-y">
                    {(showAllExp ? base.expenseList : base.expenseList.slice(0, 12)).map((t) => (
                      <li key={t.id} className="py-1 flex items-center gap-2">
                        <Checkbox id={`adiar-${t.id}`} checked={sim.postponedTxIds.includes(t.id)} onCheckedChange={() => toggle("postponedTxIds", t.id)} />
                        <label htmlFor={`adiar-${t.id}`} className="flex-1 min-w-0 truncate cursor-pointer">{t.description} <span className="text-muted-foreground">· {ddmm(t.date)}</span></label>
                        <span className="font-mono">{fmt(t.amount)}</span>
                      </li>
                    ))}
                  </ul>
                  {base.expenseList.length > 12 && (
                    <Button size="sm" variant="ghost" className="h-7 text-xs mt-1" onClick={() => setShowAllExp((v) => !v)}>
                      {showAllExp ? "Mostrar só as maiores" : `Mostrar todas (${base.expenseList.length})`}
                    </Button>
                  )}
                </div>
                <div>
                  <p className="text-xs font-medium mb-1">Reduzir gastos variáveis (estimativa)</p>
                  {estimates.filter((e) => e.gap > 0).length === 0 && <p className="text-xs text-muted-foreground">Sem estimativa de variáveis para o mês.</p>}
                  <ul className="text-xs divide-y">
                    {estimates.filter((e) => e.gap > 0).map((e) => (
                      <li key={e.categoryId} className="py-1 flex items-center gap-2">
                        <span className="flex-1 min-w-0 truncate">{e.name} <span className="text-muted-foreground">· típico {fmt(e.average)}</span></span>
                        <span className="font-mono">{fmt(e.gap)}</span>
                        <Select value={String(sim.estimateCuts[e.categoryId] ?? 0)} onValueChange={(v) => setSim((s) => ({ ...s, estimateCuts: { ...s.estimateCuts, [e.categoryId]: Number(v) } }))}>
                          <SelectTrigger id={`corte-${e.categoryId}`} className="h-7 w-[86px] text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>{CUT_OPTIONS.map((c) => <SelectItem key={c} value={String(c)}>{c === 0 ? "Manter" : `−${c * 100}%`}</SelectItem>)}</SelectContent>
                        </Select>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-medium mb-1">E se a receita atrasar?</p>
                  {base.incomeList.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma receita prevista no mês.</p>}
                  <ul className="text-xs divide-y">
                    {base.incomeList.map((t) => (
                      <li key={t.id} className="py-1 flex items-center gap-2">
                        <Checkbox id={`atraso-${t.id}`} checked={sim.delayedIncomeIds.includes(t.id)} onCheckedChange={() => toggle("delayedIncomeIds", t.id)} />
                        <label htmlFor={`atraso-${t.id}`} className="flex-1 min-w-0 truncate cursor-pointer">{t.description} <span className="text-muted-foreground">· {ddmm(t.date)}</span></label>
                        <span className="font-mono text-emerald-600">{fmt(t.amount)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="contas">
              <Card>
                <CardContent className="pt-3 overflow-x-auto">
                  <table className="w-full text-sm min-w-[520px]">
                    <thead><tr className="text-xs text-muted-foreground border-b"><th className="text-left py-1 font-medium">Conta</th><th className="text-right font-medium">Início</th><th className="text-right font-medium">Entra</th><th className="text-right font-medium">Sai</th><th className="text-right font-medium">Fim</th><th className="text-right font-medium">Menor no mês</th></tr></thead>
                    <tbody>
                      {[...proj.accounts].sort((x, y) => x.monthMin - y.monthMin).map((a) => (
                        <tr key={a.id} className="border-b last:border-0">
                          <td className="py-1.5">{a.name}</td>
                          <td className={`text-right font-mono text-xs ${a.start < 0 ? "text-destructive" : ""}`}>{fmt(a.start)}</td>
                          <td className="text-right font-mono text-xs text-emerald-600">{a.income ? fmt(a.income) : "—"}</td>
                          <td className="text-right font-mono text-xs text-destructive">{a.expense ? fmt(a.expense) : "—"}</td>
                          <td className={`text-right font-mono text-xs ${a.end < 0 ? "text-destructive font-medium" : ""}`}>{fmt(a.end)}</td>
                          <td className={`text-right text-xs ${a.monthMin < 0 ? "text-destructive font-medium" : "text-muted-foreground"}`}>{fmt(a.monthMin)} <span className="text-[10px]">{ddmm(a.monthMinDate)}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-[11px] text-muted-foreground mt-2">Só o que está lançado, por conta. A estimativa de variáveis aparece apenas no total.</p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="faturas">
              <Card>
                <CardContent className="pt-3">
                  {proj.invoiceList.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma fatura com lançamentos em aberto no mês.</p> : (
                    <table className="w-full text-sm">
                      <thead><tr className="text-xs text-muted-foreground border-b"><th className="text-left py-1 font-medium">Cartão</th><th className="text-left font-medium">Venc.</th><th className="text-right font-medium">Fatura</th><th className="text-right font-medium">Teto</th></tr></thead>
                      <tbody>
                        {proj.invoiceList.map((f) => {
                          const over = f.managerialLimit > 0 && f.total > f.managerialLimit;
                          return (
                            <tr key={f.cardName + f.dueDate} className="border-b last:border-0">
                              <td className="py-1.5">{f.cardName}<span className="text-[11px] text-muted-foreground"> · {f.count} itens · {f.accounts.join(", ") || "—"}</span></td>
                              <td className="text-xs">{formatIsoDateBR(f.dueDate)}</td>
                              <td className="text-right font-mono">{fmt(f.total)}</td>
                              <td className={`text-right text-xs ${over ? "text-destructive font-medium" : "text-muted-foreground"}`}>{f.managerialLimit > 0 ? (over ? `+${fmt(f.total - f.managerialLimit)}` : fmt(f.managerialLimit)) : "—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-2">Compras ainda não lançadas até o fechamento aumentam a fatura.</p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="meses">
              <Card>
                <CardContent className="pt-3 overflow-x-auto">
                  <table className="w-full text-sm min-w-[520px]">
                    <thead><tr className="text-xs text-muted-foreground border-b">
                      <th className="text-left py-1 font-medium">Mês</th><th className="text-right font-medium">Entradas</th><th className="text-right font-medium">Saídas</th>
                      <th className="text-right font-medium">Saldo final</th><th className="text-right font-medium">Pior dia</th>
                    </tr></thead>
                    <tbody>
                      {horizonRows.map((r) => {
                        const end = useEstimate ? r.endWithEstimate : r.endLaunched;
                        const worst = useEstimate ? r.worst : r.worstLaunched;
                        return (
                          <tr key={r.month} onClick={() => setMonth(r.month)}
                            className={`border-b last:border-0 cursor-pointer hover:bg-muted/50 ${r.month === month ? "bg-primary/5" : ""}`}>
                            <td className="py-1.5">{months.find((m) => m.value === r.month)?.label ?? r.month}
                              {r.lowIncome && <Badge variant="outline" className="ml-2 text-[10px] border-amber-500 text-amber-700 dark:text-amber-400">receitas não lançadas?</Badge>}</td>
                            <td className="text-right font-mono text-xs text-emerald-600">{fmt(r.income)}</td>
                            <td className="text-right font-mono text-xs text-destructive">{fmt(r.expense + (useEstimate ? r.estimate : 0))}</td>
                            <td className={`text-right font-mono text-xs ${end < 0 ? "text-destructive font-medium" : ""}`}>{fmt(end)}</td>
                            <td className={`text-right text-xs ${worst.balance < 0 ? "text-destructive" : "text-muted-foreground"}`}>{fmt(worst.balance)} <span className="text-[10px]">{ddmm(worst.date)}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <p className="text-[11px] text-muted-foreground mt-2">Clique num mês para detalhar. Média recebida nos últimos 3 meses: {fmt(data.avgIncome)}/mês.</p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <p className="text-[11px] text-muted-foreground flex items-start gap-1">
            <Info className="h-3 w-3 mt-0.5 shrink-0" />
            Saldos atuais + lançamentos previstos (vencidos entram hoje){data.virtualCount > 0 ? ` + ${data.virtualCount} ocorrência(s) de recorrências ainda não geradas` : ""}.
            Estimativa de variáveis: valor típico (mediana) pago em {data.refMonths.map((m) => `${m.slice(5)}/${m.slice(2, 4)}`).join(", ")}, sem transferências entre contas próprias, menos o já lançado ({fmt(proj.estimate)} neste mês).
            Sugestões são regras sobre os seus dados para organizar o caixa, não recomendação de investimento.
          </p>
        </div>
        );
      })()}
    </AppLayout>
  );
}

function Stat({ title, value, tone = "", extra }: { title: string; value: string; tone?: string; extra?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-muted-foreground truncate">{title}</p>
      <p className={`text-base font-semibold ${tone}`}>{value}</p>
      {extra}
    </div>
  );
}

function DayTooltip({ active, payload }: { active?: boolean; payload?: { payload: DayPoint & { value: number } }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-md border bg-background p-2 text-xs shadow-sm max-w-[260px]">
      <p className="font-medium">{formatIsoDateBR(d.date)} · saldo {fmt(d.value)}</p>
      {(d.inflow > 0 || d.outflow > 0) && (
        <p className="text-muted-foreground">
          {d.inflow > 0 && <span className="text-emerald-600">+{fmt(d.inflow)} </span>}
          {d.outflow > 0 && <span className="text-destructive">−{fmt(d.outflow)}</span>}
        </p>
      )}
      {d.events.map((e) => (
        <p key={e.description} className="flex justify-between gap-2">
          <span className="truncate">{e.description}</span>
          <span className={e.amount < 0 ? "text-destructive" : "text-emerald-600"}>{fmt(e.amount)}</span>
        </p>
      ))}
    </div>
  );
}
