import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DollarSign, TrendingUp, TrendingDown, CreditCard,
  Landmark, PiggyBank, Scale, Target,
} from "lucide-react";
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line,
} from "recharts";
import { format, subMonths, addMonths, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useDashboardData } from "@/hooks/useDashboardData";
import { cn } from "@/lib/utils";

type ViewType = "consolidated" | "personal" | "business";

const fmtCur = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const fmtShort = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact" }).format(v);

const fmtMonth = (m: string) => {
  try {
    const d = new Date(m);
    return format(d, "MMM yy", { locale: ptBR }).replace(/^\w/, c => c.toUpperCase());
  } catch {
    return m;
  }
};

function buildMonthOptions() {
  const options: { value: string; label: string }[] = [];
  const now = startOfMonth(new Date());
  for (let i = -6; i <= 6; i++) {
    const d = i < 0 ? subMonths(now, -i) : addMonths(now, i);
    const val = format(d, "yyyy-MM");
    const label = format(d, "MMMM yyyy", { locale: ptBR }).replace(/^\w/, c => c.toUpperCase());
    options.push({ value: val, label });
  }
  return options;
}

function HorizontalBreakdown({ items, label }: { items: { name: string; total: number }[]; label: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">Sem dados de {label}.</p>;
  }
  const max = items[0]?.total || 1;
  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const pct = (item.total / max) * 100;
        return (
          <div key={item.name}>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-foreground truncate max-w-[180px]">{item.name}</span>
              <span className="font-semibold text-foreground">{fmtCur(item.total)}</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${pct}%`, opacity: 1 - i * 0.08 }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Dashboard() {
  const [view, setView] = useState<ViewType>("consolidated");
  const [selectedMonthStr, setSelectedMonthStr] = useState(() => format(new Date(), "yyyy-MM"));
  const selectedMonth = new Date(selectedMonthStr + "-01");
  const monthOptions = buildMonthOptions();

  const {
    balance, balanceSplit, flow, forecast, cardSummary,
    expensesByCategory, cashflowChart,
    patrimony, patrimonyEvolution, investment,
  } = useDashboardData(view, selectedMonth);

  const income = flow?.income_paid ?? 0;
  const expense = flow?.expense_paid ?? 0;
  const result = income - expense;

  const viewLabel = view === "personal" ? "Pessoal" : view === "business" ? "Empresarial" : "Consolidado";

  const balanceSubLabel = view === "consolidated"
    ? `Pessoal: ${fmtCur(balanceSplit.personal)} | Empresa: ${fmtCur(balanceSplit.business)}`
    : undefined;

  const chartData = cashflowChart.map(d => ({
    month: fmtMonth(d.reference_month),
    Receitas: d.income_paid,
    Despesas: d.expense_paid,
  }));

  const patrimonyChartData = patrimonyEvolution.map(d => ({
    month: fmtMonth(d.reference_month),
    Patrimônio: d.net_patrimony,
  }));

  return (
    <AppLayout>
      <PageHeader title="Dashboard" description={`Visão ${viewLabel.toLowerCase()} das suas finanças`} />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
        <Tabs value={view} onValueChange={(v) => setView(v as ViewType)}>
          <TabsList>
            <TabsTrigger value="consolidated">Consolidado</TabsTrigger>
            <TabsTrigger value="personal">Pessoal</TabsTrigger>
            <TabsTrigger value="business">Empresarial</TabsTrigger>
          </TabsList>
        </Tabs>
        <Select value={selectedMonthStr} onValueChange={setSelectedMonthStr}>
          <SelectTrigger className="h-9 w-[180px] text-xs">
            <SelectValue placeholder="Mês" />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ===== LINHA 1 — Operacional ===== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard
          title="Saldo Atual"
          value={fmtCur(balance)}
          icon={DollarSign}
          subLabel={balanceSubLabel}
          description="Contas ativas"
        />
        <StatCard
          title="Receitas do Mês"
          value={fmtCur(income)}
          icon={TrendingUp}
          variant="positive"
          description="Realizadas"
        />
        <StatCard
          title="Despesas do Mês"
          value={fmtCur(expense)}
          icon={TrendingDown}
          variant="negative"
          description="Realizadas"
        />
        <StatCard
          title="Resultado do Mês"
          value={fmtCur(result)}
          icon={Scale}
          variant={result >= 0 ? "positive" : "negative"}
          description="Receitas − Despesas"
        />
      </div>

      {/* ===== LINHA 2 — Estrutural ===== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <StatCard
          title="Patrimônio"
          value={fmtCur(patrimony.total)}
          icon={Landmark}
          description={patrimony.latestMonth ? `Ref. ${fmtMonth(patrimony.latestMonth)}` : "Sem dados"}
        />
        <StatCard
          title="Total Investido"
          value={fmtCur(investment.total)}
          icon={PiggyBank}
          description="Último snapshot"
        />
      </div>

      {/* ===== PREVISÃO DE FECHAMENTO ===== */}
      <Card className={cn(
        "mb-6 border-2",
        forecast.forecast_result >= 0 ? "border-emerald-500/30 bg-emerald-50/30 dark:bg-emerald-950/10" : "border-red-500/30 bg-red-50/30 dark:bg-red-950/10"
      )}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Previsão de Fechamento do Mês
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
            <div>
              <p className="text-xs text-muted-foreground">Receitas Realizadas</p>
              <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">{fmtCur(forecast.income_paid)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Receitas Previstas</p>
              <p className="text-lg font-semibold text-emerald-600/70 dark:text-emerald-400/70">{fmtCur(forecast.income_planned)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Despesas Realizadas</p>
              <p className="text-lg font-semibold text-red-600 dark:text-red-400">{fmtCur(forecast.expense_paid)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Despesas Previstas</p>
              <p className="text-lg font-semibold text-red-600/70 dark:text-red-400/70">{fmtCur(forecast.expense_planned)}</p>
            </div>
            <div className="col-span-2 md:col-span-1">
              <p className="text-xs text-muted-foreground">Resultado Previsto</p>
              <p className={cn(
                "text-2xl font-bold",
                forecast.forecast_result >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
              )}>
                {fmtCur(forecast.forecast_result)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ===== CARTÕES (mês selecionado) ===== */}
      {cardSummary.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {cardSummary.map(card => (
            <Card key={card.card_name}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-primary" />
                  {card.card_name}
                  <span className="text-xs font-normal text-muted-foreground ml-auto">
                    {card.entity_type === "personal" ? "Pessoal" : "Empresa"}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Pago</p>
                    <p className="text-lg font-semibold text-foreground">{fmtCur(card.historicalTotal)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Previsto</p>
                    <p className="text-lg font-semibold text-foreground">{fmtCur(card.projectedTotal)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Lançamentos</p>
                    <p className="text-lg font-semibold text-foreground">{card.count}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ===== TOP DESPESAS POR CATEGORIA ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Top Despesas por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <HorizontalBreakdown items={expensesByCategory} label="despesas" />
          </CardContent>
        </Card>
      </div>

      {/* ===== PATRIMÔNIO + INVESTIMENTOS ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Evolução do Patrimônio</CardTitle>
          </CardHeader>
          <CardContent>
            {patrimonyChartData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">Sem dados de patrimônio.</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={patrimonyChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtShort} className="fill-muted-foreground" />
                  <Tooltip formatter={(v: number) => fmtCur(v)} />
                  <Line type="monotone" dataKey="Patrimônio" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Composição do Patrimônio</CardTitle>
            <p className="text-lg font-bold text-foreground">{fmtCur(patrimony.total)}</p>
          </CardHeader>
          <CardContent>
            <HorizontalBreakdown items={patrimony.byCategory} label="patrimônio" />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Investimentos por Classe</CardTitle>
            <p className="text-lg font-bold text-foreground">{fmtCur(investment.total)}</p>
          </CardHeader>
          <CardContent>
            <HorizontalBreakdown items={investment.byClass} label="investimentos" />
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
