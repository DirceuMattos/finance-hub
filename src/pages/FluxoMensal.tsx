import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, Column } from "@/components/shared/DataTable";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Scale } from "lucide-react";
import { useMonthlyCashflow, MonthlyCashflow } from "@/hooks/useMonthlyCashflow";

type ViewName = "consolidated" | "personal" | "business";

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const fmtMonth = (m: string) => {
  try {
    const [year, month] = m.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return format(date, "MMM yyyy", { locale: ptBR }).replace(/^\w/, (c) => c.toUpperCase());
  } catch {
    return m;
  }
};

export default function FluxoMensal() {
  const [view, setView] = useState<ViewName>("consolidated");
  const { data = [], isLoading } = useMonthlyCashflow(view);

  const totals = useMemo(() => {
    const income = data.reduce((s, r) => s + (r.total_income || 0), 0);
    const expense = data.reduce((s, r) => s + (r.total_expense || 0), 0);
    return { income, expense, net: income - expense };
  }, [data]);

  // Detect extra columns from the view dynamically
  const extraKeys = useMemo(() => {
    if (data.length === 0) return [];
    const base = new Set(["reference_month", "total_income", "total_expense", "net_balance", "accumulated_balance"]);
    return Object.keys(data[0]).filter((k) => !base.has(k));
  }, [data]);

  const columns: Column<MonthlyCashflow>[] = [
    {
      key: "reference_month", header: "Mês",
      render: (r) => <span className="font-medium">{fmtMonth(r.reference_month)}</span>,
    },
    {
      key: "total_income", header: "Receitas",
      render: (r) => <span className="text-[hsl(var(--success))]">{fmt(r.total_income)}</span>,
    },
    {
      key: "total_expense", header: "Despesas",
      render: (r) => <span className="text-destructive">{fmt(r.total_expense)}</span>,
    },
    {
      key: "net_balance", header: "Saldo",
      render: (r) => {
        const val = r.net_balance;
        const isCritical = val < 0;
        return (
          <span className={isCritical ? "text-destructive font-bold" : "text-foreground font-semibold"}>
            {fmt(val)}
            {isCritical && <Badge variant="destructive" className="ml-2 text-[10px]">Déficit</Badge>}
          </span>
        );
      },
    },
    ...(data.some(r => r.accumulated_balance !== undefined) ? [{
      key: "accumulated_balance" as const, header: "Acumulado",
      render: (r: MonthlyCashflow) => {
        const val = r.accumulated_balance ?? 0;
        return <span className={val < 0 ? "text-destructive font-semibold" : "text-foreground"}>{fmt(val)}</span>;
      },
    }] : []),
    // Render any extra columns from the view (like risk indicators)
    ...extraKeys.map((key) => ({
      key,
      header: key.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()),
      render: (r: MonthlyCashflow) => {
        const val = r[key];
        if (val === null || val === undefined) return "—";
        if (typeof val === "number") return fmt(val);
        return String(val);
      },
    })),
  ];

  return (
    <AppLayout>
      <PageHeader title="Fluxo Mensal" description="Projeção de receitas e despesas por mês" />

      <Tabs value={view} onValueChange={(v) => setView(v as ViewName)} className="mb-6">
        <TabsList>
          <TabsTrigger value="consolidated">Consolidado</TabsTrigger>
          <TabsTrigger value="personal">Pessoal</TabsTrigger>
          <TabsTrigger value="business">Empresarial</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Receitas</CardTitle>
            <TrendingUp className="h-4 w-4 text-[hsl(var(--success))]" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-[hsl(var(--success))]">{fmt(totals.income)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Despesas</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-destructive">{fmt(totals.expense)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Saldo Líquido</CardTitle>
            <Scale className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${totals.net < 0 ? "text-destructive" : "text-foreground"}`}>{fmt(totals.net)}</p>
          </CardContent>
        </Card>
      </div>

      <DataTable columns={columns} data={data as any} loading={isLoading} emptyMessage="Nenhum dado de fluxo mensal encontrado." />
    </AppLayout>
  );
}
