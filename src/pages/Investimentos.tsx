import { useState, useMemo } from "react";
import { format, parseISO, addMonths } from "date-fns";
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
import { PieChart, TrendingUp, Wallet, Percent, Plus, Pencil, Trash2, AlertTriangle, Zap } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import {
  useInvestmentSnapshots,
  useInvestmentCrud,
  useInvestmentClasses,
  getEffectiveClosing,
  InvestmentSnapshot,
} from "@/hooks/useInvestments";
import { useFinancialEntities } from "@/hooks/useFinancialEntities";
import { InvestmentForm } from "@/components/investimentos/InvestmentForm";
import { DeleteDialog } from "@/components/configuracoes/DeleteDialog";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const fmtMonth = (m: string) => {
  try {
    const [y, mo] = m.split("-").map(Number);
    const d = new Date(y, mo - 1, 1);
    return format(d, "MMM yyyy", { locale: ptBR }).replace(/^\w/, (c) => c.toUpperCase());
  } catch {
    return m;
  }
};

type ViewType = "all" | "personal" | "business";

export default function Investimentos() {
  const [view, setView] = useState<ViewType>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editSnapshot, setEditSnapshot] = useState<InvestmentSnapshot | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [propagating, setPropagating] = useState(false);
  const queryClient = useQueryClient();
  const { data: snapshots = [], isLoading: loadingSnapshots } = useInvestmentSnapshots();
  const { data: entities = [] } = useFinancialEntities();
  const { create, update, remove } = useInvestmentCrud();

  // Dynamic entity filtering by type
  const personalIds = useMemo(() => entities.filter(e => e.entity_type === "personal").map(e => e.id), [entities]);
  const businessIds = useMemo(() => entities.filter(e => e.entity_type === "business").map(e => e.id), [entities]);

  const filterByEntity = <T extends { financial_entity_id: string }>(data: T[]) => {
    if (view === "personal") return data.filter((d) => personalIds.includes(d.financial_entity_id));
    if (view === "business") return data.filter((d) => businessIds.includes(d.financial_entity_id));
    return data;
  };

  // Unique months from snapshots
  const months = useMemo(() => {
    const set = new Set(snapshots.map((s) => s.reference_month));
    return Array.from(set).sort().reverse();
  }, [snapshots]);

  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const activeMonth = selectedMonth || months[0] || "";

  // Snapshots for the selected month with effective closing
  const filteredSnapshots = useMemo(() => {
    let data = filterByEntity(snapshots);
    if (activeMonth) data = data.filter((s) => s.reference_month === activeMonth);
    return data.map((s) => ({
      ...s,
      closing_value: getEffectiveClosing(s, snapshots),
    }));
  }, [snapshots, activeMonth, view, personalIds, businessIds]);

  // Stat cards computed from snapshots
  const totals = useMemo(() => {
    const totalOpening = filteredSnapshots.reduce((s, r) => s + (r.opening_value || 0), 0);
    const totalClosing = filteredSnapshots.reduce((s, r) => s + (r.closing_value ?? r.opening_value ?? 0), 0);
    const variation = totalClosing - totalOpening;
    const variationPct = totalOpening > 0 ? (variation / totalOpening) * 100 : 0;
    return { totalClosing, totalOpening, variation, variationPct };
  }, [filteredSnapshots]);

  // Allocation by class with variation %
  const allocation = useMemo(() => {
    const classMap = new Map<string, { opening: number; closing: number }>();
    filteredSnapshots.forEach((s) => {
      const name = s.investment_classes?.name || "Outros";
      const existing = classMap.get(name) || { opening: 0, closing: 0 };
      existing.opening += s.opening_value;
      existing.closing += s.closing_value;
      classMap.set(name, existing);
    });
    const totalClosing = totals.totalClosing;
    return Array.from(classMap.entries())
      .map(([name, v]) => ({
        name,
        value: v.closing,
        pct: totalClosing > 0 ? (v.closing / totalClosing) * 100 : 0,
        variationPct: v.opening > 0 ? ((v.closing - v.opening) / v.opening) * 100 : 0,
      }))
      .filter((a) => a.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [filteredSnapshots, totals.totalClosing]);

  // Evolution chart from all snapshots grouped by month
  // Only include months where all snapshots have closing_value set
  const chartData = useMemo(() => {
    const entityFiltered = filterByEntity(snapshots);
    const byMonth = new Map<string, { total: number; hasNull: boolean }>();
    entityFiltered.forEach((s) => {
      const existing = byMonth.get(s.reference_month) || { total: 0, hasNull: false };
      if (s.closing_value == null) {
        existing.hasNull = true;
      } else {
        existing.total += s.closing_value;
      }
      byMonth.set(s.reference_month, existing);
    });
    return Array.from(byMonth.entries())
      .filter(([, v]) => !v.hasNull && v.total > 0)
      .map(([month, v]) => ({ month, portfolio: v.total }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [snapshots, view, personalIds, businessIds]);

  const hasEnoughHistory = chartData.length >= 2;

  // Propagate to next month
  const handlePropagate = async () => {
    if (!activeMonth) { toast.error("Selecione um mês para propagar"); return; }
    setPropagating(true);
    try {
      const fromMonth = activeMonth.length === 10 ? activeMonth : `${activeMonth}-01`;
      const [fy, fm] = fromMonth.split("-").map(Number);
      const toDate = new Date(fy, fm, 1);
      const toMonth = format(toDate, "yyyy-MM-dd");
      const toMonthLabel = format(toDate, "MM/yyyy");
      const { data, error } = await (supabase as any).rpc("propagate_investment_month", {
        p_from_month: fromMonth,
        p_to_month: toMonth,
      });
      if (error) throw error;
      const count = Number(data) || 0;
      if (count === 0) toast.info(`Todos os itens já existem em ${toMonthLabel}`);
      else toast.success(`${count} item(s) propagado(s) para ${toMonthLabel}`);
      queryClient.invalidateQueries({ queryKey: ["investment_snapshots"] });
    } catch (e: any) {
      toast.error("Erro ao propagar: " + e.message);
    } finally {
      setPropagating(false);
    }
  };

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
      key: "liquidity",
      header: "Liquidez",
      render: (r) => (r as any).has_quick_liquidity ? (
        <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30 gap-1 text-[10px]">
          <Zap className="h-3 w-3" />Rápida
        </Badge>
      ) : <span className="text-muted-foreground text-xs">—</span>,
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
      sortValue: (r) => r.closing_value ?? 0,
      render: (r) => r.closing_value == null
        ? <span className="text-muted-foreground text-xs italic">Em aberto</span>
        : <span className={`font-mono font-medium ${r.closing_value < 0 ? "text-destructive" : ""}`}>{fmt(r.closing_value)}</span>,
    },
    {
      key: "variation",
      header: "Variação",
      sortable: true,
      sortValue: (r) => (r.closing_value ?? 0) - r.opening_value,
      render: (r) => {
        if (r.closing_value == null) return <span className="text-muted-foreground">—</span>;
        const diff = r.closing_value - r.opening_value;
        const pct = r.opening_value > 0 ? ((diff / r.opening_value) * 100).toFixed(2) : "—";
        if (diff === 0) return <span className="text-muted-foreground">—</span>;
        return (
          <span className={`font-mono text-xs ${diff > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
            {diff > 0 ? "+" : ""}{fmt(diff)} ({pct}%)
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
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handlePropagate} disabled={propagating || !activeMonth}>
              {propagating ? "Propagando..." : "Propagar para Próximo Mês"}
            </Button>
            <Button size="sm" onClick={() => { setEditSnapshot(null); setFormOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Novo registro
            </Button>
          </div>
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
        <StatCard
          title="Carteira Total"
          value={fmt(totals.totalClosing)}
          icon={PieChart}
          variant={totals.totalClosing > 0 ? "positive" : "neutral"}
        />
        <StatCard
          title="Abertura do Mês"
          value={fmt(totals.totalOpening)}
          icon={Wallet}
        />
        <StatCard
          title="Variação do Mês"
          value={fmt(totals.variation)}
          icon={TrendingUp}
          variant={totals.variation > 0 ? "positive" : totals.variation < 0 ? "negative" : "neutral"}
        />
        <StatCard
          title="Variação %"
          value={`${totals.variationPct >= 0 ? "+" : ""}${totals.variationPct.toFixed(2)}%`}
          icon={Percent}
          variant={totals.variationPct > 0 ? "positive" : totals.variationPct < 0 ? "negative" : "neutral"}
        />
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

      {/* Allocation summary with variation % */}
      {allocation.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
          {allocation.map((a) => (
            <Card key={a.name}>
              <CardContent className="p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide truncate">{a.name}</p>
                <p className="text-sm font-semibold font-mono mt-1">{fmt(a.value)}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <Badge variant="outline" className="text-[10px]">
                    {a.pct.toFixed(1)}%
                  </Badge>
                  <span className={`text-[10px] font-mono ${a.variationPct > 0 ? "text-emerald-600 dark:text-emerald-400" : a.variationPct < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                    {a.variationPct > 0 ? "+" : ""}{a.variationPct.toFixed(2)}%
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail table with CRUD */}
      <DataTable
        columns={columns}
        data={filteredSnapshots}
        loading={loadingSnapshots}
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
