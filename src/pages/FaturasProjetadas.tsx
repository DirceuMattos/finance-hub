import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, Column } from "@/components/shared/DataTable";
import { FilterBar } from "@/components/shared/FilterBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Info } from "lucide-react";
import { useCardInvoiceProjections } from "@/hooks/useCardInvoiceTransactions";

interface BillingRow {
  key: string;
  card_name: string;
  billing_month: string;
  due_date: string | null;
  total_amount: number;
  paid_amount: number;
  planned_amount: number;
  count: number;
}

export default function FaturasProjetadas() {
  const { projections, isLoading } = useCardInvoiceProjections();
  const [filterCard, setFilterCard] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [includePast, setIncludePast] = useState(false);

  const currentMonth = format(new Date(), "yyyy-MM");

  // Unique card names for filter
  const cardNames = useMemo(() => {
    const names = new Set(projections.map((p) => p.card_name));
    return Array.from(names).sort();
  }, [projections]);

  const rows = useMemo(() => {
    return projections
      .filter((p) => includePast || p.billing_month >= currentMonth)
      .map((p: any): BillingRow => ({
        key: `${p.card_name}_${p.billing_month}`,
        card_name: p.card_name,
        billing_month: p.billing_month,
        due_date: p.due_date,
        total_amount: p.total_amount,
        paid_amount: p.paid_amount ?? (p.status === "paid" ? p.total_amount : 0),
        planned_amount: p.planned_amount ?? (p.status === "planned" ? p.total_amount : 0),
        count: p.invoices_count,
      }));
  }, [projections, currentMonth, includePast]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filterCard !== "all" && r.card_name !== filterCard) return false;
      const searchLower = search.toLowerCase();
      if (search && !r.card_name.toLowerCase().includes(searchLower) && !fmtMonth(r.billing_month).toLowerCase().includes(searchLower)) return false;
      if (filterStatus !== "all") {
        const hasPaid = r.paid_amount > 0;
        const hasPlanned = r.planned_amount > 0;
        if (filterStatus === "paid" && !(hasPaid && !hasPlanned)) return false;
        if (filterStatus === "planned" && !(hasPlanned && !hasPaid)) return false;
        if (filterStatus === "partial" && !(hasPaid && hasPlanned)) return false;
      }
      return true;
    });
  }, [rows, filterCard, filterStatus, search]);

  const fmt = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const fmtMonth = (m: string) => {
    try {
      const [year, month] = m.split("-");
      const date = new Date(parseInt(year), parseInt(month) - 1, 1);
      return format(date, "MMMM yyyy", { locale: ptBR }).replace(/^\w/, (c) => c.toUpperCase());
    } catch {
      return m;
    }
  };

  const statusBadge = (row: BillingRow) => {
    if (row.paid_amount > 0 && row.planned_amount === 0) {
      return <Badge className="bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]">Pago</Badge>;
    }
    if (row.planned_amount > 0 && row.paid_amount === 0) {
      return <Badge variant="outline" className="border-[hsl(var(--warning))] text-[hsl(var(--warning))]">Previsto</Badge>;
    }
    return <Badge variant="outline" className="border-primary text-primary">Parcial</Badge>;
  };

  const monthlyTotals = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((p) => {
      map.set(p.billing_month, (map.get(p.billing_month) || 0) + p.total_amount);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const columns: Column<BillingRow>[] = [
    { key: "billing_month", header: "Mês", render: (r) => <Badge variant="outline">{fmtMonth(r.billing_month)}</Badge> },
    { key: "card_name", header: "Cartão" },
    { key: "total_amount", header: "Total da Fatura", render: (r) => <span className={`font-semibold ${r.total_amount < 0 ? "text-destructive" : ""}`}>{fmt(r.total_amount)}</span> },
    { key: "paid_amount", header: "Pago", render: (r) => <span className="text-[hsl(var(--success))]">{fmt(r.paid_amount)}</span> },
    { key: "planned_amount", header: "Previsto", render: (r) => <span className="text-[hsl(var(--warning))]">{fmt(r.planned_amount)}</span> },
    { key: "status", header: "Status", render: (r) => statusBadge(r) },
    { key: "due_date", header: "Vencimento", render: (r) => r.due_date ? format(new Date(r.due_date), "dd/MM/yyyy") : "—" },
  ];

  return (
    <AppLayout>
      <PageHeader title="Faturas Projetadas" description="Previsão de faturas dos cartões de crédito" />

      <FilterBar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Buscar..." hasActiveFilters={filterCard !== "all" || filterStatus !== "all" || includePast} onClear={() => { setFilterCard("all"); setFilterStatus("all"); setIncludePast(false); }}>
        <Select value={filterCard} onValueChange={setFilterCard}>
          <SelectTrigger className="h-9 w-[160px] text-xs"><SelectValue placeholder="Cartão" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos cartões</SelectItem>
            {cardNames.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-9 w-[130px] text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="paid">Pago</SelectItem>
            <SelectItem value="planned">Previsto</SelectItem>
            <SelectItem value="partial">Parcial</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Switch id="include-past" checked={includePast} onCheckedChange={setIncludePast} />
          <Label htmlFor="include-past" className="text-xs cursor-pointer">Incluir passadas</Label>
        </div>
      </FilterBar>

      {monthlyTotals.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
          {monthlyTotals.slice(0, 6).map(([month, total]) => (
            <Card key={month}>
              <CardHeader className="pb-1 pt-3 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground">{fmtMonth(month)}</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <p className="text-lg font-bold">{fmt(total)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <DataTable columns={columns} data={filtered} loading={isLoading} emptyMessage="Nenhuma fatura projetada disponível." />

      <p className="text-xs text-muted-foreground mt-4 flex items-center gap-1">
        <Info className="h-3 w-3" />
        A competência das faturas é calculada pelo billing_month; o vencimento é exibido separadamente.
      </p>
    </AppLayout>
  );
}
