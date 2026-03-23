import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, Column } from "@/components/shared/DataTable";
import { StatCard } from "@/components/shared/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Landmark, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { usePatrimonySnapshots, usePatrimonyEvolution, PatrimonySnapshot, PatrimonyEvolution } from "@/hooks/usePatrimony";
import { useFinancialEntities } from "@/hooks/useFinancialEntities";

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

export default function Patrimonio() {
  const [view, setView] = useState<ViewType>("all");
  const { data: snapshots = [], isLoading: loadingSnapshots } = usePatrimonySnapshots();
  const { data: evolution = [], isLoading: loadingEvolution } = usePatrimonyEvolution();

  // Get unique months from snapshots
  const months = useMemo(() => {
    const set = new Set(snapshots.map((s) => s.reference_month));
    return Array.from(set).sort().reverse();
  }, [snapshots]);

  const [selectedMonth, setSelectedMonth] = useState<string>("");

  // Auto-select latest month
  const activeMonth = selectedMonth || months[0] || "";

  // Filter by entity
  const filterByEntity = <T extends { financial_entity_id: string }>(data: T[]) => {
    if (view === "personal") return data.filter((d) => d.financial_entity_id === PERSONAL_ENTITY_ID);
    if (view === "business") return data.filter((d) => d.financial_entity_id === BUSINESS_ENTITY_ID);
    return data;
  };

  const filteredSnapshots = useMemo(() => {
    let data = filterByEntity(snapshots);
    if (activeMonth) data = data.filter((s) => s.reference_month === activeMonth);
    return data;
  }, [snapshots, activeMonth, view]);

  const filteredEvolution = useMemo(() => filterByEntity(evolution), [evolution, view]);

  // Totals for stat cards
  const totals = useMemo(() => {
    const assets = filteredSnapshots
      .filter((s) => s.closing_value > 0)
      .reduce((sum, s) => sum + s.closing_value, 0);
    const liabilities = filteredSnapshots
      .filter((s) => s.closing_value < 0)
      .reduce((sum, s) => sum + Math.abs(s.closing_value), 0);
    return { assets, liabilities, net: assets - liabilities };
  }, [filteredSnapshots]);

  // Evolution for latest month
  const latestEvolution = useMemo(() => {
    if (!filteredEvolution.length) return null;
    // Aggregate if "all" view
    if (view === "all") {
      const byMonth = new Map<string, { total_assets: number; total_liabilities: number; net_patrimony: number }>();
      filteredEvolution.forEach((e) => {
        const existing = byMonth.get(e.reference_month) || { total_assets: 0, total_liabilities: 0, net_patrimony: 0 };
        existing.total_assets += e.total_assets;
        existing.total_liabilities += e.total_liabilities;
        existing.net_patrimony += e.net_patrimony;
        byMonth.set(e.reference_month, existing);
      });
      const sorted = Array.from(byMonth.entries()).sort((a, b) => b[0].localeCompare(a[0]));
      return sorted[0]?.[1] || null;
    }
    return filteredEvolution[filteredEvolution.length - 1] || null;
  }, [filteredEvolution, view]);

  // Group by category
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

  const columns: Column<PatrimonySnapshot>[] = [
    {
      key: "item_name",
      header: "Item",
      sortable: true,
      sortValue: (r) => r.item_name,
    },
    {
      key: "category",
      header: "Categoria",
      sortable: true,
      sortValue: (r) => r.asset_categories?.name || "",
      render: (r) => (
        <Badge variant="outline" className="text-[10px]">
          {r.asset_categories?.name || "—"}
        </Badge>
      ),
    },
    {
      key: "entity",
      header: "Entidade",
      sortable: true,
      sortValue: (r) => r.financial_entities?.name || "",
      render: (r) => {
        const name = r.financial_entities?.name || "—";
        const isPersoanl = r.financial_entity_id === PERSONAL_ENTITY_ID;
        return (
          <Badge variant={isPersoanl ? "default" : "secondary"} className="text-[10px]">
            {name}
          </Badge>
        );
      },
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
      render: (r) => (
        <span className={`font-mono font-medium ${r.closing_value < 0 ? "text-destructive" : ""}`}>
          {fmt(r.closing_value)}
        </span>
      ),
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
            {diff > 0 ? "+" : ""}{fmt(diff)}
          </span>
        );
      },
    },
  ];

  return (
    <AppLayout>
      <PageHeader
        title="Patrimônio"
        description="Visão consolidada do patrimônio por mês"
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard title="Ativos" value={fmt(totals.assets)} icon={TrendingUp} />
        <StatCard title="Passivos" value={fmt(totals.liabilities)} icon={TrendingDown} />
        <StatCard title="Patrimônio Líquido" value={fmt(totals.net)} icon={Landmark} />
      </div>

      {/* By category summary */}
      {byCategory.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-6">
          {byCategory.map((cat) => (
            <Card key={cat.name}>
              <CardContent className="p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{cat.name}</p>
                <p className={`text-sm font-semibold font-mono mt-1 ${cat.total < 0 ? "text-destructive" : ""}`}>
                  {fmt(cat.total)}
                </p>
                <p className="text-[10px] text-muted-foreground">{cat.items} itens</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail table */}
      <DataTable
        columns={columns}
        data={filteredSnapshots}
        loading={loadingSnapshots}
        emptyMessage="Nenhum registro de patrimônio encontrado."
        defaultSortKey="closing_value"
        defaultSortDir="desc"
      />
    </AppLayout>
  );
}
