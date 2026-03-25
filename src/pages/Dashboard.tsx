import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DollarSign, TrendingUp, TrendingDown, CreditCard,
  Landmark, PiggyBank, Scale, Target, ShieldCheck, ShieldAlert, ShieldX,
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
    balance, balanceSplit, forecast,
    expensesByCategory,
    patrimony, patrimonyEvolution, investment, riskData,
  } = useDashboardData(view, selectedMonth);

  const viewLabel = view === "personal" ? "Pessoal" : view === "business" ? "Empresarial" : "Consolidado";

  const balanceSubLabel = view === "consolidated"
    ? `Pessoal: ${fmtCur(balanceSplit.personal)} | Empresa: ${fmtCur(balanceSplit.business)}`
    : undefined;

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

      {/* ===== RISCO FINANCEIRO DO MÊS ===== */}
      <Card className={cn(
        "mb-6 border-2",
        riskData.level === "controlled" && "border-emerald-500/40 bg-emerald-50/40 dark:bg-emerald-950/15",
        riskData.level === "attention" && "border-amber-500/40 bg-amber-50/40 dark:bg-amber-950/15",
        riskData.level === "critical" && "border-red-500/40 bg-red-50/40 dark:bg-red-950/15",
      )}>
        <CardContent className="p-5">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex items-center gap-3">
              {riskData.level === "controlled" && <ShieldCheck className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />}
              {riskData.level === "attention" && <ShieldAlert className="h-8 w-8 text-amber-600 dark:text-amber-400" />}
              {riskData.level === "critical" && <ShieldX className="h-8 w-8 text-red-600 dark:text-red-400" />}
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Risco Financeiro do Mês</p>
                <p className={cn(
                  "text-xl font-bold",
                  riskData.level === "controlled" && "text-emerald-600 dark:text-emerald-400",
                  riskData.level === "attention" && "text-amber-600 dark:text-amber-400",
                  riskData.level === "critical" && "text-red-600 dark:text-red-400",
                )}>
                  {riskData.level === "controlled" ? "Controlado" : riskData.level === "attention" ? "Atenção" : "Crítico"}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1 md:ml-auto text-sm">
              <div>
                <span className="text-muted-foreground">Saldo projetado: </span>
                <span className={cn("font-semibold", riskData.forecastResult >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                  {fmtCur(riskData.forecastResult)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Cartão previsto: </span>
                <span className="font-semibold text-foreground">{fmtCur(riskData.cardPlannedTotal)}</span>
              </div>
              {riskData.reserveMin > 0 && (
                <div>
                  <span className="text-muted-foreground">Reserva mín.: </span>
                  <span className="font-semibold text-foreground">{fmtCur(riskData.reserveMin)}</span>
                </div>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2 italic">{riskData.message}</p>
        </CardContent>
      </Card>

      {/* ===== LINHA 1 — Operacional ===== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard
          title="Saldo Atual"
          value={fmtCur(balance)}
          icon={DollarSign}
          subLabel={balanceSubLabel}
          description="Contas ativas"
          variant={balance < 0 ? "negative" : "neutral"}
        />
        <StatCard
          title="Receitas Pagas"
          value={fmtCur(forecast.income_paid)}
          icon={TrendingUp}
          variant="positive"
          description="No mês"
        />
        <StatCard
          title="Despesas Pagas"
          value={fmtCur(forecast.expense_paid)}
          icon={TrendingDown}
          variant="negative"
          description="No mês"
        />
        <StatCard
          title="Saldo Projetado"
          value={fmtCur(forecast.projected_balance)}
          icon={Scale}
          variant={forecast.projected_balance >= 0 ? "positive" : "negative"}
          description="Projeção da view"
        />
      </div>

      {/* ===== LINHA 2 — Estrutural ===== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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
        <StatCard
          title="Comprometimento Cartão"
          value={fmtCur(forecast.projected_card_amount)}
          icon={CreditCard}
          description="Previsto no mês"
        />
        <StatCard
          title="Potencial Contenção"
          value={fmtCur(forecast.potential_containment)}
          icon={Target}
          description="Despesas conteníveis"
        />
      </div>

      {/* ===== PREVISÃO DE FECHAMENTO ===== */}
      <Card className={cn(
        "mb-6 border-2",
        forecast.projected_balance >= 0 ? "border-emerald-500/30 bg-emerald-50/30 dark:bg-emerald-950/10" : "border-red-500/30 bg-red-50/30 dark:bg-red-950/10"
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
              <p className="text-xs text-muted-foreground">Receitas Pagas</p>
              <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">{fmtCur(forecast.income_paid)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Receitas Previstas</p>
              <p className="text-lg font-semibold text-emerald-600/70 dark:text-emerald-400/70">{fmtCur(forecast.income_planned)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Despesas Pagas</p>
              <p className="text-lg font-semibold text-red-600 dark:text-red-400">{fmtCur(forecast.expense_paid)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Despesas Previstas</p>
              <p className="text-lg font-semibold text-red-600/70 dark:text-red-400/70">{fmtCur(forecast.expense_planned)}</p>
            </div>
            <div className="col-span-2 md:col-span-1">
              <p className="text-xs text-muted-foreground">Saldo Projetado</p>
              <p className={cn(
                "text-2xl font-bold",
                forecast.projected_balance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
              )}>
                {fmtCur(forecast.projected_balance)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

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
