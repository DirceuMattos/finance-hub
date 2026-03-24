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
import { Info } from "lucide-react";
import { useCards } from "@/hooks/useCards";
import { useBillingProjection } from "@/hooks/useCardInstallments";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";

interface BillingRow {
  key: string;
  card_name: string;
  billing_month: string;
  due_date: string | null;
  total_amount: number;
  paid_amount: number;
  planned_amount: number;
  count: number;
  source: string;
}

export default function FaturasProjetadas() {
  const { data: cards = [] } = useCards();
  const [filterCard, setFilterCard] = useState("all");
  const [search, setSearch] = useState("");

  // Primary source: vw_card_billing_projection
  const { data: viewData, isLoading: loadingView } = useQuery({
    queryKey: ["faturas_card_billing_projection"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("vw_card_billing_projection")
        .select("*")
        .order("billing_month")
        .order("card_name");
      if (error) {
        console.warn("vw_card_billing_projection not available:", error.message);
        return null;
      }
      return data as {
        card_name: string;
        billing_month: string;
        total_amount: number;
        paid_amount: number;
        planned_amount: number;
        installments_count: number;
        due_date: string | null;
      }[];
    },
  });

  // Fallback: useBillingProjection (card_installments)
  const { data: installmentProjections = [], isLoading: loadingFallback } = useBillingProjection();

  const rows = useMemo(() => {
    const result: BillingRow[] = [];

    if (viewData && viewData.length > 0) {
      // Use view data as single source of truth
      viewData.forEach((p) => {
        result.push({
          key: `view_${p.card_name}_${p.billing_month}`,
          card_name: p.card_name,
          billing_month: p.billing_month,
          due_date: p.due_date ?? null,
          total_amount: p.total_amount,
          paid_amount: p.paid_amount ?? 0,
          planned_amount: p.planned_amount ?? 0,
          count: p.installments_count ?? 0,
          source: "view",
        });
      });
    } else {
      // Fallback to installment projections
      installmentProjections.forEach((p) => {
        result.push({
          key: `inst_${p.card_id}_${p.billing_month}`,
          card_name: p.card_name,
          billing_month: p.billing_month,
          due_date: p.due_date,
          total_amount: p.total_amount,
          paid_amount: 0,
          planned_amount: p.total_amount,
          count: p.installments_count,
          source: "fallback",
        });
      });
    }

    return result.sort((a, b) => a.billing_month.localeCompare(b.billing_month) || a.card_name.localeCompare(b.card_name));
  }, [viewData, installmentProjections]);

  const filtered = useMemo(() => {
    return rows.filter((p) => {
      if (filterCard !== "all") {
        const selectedCard = cards.find(c => c.id === filterCard);
        if (selectedCard && selectedCard.name !== p.card_name) return false;
      }
      if (search && !p.card_name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [rows, filterCard, search, cards]);

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

  const statusBadge = (row: BillingRow) => {
    if (row.paid_amount > 0 && row.planned_amount === 0) {
      return <Badge className="bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]">Pago</Badge>;
    }
    if (row.planned_amount > 0 && row.paid_amount === 0) {
      return <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400">Previsto</Badge>;
    }
    return <Badge variant="outline" className="border-blue-500 text-blue-600 dark:text-blue-400">Parcial</Badge>;
  };

  const monthlyTotals = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((p) => {
      map.set(p.billing_month, (map.get(p.billing_month) || 0) + p.total_amount);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const columns: Column<BillingRow>[] = [
    { key: "billing_month" as any, header: "Mês", render: (r) => <Badge variant="outline">{fmtMonth(r.billing_month)}</Badge> },
    { key: "card_name" as any, header: "Cartão" },
    { key: "total_amount" as any, header: "Total da Fatura", render: (r) => <span className="font-semibold">{fmt(r.total_amount)}</span> },
    { key: "paid_amount" as any, header: "Pago", render: (r) => <span className="text-emerald-600 dark:text-emerald-400">{fmt(r.paid_amount)}</span> },
    { key: "planned_amount" as any, header: "Previsto", render: (r) => <span className="text-amber-600 dark:text-amber-400">{fmt(r.planned_amount)}</span> },
    { key: "status" as any, header: "Status", render: (r) => statusBadge(r) },
    { key: "due_date" as any, header: "Vencimento", render: (r) => r.due_date ? format(new Date(r.due_date), "dd/MM/yyyy") : "—" },
  ];

  const isLoading = loadingView || (viewData === null && loadingFallback);

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

      <DataTable columns={columns} data={filtered as any} loading={isLoading} emptyMessage="Nenhuma fatura projetada disponível." />

      <p className="text-xs text-muted-foreground mt-4 flex items-center gap-1">
        <Info className="h-3 w-3" />
        Dados provenientes da view vw_card_billing_projection. Fonte única de verdade no banco.
      </p>
    </AppLayout>
  );
}
