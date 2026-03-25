import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, Column } from "@/components/shared/DataTable";
import { StatCard } from "@/components/shared/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PieChart, TrendingUp, Wallet, BarChart3, Plus, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import {
  useInvestmentSnapshots,
  useInvestmentReturnByClass,
  useInvestmentPortfolioSummary,
  useInvestmentCrud,
  useInvestmentClasses,
  InvestmentSnapshot,
} from "@/hooks/useInvestments";
import { InvestmentForm } from "@/components/investimentos/InvestmentForm";
import { DeleteDialog } from "@/components/configuracoes/DeleteDialog";

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
  const [formOpen, setFormOpen] = useState(false);
  const [editSnapshot, setEditSnapshot] = useState<InvestmentSnapshot | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: snapshots = [], isLoading: loadingSnapshots } = useInvestmentSnapshots();
  const { data: returnByClass = [], isLoading: loadingReturns } = useInvestmentReturnByClass();
  const { data: portfolioSummary = [], isLoading: loadingSummary } = useInvestmentPortfolioSummary();
  const { create, update, remove } = useInvestmentCrud();

  // Unique months from snapshots
  const months = useMemo(() => {
    const set = new Set(snapshots.map((s) => s.reference_month));
    return Array.from(set).sort().reverse();
  }, [snapshots]);

  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const activeMonth = selectedMonth || months[0] || "";

  const filterByEntity = <T extends { financial_entity_id: string }>(data: T[]) => {
    if (view === "personal") return data.filter((d) => d.financial_entity_id === PERSONAL_ENTITY_ID);
    if (view === "business") return data.filter((d) => d.financial_entity_id === BUSINESS_ENTITY_ID);
    return data;
  };

  // Snapshots for table (with CRUD)
  const filteredSnapshots = useMemo(() => {
    let data = filterByEntity(snapshots);
    if (activeMonth) data = data.filter((s) => s.reference_month === activeMonth);
    return data;
  }, [snapshots, activeMonth, view]);

  // Return by class for stat cards and allocation
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

  // Evolution chart data
  const chartData = useMemo(() => {
    const filtered = filterByEntity(portfolioSummary);
    const byMonth = new Map<string, { month: string; portfolio: number; retorno: number }>();
    filtered.forEach((p) => {
      const existing = byMonth.get(p.reference_month) || { month: p.reference_month, portfolio: 0, retorno: 0 };
      existing.portfolio += p.total_portfolio_value;
      existing.retorno += p.total_estimated_return;
      byMonth.set(p.reference_month, existing);
    });
    return Array.from(byMonth.values()).sort((a, b) => a.month.localeCompare(b.month));
  }, [portfolioSummary, view]);

  const hasEnoughHistory = chartData.length >= 2;

  // CRUD handlers
  const handleSubmit = (data: any) => {
    if (data.id) {
      update.mutate(data, { onSuccess: () => setFormOpen(false) });
    } else {
      create.mutate(data, { onSuccess: () => setFormOpen(false) });
    }
  };

  const handleEdit = (snapshot: InvestmentSnapshot) => {
    setEditSnapshot(snapshot);
    setFormOpen(true);
  };

  const handleDelete = () => {
    if (deleteId) {
      remove.mutate(deleteId, { onSuccess: () => setDeleteId(null) });
    }
  };

  const columns: Column<InvestmentSnapshot>[] = [
    {
      key: "investment_class",
      header: "Classe",
      sortable: true,
      sortValue: (r) => r.investment_classes?.name || "",
      render: (r) => <span>{r.investment_classes?.name || "—"}</span>,
    },
    {
      key: "financial_entity",
      header: "Entidade",
      sortable: true,
      sortValue: (r) => r.financial_entities?.name || "",
      render: (r) => (
        <Badge variant="outline" className="text-[10px]">
          {r.financial_entities?.name || "—"}
        </Badge>
      ),
    },
    {
      key: "opening_value",
      header: "Abertura",
      sortable: true,
      sortValue: (r) => r.opening_value,
      render: (r) => <span className={`font-mono ${r.opening_value < 0 ? "text-destructive font-medium" : ""}`}>{fmt(r.opening_value)}</span>,
    },
    {
      key: "closing_value",
      header: "Fechamento",
      sortable: true,
      sortValue: (r) => r.closing_value,
      render: (r) => <span className={`font-mono font-medium ${r.closing_value < 0 ? "text-destructive" : ""}`}>{fmt(r.closing_value)}</span>,
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
          <span className={`font-mono text-xs ${diff > 0 ? "text-emerald-600" : "text-destructive"}`}>
            {diff > 0 ? "+" : ""}{fmt(diff)}
          </span>
        );
      },
    },
    {
      key: "actions",
      header: "",
      render: (r) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(r)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(r.id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <AppLayout>
      <PageHeader
        title="Investimentos"
        description="Carteira de investimentos por classe e período"
        actions={
          <Button size="sm" onClick={() => { setEditSnapshot(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Novo registro
          </Button>
        }
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
        <StatCard title="Carteira Total" value={fmt(totals.total_portfolio_value)} icon={PieChart} variant={totals.total_portfolio_value < 0 ? "negative" : "neutral"} />
        <StatCard title="Retorno Estimado" value={fmt(totals.total_estimated_return)} icon={TrendingUp} variant={totals.total_estimated_return < 0 ? "negative" : "neutral"} />
        <StatCard title="Aportes" value={fmt(totals.total_contributions)} icon={Wallet} />
        <StatCard title="Resgates" value={fmt(totals.total_redemptions)} icon={BarChart3} />
      </div>

      {/* Evolution chart */}
      {hasEnoughHistory ? (
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Evolução da Carteira</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" tickFormatter={fmtMonth} className="text-xs" />
                <YAxis tickFormatter={(v) => fmt(v)} className="text-xs" width={100} />
                <Tooltip
                  formatter={(value: number) => fmt(value)}
                  labelFormatter={fmtMonth}
                />
                <Legend />
                <Line type="monotone" dataKey="portfolio" name="Carteira" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="retorno" name="Retorno Est." stroke="hsl(142 76% 36%)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      ) : (
        <Alert className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Histórico insuficiente para análise (mínimo 2 meses).</AlertDescription>
        </Alert>
      )}

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

      {/* Detail table with CRUD */}
      <DataTable
        columns={columns}
        data={filteredSnapshots}
        loading={loadingSnapshots || loadingReturns || loadingSummary}
        emptyMessage="Nenhum registro de investimento encontrado."
        defaultSortKey="closing_value"
        defaultSortDir="desc"
      />

      {/* Form drawer */}
      <InvestmentForm
        open={formOpen}
        onOpenChange={(open) => { setFormOpen(open); if (!open) setEditSnapshot(null); }}
        snapshot={editSnapshot}
        onSubmit={handleSubmit}
        loading={create.isPending || update.isPending}
      />

      {/* Delete dialog */}
      <DeleteDialog
        open={!!deleteId}
        onOpenChange={(open) => { if (!open) setDeleteId(null); }}
        onConfirm={handleDelete}
        loading={remove.isPending}
      />
    </AppLayout>
  );
}
