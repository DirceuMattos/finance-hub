import { useEffect, useMemo, useState } from "react";
import { addMonths, format, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CalendarClock, CheckCircle2, Info, RotateCcw, Scissors, Wallet } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useMonthProjection, type ProjectionView } from "@/hooks/useMonthProjection";
import { projectMonth, suggestActions, type Simulation, type Suggestion } from "@/lib/monthProjection";
import { formatIsoDateBR } from "@/lib/cardCycle";

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const fmtK = (v: number) => new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(v);
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const label = (d: Date) => format(d, "MMMM yyyy", { locale: ptBR }).replace(/^\w/, (c) => c.toUpperCase());

const LEVEL: Record<Suggestion["level"], { cls: string; icon: typeof AlertTriangle; name: string }> = {
  critical: { cls: "border-destructive/50 bg-destructive/5", icon: AlertTriangle, name: "Urgente" },
  warning: { cls: "border-amber-500/50 bg-amber-500/5", icon: AlertTriangle, name: "Atenção" },
  info: { cls: "border-sky-500/40 bg-sky-500/5", icon: Info, name: "Informação" },
  positive: { cls: "border-emerald-500/50 bg-emerald-500/5", icon: CheckCircle2, name: "Folga" },
};

const CUT_OPTIONS = [0, 0.25, 0.5, 1];
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
  const months = useMemo(() => [0, 1, 2].map((i) => {
    const d = addMonths(startOfMonth(new Date()), i);
    return { value: format(d, "yyyy-MM"), label: label(d) };
  }), []);
  const [month, setMonth] = useState(months[1].value);
  const [view, setView] = useState<ProjectionView>("consolidated");
  const [showAllExp, setShowAllExp] = useState(false);

  // Simulação: só em memória (e lembrada neste navegador); nunca altera lançamentos.
  const simKey = `fh-projecao-sim-${view}-${month}`;
  const [sim, setSim] = useState<Required<Simulation>>(() => loadSim(simKey));
  useEffect(() => { setSim(loadSim(simKey)); }, [simKey]);
  useEffect(() => { try { localStorage.setItem(simKey, JSON.stringify(sim)); } catch { /* sem armazenamento */ } }, [simKey, sim]);

  const { data, isLoading, error } = useMonthProjection(view, month, today);

  const base = useMemo(() => data && projectMonth({ ...data, month, today }), [data, month, today]);
  const proj = useMemo(() => data && projectMonth({ ...data, month, today, sim }), [data, month, today, sim]);
  const suggestions = useMemo(() => data && proj
    ? suggestActions({ projection: proj, planned: data.planned.filter((t) => !sim.postponedTxIds.includes(t.id) && !sim.delayedIncomeIds.includes(t.id)), estimates: data.estimates, entityType: (id) => data.entityTypes[id] ?? null, today })
    : [], [data, proj, sim, today]);

  const simActive = sim.postponedTxIds.length + sim.delayedIncomeIds.length + Object.values(sim.estimateCuts).filter((v) => v > 0).length;
  const toggle = (list: "postponedTxIds" | "delayedIncomeIds", id: string) =>
    setSim((s) => ({ ...s, [list]: s[list].includes(id) ? s[list].filter((x) => x !== id) : [...s[list], id] }));

  const chartData = useMemo(() => (proj?.days ?? []).map((d) => ({ ...d, label: ddmm(d.date) })), [proj]);
  const monthLabel = months.find((m) => m.value === month)?.label ?? month;

  const delta = (a: number, b: number) => {
    const d = Math.round((a - b) * 100) / 100;
    if (!simActive || Math.abs(d) < 0.01) return null;
    return <span className={`text-[11px] ml-1 ${d > 0 ? "text-emerald-600" : "text-destructive"}`}>({d > 0 ? "+" : ""}{fmt(d)})</span>;
  };

  return (
    <AppLayout>
      <PageHeader
        title="Projeção"
        description={`Caixa previsto para ${monthLabel}: dia a dia, por conta, faturas e o que fazer.`}
        actions={
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="h-9 w-[170px] text-xs" id="projecao-mes"><SelectValue /></SelectTrigger>
            <SelectContent>{months.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
          </Select>
        }
      />

      <Tabs value={view} onValueChange={(v) => setView(v as ProjectionView)} className="mb-4">
        <TabsList>
          <TabsTrigger value="consolidated">Consolidado</TabsTrigger>
          <TabsTrigger value="personal">Pessoal</TabsTrigger>
          <TabsTrigger value="business">Empresarial</TabsTrigger>
        </TabsList>
      </Tabs>

      {error ? (
        <Card><CardContent className="py-10 text-center text-sm text-destructive">Não foi possível carregar a projeção. Recarregue a página.</CardContent></Card>
      ) : isLoading || !proj || !base || !data ? (
        <div className="grid gap-4 md:grid-cols-5">{[1, 2, 3, 4, 5].map((i) => <Card key={i}><CardContent className="p-6"><div className="h-12 animate-pulse bg-muted rounded" /></CardContent></Card>)}</div>
      ) : (
        <div className="space-y-4">
          {simActive > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-sm">
              <span className="flex items-center gap-2"><Scissors className="h-4 w-4" />Simulação ativa ({simActive} ajuste{simActive > 1 ? "s" : ""}). Os valores abaixo consideram os ajustes; nenhum lançamento foi alterado.</span>
              <Button size="sm" variant="outline" className="h-7" onClick={() => setSim(emptySim)}><RotateCcw className="h-3.5 w-3.5 mr-1" />Limpar simulação</Button>
            </div>
          )}

          {/* Resumo */}
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
            <Kpi title={month === months[0].value ? "Saldo hoje" : "Saldo inicial"} icon={Wallet}
              value={fmt(proj.startBalance)} sub={month === months[0].value ? "Contas, saldo atual" : `Previsto em ${ddmm(proj.monthStart)}`} />
            <Kpi title="Entradas previstas" icon={ArrowUpRight} tone="text-emerald-600"
              value={<>{fmt(proj.income)}{delta(proj.income, base.income)}</>} sub={`${proj.incomeList.length} lançamento(s)`} />
            <Kpi title="Saídas lançadas" icon={ArrowDownRight} tone="text-destructive"
              value={<>{fmt(proj.expense)}{delta(-proj.expense, -base.expense)}</>} sub={`Faturas ${fmt(proj.invoices)}`} />
            <Kpi title="Saldo final" icon={CalendarClock} tone={proj.endWithEstimate < 0 ? "text-destructive" : ""}
              value={<>{fmt(proj.endWithEstimate)}{delta(proj.endWithEstimate, base.endWithEstimate)}</>}
              sub={`Só lançado: ${fmt(proj.endLaunched)} · estimativa −${fmt(proj.estimate)}`} />
            <Kpi title={`Pior dia · ${ddmm(proj.worstWithEstimate.date)}`} icon={AlertTriangle}
              tone={proj.worstWithEstimate.balance < 0 ? "text-destructive" : "text-emerald-600"}
              highlight={proj.worstWithEstimate.balance < 0}
              value={<>{fmt(proj.worstWithEstimate.balance)}{delta(proj.worstWithEstimate.balance, base.worstWithEstimate.balance)}</>}
              sub={`Só lançado: ${fmt(proj.worstLaunched.balance)} em ${ddmm(proj.worstLaunched.date)}`} />
          </div>

          {/* Ações */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">O que fazer neste mês</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {suggestions.length === 0 && <p className="text-sm text-muted-foreground">Nada a apontar com os dados lançados.</p>}
              {suggestions.map((s) => {
                const L = LEVEL[s.level];
                const Icon = L.icon;
                return (
                  <div key={s.id} className={`rounded-md border px-3 py-2 ${L.cls}`}>
                    <p className="text-sm font-medium flex items-start gap-2"><Icon className="h-4 w-4 mt-0.5 shrink-0" /><span>{s.title}</span>
                      <Badge variant="outline" className="ml-auto text-[10px] shrink-0">{L.name}</Badge></p>
                    <p className="text-xs text-muted-foreground mt-1 ml-6">{s.detail}</p>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Curva */}
          <Card>
            <CardHeader className="pb-0"><CardTitle className="text-base">Saldo dia a dia (todas as contas da visão)</CardTitle></CardHeader>
            <CardContent className="pt-2">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={18} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtK} width={48} />
                  <Tooltip formatter={(v: number, n: string) => [fmt(v), n === "withEstimate" ? "Com estimativa" : "Só lançado"]} labelFormatter={(l) => `Dia ${l}`} />
                  <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeDasharray="4 4" />
                  {month !== months[0].value && <ReferenceLine x={ddmm(proj.monthStart)} stroke="hsl(var(--muted-foreground))" strokeDasharray="2 4" label={{ value: "início do mês", fontSize: 10, position: "insideTopLeft" }} />}
                  <Line type="stepAfter" dataKey="launched" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} dot={false} name="launched" />
                  <Line type="stepAfter" dataKey="withEstimate" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="withEstimate" />
                </LineChart>
              </ResponsiveContainer>
              <p className="text-[11px] text-muted-foreground">Linha azul: com a estimativa de gastos variáveis ainda não lançados · linha cinza: só o que está lançado · tracejado vermelho: zero.</p>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Faturas */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Faturas que vencem no mês</CardTitle></CardHeader>
              <CardContent>
                {proj.invoiceList.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma fatura com lançamentos em aberto no mês.</p> : (
                  <table className="w-full text-sm">
                    <thead><tr className="text-xs text-muted-foreground border-b"><th className="text-left py-1 font-medium">Cartão</th><th className="text-left font-medium">Venc.</th><th className="text-right font-medium">Fatura</th><th className="text-right font-medium">Teto</th></tr></thead>
                    <tbody>
                      {proj.invoiceList.map((f) => {
                        const over = f.managerialLimit > 0 && f.total > f.managerialLimit;
                        return (
                          <tr key={f.cardName + f.dueDate} className="border-b last:border-0">
                            <td className="py-1.5">{f.cardName}<div className="text-[11px] text-muted-foreground">{f.count} itens · paga por {f.accounts.join(", ") || "—"}</div></td>
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

            {/* Contas */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Contas no mês</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm min-w-[460px]">
                  <thead><tr className="text-xs text-muted-foreground border-b"><th className="text-left py-1 font-medium">Conta</th><th className="text-right font-medium">Início</th><th className="text-right font-medium">Entra</th><th className="text-right font-medium">Sai</th><th className="text-right font-medium">Fim</th><th className="text-right font-medium">Menor saldo</th></tr></thead>
                  <tbody>
                    {proj.accounts.map((a) => (
                      <tr key={a.id} className="border-b last:border-0">
                        <td className="py-1.5">{a.name}</td>
                        <td className="text-right font-mono text-xs">{fmt(a.start)}</td>
                        <td className="text-right font-mono text-xs text-emerald-600">{a.income ? fmt(a.income) : "—"}</td>
                        <td className="text-right font-mono text-xs text-destructive">{a.expense ? fmt(a.expense) : "—"}</td>
                        <td className={`text-right font-mono text-xs ${a.end < 0 ? "text-destructive font-medium" : ""}`}>{fmt(a.end)}</td>
                        <td className={`text-right text-xs ${a.min < 0 ? "text-destructive font-medium" : "text-muted-foreground"}`}>{fmt(a.min)}<div className="text-[10px]">{ddmm(a.minDate)}</div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-[11px] text-muted-foreground mt-2">Por conta, só o que está lançado. A estimativa de variáveis aparece no consolidado.</p>
              </CardContent>
            </Card>
          </div>

          {/* Simulador */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><Scissors className="h-4 w-4" />Simulador de cortes e atrasos</CardTitle>
              <p className="text-xs text-muted-foreground">Marque o que adiar, reduzir ou o que pode atrasar e veja o efeito no saldo final e no pior dia. Nada é gravado nos lançamentos.</p>
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
                {data.estimates.filter((e) => e.gap > 0).length === 0 && <p className="text-xs text-muted-foreground">Sem estimativa de variáveis para o mês.</p>}
                <ul className="text-xs divide-y">
                  {data.estimates.filter((e) => e.gap > 0).map((e) => (
                    <li key={e.categoryId} className="py-1 flex items-center gap-2">
                      <span className="flex-1 min-w-0 truncate">{e.name} <span className="text-muted-foreground">· média {fmt(e.average)}</span></span>
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

          <p className="text-[11px] text-muted-foreground flex items-start gap-1">
            <Info className="h-3 w-3 mt-0.5 shrink-0" />
            Projeção a partir dos saldos atuais e dos lançamentos previstos; previstos vencidos entram como se fossem pagos hoje.
            Estimativa de variáveis = média mensal paga em {data.refMonths.map((m) => `${m.slice(5)}/${m.slice(2, 4)}`).join(", ")} nas categorias variáveis, menos o que já está lançado no mês.
            As sugestões são regras sobre os seus próprios dados para organizar o caixa; não são recomendação de investimento.
          </p>
        </div>
      )}
    </AppLayout>
  );
}

function Kpi({ title, value, sub, icon: Icon, tone = "", highlight = false }: {
  title: string; value: React.ReactNode; sub?: string; icon: typeof Wallet; tone?: string; highlight?: boolean;
}) {
  return (
    <Card className={highlight ? "border-destructive/50 bg-destructive/5" : ""}>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground flex items-center gap-1"><Icon className="h-3.5 w-3.5" />{title}</p>
        <p className={`text-lg font-semibold mt-1 ${tone}`}>{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}
