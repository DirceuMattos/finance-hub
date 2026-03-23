import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
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
    const d = new Date(m);
    return format(d, "MMM yyyy", { locale: ptBR }).replace(/^\w/, (c) => c.toUpperCase());
  } catch {
    return m;
  }
};

const toMonthParam = (m: string) => {
  try {
    return format(new Date(m), "yyyy-MM");
  } catch {
    return m;
  }
};

type TrafficInfo = { label: string; className: string };

const trafficLightMap = (light: string | undefined): TrafficInfo | null => {
  if (!light) return null;
  const l = light.toLowerCase();
  if (l === "green" || l === "verde" || l === "saudável" || l === "saudavel")
    return { label: "Saudável", className: "bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]" };
  if (l === "yellow" || l === "amarelo" || l === "atenção" || l === "atencao")
    return { label: "Atenção", className: "bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground,0_0%_0%))]" };
  if (l === "blue" || l === "azul" || l === "balanced" || l === "equilibrado")
    return { label: "Equilibrado", className: "bg-primary text-primary-foreground" };
  if (l === "red" || l === "vermelho" || l === "crítico" || l === "critico")
    return { label: "Crítico", className: "bg-destructive text-destructive-foreground" };
  return { label: light, className: "" };
};

export default function FluxoMensal() {
  const navigate = useNavigate();
  const [view, setView] = useState<ViewName>("consolidated");
  const { data = [], isLoading } = useMonthlyCashflow(view);

  const totals = useMemo(() => {
    const income = data.reduce((s, r) => s + (r.income_paid || 0), 0);
    const expense = data.reduce((s, r) => s + (r.expense_paid || 0), 0);
    return { income, expense, net: income - expense };
  }, [data]);

  const columns: Column<MonthlyCashflow>[] = [
    {
      key: "reference_month", header: "Mês",
      render: (r) => (
        <button
          className="font-medium text-primary hover:underline cursor-pointer bg-transparent border-none p-0"
          onClick={() => navigate(`/lancamentos?mes=${toMonthParam(r.reference_month)}`)}
        >
          {fmtMonth(r.reference_month)}
        </button>
      ),
    },
    {
      key: "income_planned", header: "Receita Prevista",
      render: (r) => <span className="text-muted-foreground">{fmt(r.income_planned ?? 0)}</span>,
    },
    {
      key: "income_paid", header: "Receita Realizada",
      render: (r) => <span className="text-[hsl(var(--success))]">{fmt(r.income_paid ?? 0)}</span>,
    },
    {
      key: "expense_planned", header: "Despesa Prevista",
      render: (r) => <span className="text-muted-foreground">{fmt(r.expense_planned ?? 0)}</span>,
    },
    {
      key: "expense_paid", header: "Despesa Realizada",
      render: (r) => <span className="text-destructive">{fmt(r.expense_paid ?? 0)}</span>,
    },
    {
      key: "projected_card_amount", header: "Cartão Projetado",
      render: (r) => <span>{fmt(r.projected_card_amount ?? 0)}</span>,
    },
    {
      key: "projected_balance", header: "Saldo Projetado",
      render: (r) => {
        const val = r.projected_balance ?? 0;
        return (
          <span className={val < 0 ? "text-destructive font-bold" : "text-foreground font-semibold"}>
            {fmt(val)}
            {val < 0 && <Badge variant="destructive" className="ml-2 text-[10px]">Déficit</Badge>}
          </span>
        );
      },
    },
    {
      key: "traffic_light", header: "Semáforo",
      render: (r) => {
        const info = trafficLightMap(r.traffic_light);
        if (!info) return "—";
        return <Badge className={info.className}>{info.label}</Badge>;
      },
    },
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Receitas</CardTitle>
            <TrendingUp className="h-4 w-4 text-[hsl(152,60%,40%)]" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-[hsl(152,60%,40%)]">{fmt(totals.income)}</p>
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
