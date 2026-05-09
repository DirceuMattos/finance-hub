import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, Column } from "@/components/shared/DataTable";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, TrendingDown, Scale } from "lucide-react";
import { useMonthlyCashflow, MonthlyCashflow } from "@/hooks/useMonthlyCashflow";

type ViewName = "consolidated" | "personal" | "business";

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const parseReferenceMonthDate = (value: string) => {
  const [yearStr, monthStr, dayStr = "01"] = value.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  if (!year || !month) return null;

  const date = new Date(year, month - 1, day || 1);
  return Number.isNaN(date.getTime()) ? null : date;
};

const fmtMonth = (m: string) => {
  const date = parseReferenceMonthDate(m);
  if (!date) return m;
  return format(date, "MMM yyyy", { locale: ptBR }).replace(/^\w/, (c) => c.toUpperCase());
};

const toMonthParam = (m: string) => {
  const date = parseReferenceMonthDate(m);
  if (!date) return m;
  return format(date, "yyyy-MM");
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
  const currentYear = new Date().getFullYear().toString();
  const [selectedYear, setSelectedYear] = useState<string>(currentYear);
  const { data: rawData = [], isLoading } = useMonthlyCashflow(view);

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    rawData.forEach((r) => {
      try { years.add(r.reference_month.substring(0, 4)); } catch {}
    });
    if (years.size === 0) years.add(currentYear);
    return Array.from(years).sort().reverse();
  }, [rawData, currentYear]);

  const data = useMemo(() => {
    if (selectedYear === "all") return rawData;
    return rawData.filter((r) => r.reference_month.substring(0, 4) === selectedYear);
  }, [rawData, selectedYear]);

  const totals = useMemo(() => {
    const income_paid = data.reduce((s, r) => s + (r.income_paid || 0), 0);
    const income_planned = data.reduce((s, r) => s + (r.income_planned || 0), 0);
    const expense_paid = data.reduce((s, r) => s + (r.expense_paid || 0), 0);
    const expense_planned = data.reduce((s, r) => s + (r.expense_planned || 0), 0);
    const card_projected = data.reduce((s, r) => s + (r.card_projected || 0), 0);
    const card_paid = data.reduce((s, r) => s + (r.card_paid || 0), 0);
    const totalIncome = income_paid + income_planned;
    const totalExpense = expense_paid + expense_planned + card_projected + card_paid;
    return { income_paid, income_planned, expense_paid, expense_planned, card_projected, card_paid, totalIncome, totalExpense, result: totalIncome - totalExpense };
  }, [data]);

  const selectedYearLabel = selectedYear === "all" ? "Todos os anos" : selectedYear;

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
      key: "card_paid", header: "Cartão Pago",
      render: (r) => <span>{fmt(r.card_paid ?? 0)}</span>,
    },
    {
      key: "card_projected", header: "Cartão Projetado",
      render: (r) => <span className={(r.card_projected ?? 0) > 0 ? "text-amber-600 dark:text-amber-400" : ""}>{fmt(r.card_projected ?? 0)}</span>,
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

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
        <Tabs value={view} onValueChange={(v) => setView(v as ViewName)}>
          <TabsList>
            <TabsTrigger value="consolidated">Consolidado</TabsTrigger>
            <TabsTrigger value="personal">Pessoal</TabsTrigger>
            <TabsTrigger value="business">Empresarial</TabsTrigger>
          </TabsList>
        </Tabs>

        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Ano" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os anos</SelectItem>
            {availableYears.map((y) => (
              <SelectItem key={y} value={y}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Receita Realizada</CardTitle>
            <TrendingUp className="h-4 w-4 text-[hsl(152,60%,40%)]" />
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-[hsl(152,60%,40%)]">{fmt(totals.income_paid)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Receita Prevista</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-muted-foreground">{fmt(totals.income_planned)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Despesa Realizada</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-destructive">{fmt(totals.expense_paid)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Despesa Prevista</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-muted-foreground">{fmt(totals.expense_planned)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Resultado</CardTitle>
            <Scale className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className={`text-xl font-bold ${totals.result < 0 ? "text-destructive" : "text-foreground"}`}>{fmt(totals.result)}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">{selectedYearLabel}</p>
          </CardContent>
        </Card>
      </div>

      <DataTable columns={columns} data={data as any} loading={isLoading} emptyMessage="Nenhum dado de fluxo mensal encontrado." />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Evolução Últimos 6 Meses</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={(rawData as MonthlyCashflow[]).slice(-6).map((m) => ({
              mes: (() => {
                const [y, mo] = m.reference_month.split("-").map(Number);
                return format(new Date(y, mo - 1, 1), "MMM yy", { locale: ptBR }).replace(/^\w/, (c) => c.toUpperCase());
              })(),
              "Receita Realizada": m.income_paid,
              "Despesa Realizada": m.expense_paid,
              "Receita Prevista": m.income_planned,
              "Despesa Prevista": m.expense_planned,
            }))} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)} />
              <Legend />
              <Bar dataKey="Receita Realizada" fill="#10b981" />
              <Bar dataKey="Despesa Realizada" fill="#ef4444" />
              <Bar dataKey="Receita Prevista" fill="#6ee7b7" />
              <Bar dataKey="Despesa Prevista" fill="#fca5a5" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
