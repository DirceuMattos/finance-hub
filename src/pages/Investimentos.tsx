import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, Column } from "@/components/shared/DataTable";
import { StatCard } from "@/components/shared/StatCard";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PieChart, TrendingUp, Wallet, BarChart3 } from "lucide-react";
import {
  useInvestmentReturnByClass,
  useInvestmentPortfolioSummary,
  InvestmentReturnByClass,
} from "@/hooks/useInvestments";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const fmtMonth = (m: string) => {
  try {
    const d = new Date(m);
    return format(d, "MMM yyyy", { locale: ptBR }).replace(/^\w/, (c) => c.toUpperCase());
  } catch {
    return m;
  }
};

type ViewType = "all" | "personal" | "business";

const PERSONAL_ENTITY_ID = "d3570d76-4e1e-4f3f-9b47-b71c1d8a884b";
const BUSINESS_ENTITY_ID = "750b0ab2-09b4-44eb-9309-78c4b4d2dab0";

export default function Investimentos() {
  const [view, setView] = useState<ViewType>("all");
  const { data: returnByClass = [], isLoading: loadingReturns } = useInvestmentReturnByClass();
  const { data: portfolioSummary = [], isLoading: loadingSummary } = useInvestmentPortfolioSummary();

  // Unique months
  const months = useMemo(() => {
    const set = new Set(returnByClass.map((r) => r.reference_month));
    return Array.from(set).sort().reverse();
  }, [returnByClass]);

  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const activeMonth = selectedMonth || months[0] || "";

  const filterByEntity = <T extends { financial_entity_id: string }>(data: T[]) => {
    if (view === "personal") return data.filter((d) => d.financial_entity_id === PERSONAL_ENTITY_ID);
    if (view === "business") return data.filter((d) => d.financial_entity_id === BUSINESS_ENTITY_ID);
    return data;
  };

  const filteredReturns = useMemo(() => {
    let data = filterByEntity(returnByClass);
    if (activeMonth) data = data.filter((r) => r.reference_month === activeMonth);
    return data;
  }, [returnByClass, activeMonth, view]);

  // Portfolio totals for selected month
  const totals = useMemo(() => {
    const filtered = filterByEntity(portfolioSummary).filter(
      (p) => p.reference_month === activeMonth
    );
    return filtered.reduce(
      (acc, p) => ({
        total_portfolio_value: acc.total_portfolio_value + p.total_portfolio_value,
        total_estimated_return: acc.total_estimated_return + p.total_estimated_return,
        total_contributions: acc.total_contributions + p.total_contributions,
        total_redemptions: acc.total_redemptions + p.total_redemptions,
      }),
      { total_portfolio_value: 0, total_estimated_return: 0, total_contributions: 0, total_redemptions: 0 }
    );
  }, [portfolioSummary, activeMonth, view]);

  // Allocation by class
  const allocation = useMemo(() => {
    const totalValue = filteredReturns.reduce((s, r) => s + r.closing_value, 0);
    return filteredReturns
      .filter((r) => r.closing_value > 0)
      .map((r) => ({
        name: r.investment_class_name,
        value: r.closing_value,
        pct: totalValue > 0 ? (r.closing_value / totalValue) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredReturns]);

  const columns: Column<InvestmentReturnByClass>[] = [
    {
      key: "investment_class_name",
      header: "Classe",
      sortable: true,
      sortValue: (r) => r.investment_class_name,
    },
    {
      key: "opening_value",
      header: "Abertura",
      sortable: true,
      sortValue: (r) => r.opening_value,
      render: (r) => <span className="font-mono">{fmt(r.opening_value)}</span>,
    },
    {
      key: "closing_value",
      header: "Fechamento",
      sortable: true,
      sortValue: (r) => r.closing_value,
      render: (r) => <span className="font-mono font-medium">{fmt(r.closing_value)}</span>,
    },
    {
      key: "contributions",
      header: "Aportes",
      sortable: true,
      sortValue: (r) => r.contributions,
      render: (r) =>
        r.contributions > 0 ? (
          <span className="font-mono text-emerald-600">+{fmt(r.contributions)}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "redemptions",
      header: "Resgates",
      sortable: true,
      sortValue: (r) => r.redemptions,
      render: (r) =>
        r.redemptions > 0 ? (
          <span className="font-mono text-destructive">-{fmt(r.redemptions)}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "estimated_return",
      header: "Retorno Est.",
      sortable: true,
      sortValue: (r) => r.estimated_return,
      render: (r) => {
        if (r.estimated_return === 0) return <span className="text-muted-foreground">—</span>;
        return (
          <span className={`font-mono ${r.estimated_return > 0 ? "text-emerald-600" : "text-destructive"}`}>
            {r.estimated_return > 0 ? "+" : ""}
            {fmt(r.estimated_return)}
          </span>
        );
      },
    },
    {
      key: "variation",
      header: "Variação",
      sortable: true,
      sortValue: (r) => r.closing_value - r.opening_value,
      render: (r) => {
        const diff = r.closing_value - r.opening_value;
        if (diff === 0) return <span className="text-muted-foreground">—</span>;
        return (
          <span className={`font-mono text-[10px] ${diff > 0 ? "text-emerald-600" : "text-destructive"}`}>
            {diff > 0 ? "+" : ""}
            {fmt(diff)}
          </span>
        );
      },
    },
  ];

  return (
    <AppLayout>
      <PageHeader
        title="Investimentos"
        description="Carteira de investimentos por classe e período"
      />

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Tabs value={view} onValueChange={(v) => setView(v as ViewType)}>
          <TabsList>
            <TabsTrigger value="all">Consolidado</TabsTrigger>
            <TabsTrigger value="personal">Pessoal</TabsTrigger>
            <TabsTrigger value="business">Empresarial</TabsTrigger>
          </TabsList>
        </Tabs>

        <Select value={activeMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Mês de referência" />
          </SelectTrigger>
          <SelectContent>
            {months.map((m) => (
              <SelectItem key={m} value={m}>
                {fmtMonth(m)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <StatCard title="Carteira Total" value={fmt(totals.total_portfolio_value)} icon={PieChart} />
        <StatCard title="Retorno Estimado" value={fmt(totals.total_estimated_return)} icon={TrendingUp} />
        <StatCard title="Aportes" value={fmt(totals.total_contributions)} icon={Wallet} />
        <StatCard title="Resgates" value={fmt(totals.total_redemptions)} icon={BarChart3} />
      </div>

      {/* Allocation summary */}
      {allocation.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
          {allocation.map((a) => (
            <Card key={a.name}>
              <CardContent className="p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide truncate">{a.name}</p>
                <p className="text-sm font-semibold font-mono mt-1">{fmt(a.value)}</p>
                <Badge variant="outline" className="text-[10px] mt-1">
                  {a.pct.toFixed(1)}%
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail table */}
      <DataTable
        columns={columns}
        data={filteredReturns}
        loading={loadingReturns || loadingSummary}
        emptyMessage="Nenhum registro de investimento encontrado."
        defaultSortKey="closing_value"
        defaultSortDir="desc"
      />
    </AppLayout>
  );
}
