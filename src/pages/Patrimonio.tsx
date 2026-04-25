import { useState, useMemo } from "react";
import { addMonths, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, Column } from "@/components/shared/DataTable";
import { StatCard } from "@/components/shared/StatCard";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Landmark, TrendingUp, TrendingDown, Plus, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { usePatrimonySnapshots, usePatrimonyEvolution, usePatrimonyCrud, PatrimonySnapshot } from "@/hooks/usePatrimony";
import { useFinancialEntities } from "@/hooks/useFinancialEntities";
import { PatrimonyForm } from "@/components/patrimonio/PatrimonyForm";
import { DeleteDialog } from "@/components/configuracoes/DeleteDialog";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

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

// Dynamic entity filtering using entities data


export default function Patrimonio() {
  const [view, setView] = useState<ViewType>("all");
  const { data: snapshots = [], isLoading: loadingSnapshots } = usePatrimonySnapshots();
  const { data: evolution = [] } = usePatrimonyEvolution();
  const { data: entities = [] } = useFinancialEntities();
  const { create, update, remove } = usePatrimonyCrud();

  const personalIds = useMemo(() => entities.filter(e => e.entity_type === "personal").map(e => e.id), [entities]);
  const businessIds = useMemo(() => entities.filter(e => e.entity_type === "business").map(e => e.id), [entities]);

  const [formOpen, setFormOpen] = useState(false);
  const [editingSnapshot, setEditingSnapshot] = useState<PatrimonySnapshot | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const months = useMemo(() => {
    const set = new Set(snapshots.map((s) => s.reference_month));
    return Array.from(set).sort().reverse();
  }, [snapshots]);

  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const activeMonth = selectedMonth || months[0] || "";

  const filterByEntity = <T extends { financial_entity_id: string }>(data: T[]) => {
    if (view === "personal") return data.filter((d) => personalIds.includes(d.financial_entity_id));
    if (view === "business") return data.filter((d) => businessIds.includes(d.financial_entity_id));
    return data;
  };

  const filteredSnapshots = useMemo(() => {
    let data = filterByEntity(snapshots);
    if (activeMonth) data = data.filter((s) => s.reference_month === activeMonth);
    return data;
  }, [snapshots, activeMonth, view]);

  const filteredEvolution = useMemo(() => filterByEntity(evolution), [evolution, view]);

  // Aggregate evolution for chart
  const chartData = useMemo(() => {
    if (view === "all") {
      const byMonth = new Map<string, { reference_month: string; total_assets: number; total_liabilities: number; net_patrimony: number }>();
      filteredEvolution.forEach((e) => {
        const existing = byMonth.get(e.reference_month) || { reference_month: e.reference_month, total_assets: 0, total_liabilities: 0, net_patrimony: 0 };
        existing.total_assets += e.total_assets;
        existing.total_liabilities += e.total_liabilities;
        existing.net_patrimony += e.net_patrimony;
        byMonth.set(e.reference_month, existing);
      });
      return Array.from(byMonth.values()).sort((a, b) => a.reference_month.localeCompare(b.reference_month));
    }
    return filteredEvolution.map((e) => ({
      reference_month: e.reference_month,
      total_assets: e.total_assets,
      total_liabilities: e.total_liabilities,
      net_patrimony: e.net_patrimony,
    }));
  }, [filteredEvolution, view]);

  const hasEnoughHistory = chartData.length >= 2;

  const totals = useMemo(() => {
    const assets = filteredSnapshots.filter((s) => s.closing_value > 0).reduce((sum, s) => sum + s.closing_value, 0);
    const liabilities = filteredSnapshots.filter((s) => s.closing_value < 0).reduce((sum, s) => sum + Math.abs(s.closing_value), 0);
    return { assets, liabilities, net: assets - liabilities };
  }, [filteredSnapshots]);

  const byCategory = useMemo(() => {
    const map = new Map<string, { name: string; total: number; items: number }>();
    filteredSnapshots.forEach((s) => {
      const catName = s.asset_categories?.name || "Sem categoria";
      const existing = map.get(catName) || { name: catName, total: 0, items: 0 };
      existing.total += s.closing_value;
      existing.items += 1;
      map.set(catName, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filteredSnapshots]);

  const handleFormSubmit = (data: any) => {
    if (data.id) {
      update.mutate(data, { onSuccess: () => { setFormOpen(false); setEditingSnapshot(null); } });
    } else {
      create.mutate(data, { onSuccess: () => { setFormOpen(false); } });
    }
  };

  const handleEdit = (snapshot: PatrimonySnapshot) => {
    setEditingSnapshot(snapshot);
    setFormOpen(true);
  };

  const handleDelete = () => {
    if (deleteId) {
      remove.mutate(deleteId, { onSuccess: () => setDeleteId(null) });
    }
  };

  const columns: Column<PatrimonySnapshot>[] = [
    { key: "item_name", header: "Item", sortable: true, sortValue: (r) => r.item_name },
    {
      key: "category", header: "Categoria", sortable: true,
      sortValue: (r) => r.asset_categories?.name || "",
      render: (r) => <Badge variant="outline" className="text-[10px]">{r.asset_categories?.name || "—"}</Badge>,
    },
    {
      key: "entity", header: "Entidade", sortable: true,
      sortValue: (r) => r.financial_entities?.name || "",
      render: (r) => (
        <Badge variant={personalIds.includes(r.financial_entity_id) ? "default" : "secondary"} className="text-[10px]">
          {r.financial_entities?.name || "—"}
        </Badge>
      ),
    },
    {
      key: "opening_value", header: "Abertura", sortable: true,
      sortValue: (r) => r.opening_value,
      render: (r) => <span className={`font-mono ${r.opening_value < 0 ? "text-destructive font-medium" : ""}`}>{fmt(r.opening_value)}</span>,
    },
    {
      key: "closing_value", header: "Fechamento", sortable: true,
      sortValue: (r) => r.closing_value,
      render: (r) => <span className={`font-mono font-medium ${r.closing_value < 0 ? "text-destructive" : ""}`}>{fmt(r.closing_value)}</span>,
    },
    {
      key: "variation", header: "Variação", sortable: true,
      sortValue: (r) => r.closing_value - r.opening_value,
      render: (r) => {
        const diff = r.closing_value - r.opening_value;
        if (diff === 0) return <span className="text-muted-foreground">—</span>;
        return <span className={`font-mono text-[10px] ${diff > 0 ? "text-emerald-600" : "text-destructive"}`}>{diff > 0 ? "+" : ""}{fmt(diff)}</span>;
      },
    },
    {
      key: "actions", header: "",
      render: (r) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(r)}><Pencil className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
      ),
    },
  ];

  return (
    <AppLayout>
      <PageHeader title="Patrimônio" description="Visão consolidada do patrimônio por mês" actions={
        <Button onClick={() => { setEditingSnapshot(null); setFormOpen(true); }} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Novo registro
        </Button>
      } />

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
              <SelectItem key={m} value={m}>{fmtMonth(m)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard title="Ativos" value={fmt(totals.assets)} icon={TrendingUp} variant={totals.assets < 0 ? "negative" : "neutral"} />
        <StatCard title="Passivos" value={fmt(totals.liabilities)} icon={TrendingDown} variant={totals.liabilities < 0 ? "negative" : "neutral"} />
        <StatCard title="Patrimônio Líquido" value={fmt(totals.net)} icon={Landmark} variant={totals.net < 0 ? "negative" : "neutral"} />
      </div>

      {/* Evolution Chart */}
      {hasEnoughHistory ? (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <h3 className="text-sm font-semibold mb-4">Evolução Patrimonial</h3>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="reference_month" tickFormatter={fmtMonth} className="text-[10px]" />
                <YAxis tickFormatter={(v) => fmt(v)} className="text-[10px]" width={100} />
                <Tooltip formatter={(v: number) => fmt(v)} labelFormatter={fmtMonth} />
                <Legend />
                <Line type="monotone" dataKey="total_assets" name="Ativos" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="total_liabilities" name="Passivos" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="net_patrimony" name="Patrimônio Líquido" stroke="hsl(142, 76%, 36%)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      ) : (
        <Card className="mb-6">
          <CardContent className="py-8 flex items-center justify-center gap-2 text-muted-foreground">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm">Histórico insuficiente para análise (mínimo 2 meses)</span>
          </CardContent>
        </Card>
      )}

      {byCategory.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-6">
          {byCategory.map((cat) => (
            <Card key={cat.name}>
              <CardContent className="p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{cat.name}</p>
                <p className={`text-sm font-semibold font-mono mt-1 ${cat.total < 0 ? "text-destructive" : ""}`}>{fmt(cat.total)}</p>
                <p className="text-[10px] text-muted-foreground">{cat.items} itens</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <DataTable
        columns={columns}
        data={filteredSnapshots}
        loading={loadingSnapshots}
        emptyMessage="Nenhum registro de patrimônio encontrado."
        defaultSortKey="closing_value"
        defaultSortDir="desc"
      />

      <PatrimonyForm
        open={formOpen}
        onOpenChange={(open) => { setFormOpen(open); if (!open) setEditingSnapshot(null); }}
        snapshot={editingSnapshot}
        onSubmit={handleFormSubmit}
        loading={create.isPending || update.isPending}
      />

      <DeleteDialog
        open={!!deleteId}
        onOpenChange={(open) => { if (!open) setDeleteId(null); }}
        onConfirm={handleDelete}
        loading={remove.isPending}
      />
    </AppLayout>
  );
}
