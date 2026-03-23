import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign, TrendingUp, TrendingDown, CreditCard, CalendarClock, Scale } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useDashboardData } from "@/hooks/useDashboardData";

type ViewType = "consolidated" | "personal" | "business";

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const fmtShort = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact" }).format(v);

const fmtMonth = (m: string) => {
  try {
    const d = new Date(m);
    return format(d, "MMM yy", { locale: ptBR }).replace(/^\w/, c => c.toUpperCase());
  } catch { return m; }
};

export default function Dashboard() {
  const [view, setView] = useState<ViewType>("consolidated");
  const { balance, flow, cardBilling, expensesByCategory, cashflowChart, isLoading } = useDashboardData(view);

  const income = flow?.income_paid ?? 0;
  const expense = flow?.expense_paid ?? 0;
  const projected = flow?.projected_balance ?? 0;

  const chartData = cashflowChart.map(d => ({
    month: fmtMonth(d.reference_month),
    Receitas: d.income_paid,
    Despesas: d.expense_paid,
    Saldo: d.projected_balance,
  }));

  const viewLabel = view === "personal" ? "Pessoal" : view === "business" ? "Empresarial" : "Consolidado";

  return (
    <AppLayout>
      <PageHeader title="Dashboard" description={`Visão ${viewLabel.toLowerCase()} das suas finanças`} />

      <Tabs value={view} onValueChange={(v) => setView(v as ViewType)} className="mb-6">
        <TabsList>
          <TabsTrigger value="consolidated">Consolidado</TabsTrigger>
          <TabsTrigger value="personal">Pessoal</TabsTrigger>
          <TabsTrigger value="business">Empresarial</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        <StatCard title="Saldo Atual" value={fmt(balance)} icon={DollarSign} description="Contas ativas" />
        <StatCard title="Receitas" value={fmt(income)} icon={TrendingUp} description="Este mês" />
        <StatCard title="Despesas" value={fmt(expense)} icon={TrendingDown} description="Este mês" />
        <StatCard title="Saldo Projetado" value={fmt(projected)} icon={Scale} description="Este mês" />
        <StatCard title="Cartão (Mês)" value={fmt(cardBilling.currentTotal)} icon={CreditCard} description="Fatura atual" />
        <StatCard title="Cartão (Futuro)" value={fmt(cardBilling.futureTotal)} icon={CalendarClock} description="Próximos meses" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Fluxo Mensal</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">Sem dados de fluxo mensal.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtShort} className="fill-muted-foreground" />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Bar dataKey="Receitas" fill="hsl(152, 60%, 40%)" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Despesas" fill="hsl(0, 72%, 51%)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Top Despesas por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            {expensesByCategory.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">Sem despesas no mês.</p>
            ) : (
              <div className="space-y-3">
                {expensesByCategory.map((cat, i) => {
                  const max = expensesByCategory[0]?.total || 1;
                  const pct = (cat.total / max) * 100;
                  return (
                    <div key={cat.name}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-foreground truncate max-w-[160px]">{cat.name}</span>
                        <span className="font-semibold text-foreground">{fmt(cat.total)}</span>
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
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
