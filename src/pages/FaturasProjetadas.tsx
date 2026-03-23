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
import { useBillingProjection } from "@/hooks/useCardInstallments";
import { useCardInvoiceProjections, CardInvoiceProjection } from "@/hooks/useCardInvoiceTransactions";

interface UnifiedProjection {
  key: string;
  card_name: string;
  billing_month: string;
  due_date: string | null;
  total_amount: number;
  count: number;
  status: string;
  source: "installments" | "invoices";
}

export default function FaturasProjetadas() {
  const { data: installmentProjections = [], isLoading: loadingInstallments } = useBillingProjection();
  const { projections: invoiceProjections, isLoading: loadingInvoices } = useCardInvoiceProjections();
  const { data: cards = [] } = useCards();
  const [filterCard, setFilterCard] = useState("all");
  const [search, setSearch] = useState("");

  const unified = useMemo(() => {
    const result: UnifiedProjection[] = [];

    // From card_installments (existing)
    installmentProjections.forEach((p) => {
      result.push({
        key: `inst_${p.card_id}_${p.billing_month}`,
        card_name: p.card_name,
        billing_month: p.billing_month,
        due_date: p.due_date,
        total_amount: p.total_amount,
        count: p.installments_count,
        status: "planned",
        source: "installments",
      });
    });

    // From transactions (invoice data)
    invoiceProjections.forEach((p) => {
      result.push({
        key: `inv_${p.card_name}_${p.billing_month}`,
        card_name: p.card_name,
        billing_month: p.billing_month,
        due_date: p.due_date,
        total_amount: p.total_amount,
        count: p.invoices_count,
        status: p.status,
        source: "invoices",
      });
    });

    return result.sort((a, b) => a.billing_month.localeCompare(b.billing_month) || a.card_name.localeCompare(b.card_name));
  }, [installmentProjections, invoiceProjections]);

  const filtered = useMemo(() => {
    return unified.filter((p) => {
      if (filterCard !== "all" && !cards.some(c => c.id === filterCard && c.name === p.card_name)) {
        // Also check by card name directly
        if (filterCard !== "all") {
          const selectedCard = cards.find(c => c.id === filterCard);
          if (selectedCard && selectedCard.name !== p.card_name) return false;
        }
      }
      if (search && !p.card_name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [unified, filterCard, search, cards]);

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

  const statusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]">Realizado</Badge>;
      case "planned":
        return <Badge variant="outline" className="border-yellow-500 text-yellow-600">Previsto</Badge>;
      case "cancelled":
        return <Badge variant="secondary">Cancelado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const monthlyTotals = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((p) => {
      map.set(p.billing_month, (map.get(p.billing_month) || 0) + p.total_amount);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const columns: Column<UnifiedProjection>[] = [
    { key: "billing_month" as any, header: "Mês", render: (r) => <Badge variant="outline">{fmtMonth(r.billing_month)}</Badge> },
    { key: "card_name" as any, header: "Cartão" },
    { key: "total_amount" as any, header: "Total da Fatura", render: (r) => <span className="font-semibold">{fmt(r.total_amount)}</span> },
    { key: "count" as any, header: "Itens", render: (r) => `${r.count} lançamento${r.count > 1 ? "s" : ""}` },
    { key: "status" as any, header: "Status", render: (r) => statusBadge(r.status) },
    { key: "due_date" as any, header: "Vencimento", render: (r) => r.due_date ? format(new Date(r.due_date), "dd/MM/yyyy") : "—" },
  ];

  const isLoading = loadingInstallments || loadingInvoices;

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

      <DataTable columns={columns} data={filtered as any} loading={isLoading} emptyMessage="Nenhuma fatura projetada disponível. As faturas são geradas automaticamente a partir de compras parceladas registradas em Compras no Cartão." />
    </AppLayout>
  );
}
