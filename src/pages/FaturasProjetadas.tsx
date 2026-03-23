import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, Column } from "@/components/shared/DataTable";
import { FilterBar } from "@/components/shared/FilterBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCards } from "@/hooks/useCards";
import { useBillingProjection, BillingProjection } from "@/hooks/useCardInstallments";

export default function FaturasProjetadas() {
  const { data: projections = [], isLoading } = useBillingProjection();
  const { data: cards = [] } = useCards();
  const [filterCard, setFilterCard] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return projections.filter((p) => {
      if (filterCard !== "all" && p.card_id !== filterCard) return false;
      if (search && !p.card_name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [projections, filterCard, search]);

  const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const fmtMonth = (m: string) => {
    try {
      const [year, month] = m.split("-");
      const date = new Date(parseInt(year), parseInt(month) - 1, 1);
      return format(date, "MMMM yyyy", { locale: ptBR }).replace(/^\w/, (c) => c.toUpperCase());
    } catch {
      return m;
    }
  };

  // Group by month for summary cards
  const monthlyTotals = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((p) => {
      map.set(p.billing_month, (map.get(p.billing_month) || 0) + p.total_amount);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const columns: Column<BillingProjection>[] = [
    { key: "billing_month", header: "Mês", render: (r) => <Badge variant="outline">{fmtMonth(r.billing_month)}</Badge> },
    { key: "card_name", header: "Cartão" },
    { key: "total_amount", header: "Total da Fatura", render: (r) => <span className="font-semibold">{fmt(r.total_amount)}</span> },
    { key: "installments_count", header: "Parcelas", render: (r) => `${r.installments_count} parcela${r.installments_count > 1 ? "s" : ""}` },
    { key: "due_date", header: "Vencimento", render: (r) => r.due_date ? format(new Date(r.due_date), "dd/MM/yyyy") : "—" },
  ];

  return (
    <AppLayout>
      <PageHeader title="Faturas Projetadas" description="Previsão de faturas dos cartões de crédito" />

      <FilterBar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Buscar...">
        <Select value={filterCard} onValueChange={setFilterCard}>
          <SelectTrigger className="h-9 w-[160px] text-xs"><SelectValue placeholder="Cartão" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos cartões</SelectItem>
            {cards.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </FilterBar>

      {/* Monthly summary cards */}
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

      <DataTable columns={columns} data={filtered as any} loading={isLoading} emptyMessage="Nenhuma fatura projetada encontrada." />
    </AppLayout>
  );
}
