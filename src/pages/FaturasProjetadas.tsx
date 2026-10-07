import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, Column } from "@/components/shared/DataTable";
import { FilterBar } from "@/components/shared/FilterBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Info, Receipt } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useCardInvoiceProjections } from "@/hooks/useCardInvoiceTransactions";
import { cardCycleMonthOf, cardCycleWindow, formatIsoDateBR } from "@/lib/cardCycle";
import { INVOICE_STATUS_LABEL, InvoiceStatus, invoiceStatus } from "@/lib/invoiceStatus";
import { CardInvoiceSettleDialog } from "@/components/cartoes/CardInvoiceSettleDialog";

interface BillingRow {
  key: string;
  card_name: string;
  card_id: string | null;
  card_due_day: number | null;
  source: "transactions" | "installments" | "legacy";
  billing_month: string;
  due_date: string | null;
  cycle_start: string | null;
  total_amount: number;
  paid_amount: number;
  planned_amount: number;
  count: number;
  status: InvoiceStatus;
}

const STATUS_STYLE: Record<InvoiceStatus, string> = {
  closed: "bg-emerald-600 text-white border-transparent",
  paid_not_closed: "border-emerald-500 text-emerald-700 dark:text-emerald-400",
  paid: "bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))] border-transparent",
  overdue: "border-destructive text-destructive",
  partial: "border-primary text-primary",
  planned: "border-[hsl(var(--warning))] text-[hsl(var(--warning))]",
  empty: "text-muted-foreground",
};

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const fmtMonth = (m: string) => {
  const [year, month] = m.split("-").map(Number);
  if (!year || !month) return m;
  return format(new Date(year, month - 1, 1), "MMMM yyyy", { locale: ptBR }).replace(/^\w/, (c) => c.toUpperCase());
};

export default function FaturasProjetadas() {
  const { projections, isLoading } = useCardInvoiceProjections();
  const [filterCard, setFilterCard] = useState("all");
  const [filterStatus, setFilterStatus] = useState<"all" | InvoiceStatus>("all");
  const [search, setSearch] = useState("");
  const [includePast, setIncludePast] = useState(false);
  const [settle, setSettle] = useState<BillingRow | null>(null);

  const today = format(new Date(), "yyyy-MM-dd");
  // "A partir de agora" = ciclo em andamento hoje (após o vencimento, já é o do mês seguinte).
  const currentCycleMonth = cardCycleMonthOf(today, 25);

  // Faturas fechadas (viradas) no módulo Cartões
  const { data: closedKeys = new Set<string>() } = useQuery({
    queryKey: ["card_invoice_payment", "all"],
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("card_invoice_payments").select("card_id, reference_month");
      if (error) throw error;
      return new Set<string>((data || []).map((r: any) => `${r.card_id}_${String(r.reference_month).slice(0, 7)}`));
    },
  });

  const allRows = useMemo<BillingRow[]>(() => {
    return projections.map((p: any) => {
      const paid = p.paid_amount ?? 0;
      const planned = p.planned_amount ?? 0;
      const closed = !!p.card_id && closedKeys.has(`${p.card_id}_${p.billing_month}`);
      const closable = p.source === "transactions" && !!p.card_id;
      return {
        key: `${p.card_name}_${p.billing_month}`,
        card_name: p.source === "legacy" ? `${p.card_name} (legado)` : p.card_name,
        card_id: p.card_id,
        card_due_day: p.card_due_day,
        source: p.source,
        billing_month: p.billing_month,
        due_date: p.due_date,
        cycle_start: p.card_id ? cardCycleWindow(p.billing_month, p.card_due_day).start : null,
        total_amount: p.total_amount,
        paid_amount: paid,
        planned_amount: planned,
        count: p.invoices_count,
        status: invoiceStatus({ paid, planned, dueDate: p.due_date, today, closed, closable }),
      };
    });
  }, [projections, closedKeys, today]);

  // Sem "incluir passadas": ciclo atual em diante + qualquer fatura anterior que ainda exija ação.
  const rows = useMemo(
    () => allRows.filter((r) =>
      includePast ||
      r.billing_month >= currentCycleMonth ||
      (r.source === "transactions" && (r.status === "overdue" || r.status === "paid_not_closed"))),
    [allRows, includePast, currentCycleMonth],
  );

  const cardNames = useMemo(() => Array.from(new Set(allRows.map((r) => r.card_name))).sort(), [allRows]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((r) => {
      if (filterCard !== "all" && r.card_name !== filterCard) return false;
      if (filterStatus !== "all" && r.status !== filterStatus) return false;
      if (q && !r.card_name.toLowerCase().includes(q) && !fmtMonth(r.billing_month).toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, filterCard, filterStatus, search]);

  const monthlyTotals = useMemo(() => {
    const map = new Map<string, { total: number; open: number }>();
    filtered.forEach((r) => {
      const cur = map.get(r.billing_month) || { total: 0, open: 0 };
      cur.total += r.total_amount;
      cur.open += r.planned_amount;
      map.set(r.billing_month, cur);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const pendingAction = allRows.filter((r) => r.source === "transactions" && (r.status === "overdue" || r.status === "paid_not_closed"));
  // Parcelas antigas ainda marcadas como previstas: pendência de limpeza (CAR-04f), não de quitação.
  const legacyOpen = allRows.filter((r) => r.source === "installments" && r.planned_amount > 0 && r.status === "overdue");

  const columns: Column<BillingRow>[] = [
    { key: "billing_month", header: "Fatura", sortable: true, sortValue: (r) => r.billing_month,
      render: (r) => <Badge variant="outline">{fmtMonth(r.billing_month)}</Badge> },
    { key: "card_name", header: "Cartão", sortable: true },
    { key: "cycle", header: "Período de gastos",
      render: (r) => r.cycle_start ? <span className="text-xs text-muted-foreground whitespace-nowrap">{formatIsoDateBR(r.cycle_start)} a {formatIsoDateBR(r.due_date)}</span> : "—" },
    { key: "total_amount", header: "Total da Fatura", sortable: true, sortValue: (r) => r.total_amount,
      render: (r) => <span className="font-semibold">{fmt(r.total_amount)}</span> },
    { key: "paid_amount", header: "Pago", render: (r) => <span className="text-[hsl(var(--success))]">{fmt(r.paid_amount)}</span> },
    { key: "planned_amount", header: "Em aberto", render: (r) => <span className="text-[hsl(var(--warning))]">{fmt(r.planned_amount)}</span> },
    { key: "status", header: "Status", render: (r) => <Badge variant="outline" className={STATUS_STYLE[r.status]}>{INVOICE_STATUS_LABEL[r.status]}</Badge> },
    { key: "due_date", header: "Vencimento", sortable: true, sortValue: (r) => r.due_date || "", render: (r) => formatIsoDateBR(r.due_date) },
    { key: "count", header: "Itens", render: (r) => r.count },
    { key: "actions", header: "",
      render: (r) => r.source === "transactions" && r.card_id ? (
        <Button size="sm" variant={r.status === "overdue" || r.status === "paid_not_closed" ? "default" : "ghost"} className="h-7 text-xs" onClick={() => setSettle(r)}>
          <Receipt className="h-3.5 w-3.5 mr-1" />
          {r.status === "closed" ? "Ver" : r.status === "paid_not_closed" ? "Conferir e fechar" : "Abrir"}
        </Button>
      ) : null },
  ];

  return (
    <AppLayout>
      <PageHeader title="Faturas Projetadas" description="Faturas por ciclo de vencimento, com a mesma regra da tela Cartões" />

      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar cartão ou mês..."
        hasActiveFilters={filterCard !== "all" || filterStatus !== "all" || includePast}
        onClear={() => { setFilterCard("all"); setFilterStatus("all"); setIncludePast(false); }}
      >
        <Select value={filterCard} onValueChange={setFilterCard}>
          <SelectTrigger className="h-9 w-[190px] text-xs"><SelectValue placeholder="Cartão" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os cartões</SelectItem>
            {cardNames.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as "all" | InvoiceStatus)}>
          <SelectTrigger className="h-9 w-[170px] text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {(["planned", "partial", "overdue", "paid_not_closed", "closed", "paid"] as InvoiceStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{INVOICE_STATUS_LABEL[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Switch id="include-past" checked={includePast} onCheckedChange={setIncludePast} />
          <Label htmlFor="include-past" className="text-xs cursor-pointer">Incluir histórico</Label>
        </div>
      </FilterBar>

      {pendingAction.length > 0 && (
        <div className="mb-4 rounded-md px-3 py-2 text-sm bg-amber-500/10 text-amber-800 dark:text-amber-300">
          {pendingAction.length} fatura(s) pedem ação: {pendingAction.map((r) => `${r.card_name} · ${fmtMonth(r.billing_month)} (${INVOICE_STATUS_LABEL[r.status].toLowerCase()})`).join("; ")}.
        </div>
      )}

      {legacyOpen.length > 0 && includePast && (
        <div className="mb-4 rounded-md px-3 py-2 text-xs bg-muted text-muted-foreground">
          {legacyOpen.length} fatura(s) do histórico de parcelas têm itens ainda marcados como previstos
          ({fmt(legacyOpen.reduce((s, r) => s + r.planned_amount, 0))}). São registros antigos para a limpeza de legados, não pagamentos pendentes.
        </div>
      )}

      {monthlyTotals.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
          {monthlyTotals.slice(0, 6).map(([month, v]) => (
            <Card key={month}>
              <CardHeader className="pb-1 pt-3 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground">{fmtMonth(month)}</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <p className="text-lg font-bold">{fmt(v.total)}</p>
                <p className="text-[11px] text-muted-foreground">{v.open > 0 ? `${fmt(v.open)} em aberto` : "nada em aberto"}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <DataTable columns={columns} data={filtered} loading={isLoading} rowKey={(r) => r.key} emptyMessage="Nenhuma fatura para os filtros escolhidos." />

      <p className="text-xs text-muted-foreground mt-4 flex items-center gap-1">
        <Info className="h-3 w-3" />
        Cada fatura reúne os lançamentos com vencimento entre o dia seguinte ao vencimento anterior e o vencimento do cartão (ex.: 26/08 a 25/09).
        Parcelas anteriores a mar/2026 vêm do histórico de compras parceladas. Itens "(legado)" usam centro de custo antigo, sem cartão cadastrado.
      </p>

      {settle && settle.card_id && (
        <CardInvoiceSettleDialog
          open={!!settle}
          onOpenChange={(o) => { if (!o) setSettle(null); }}
          cardId={settle.card_id}
          cardName={settle.card_name}
          dueDay={settle.card_due_day || 25}
          referenceMonth={`${settle.billing_month}-01`}
          referenceLabel={fmtMonth(settle.billing_month)}
        />
      )}
    </AppLayout>
  );
}
