import { useState, useMemo } from "react";
import { format, parse, parseISO, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, Column } from "@/components/shared/DataTable";
import { FilterBar } from "@/components/shared/FilterBar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Info } from "lucide-react";
import { useCardInstallments, InstallmentRow } from "@/hooks/useCardInstallments";
import { useCardPurchases } from "@/hooks/useCardPurchases";
import { useCards } from "@/hooks/useCards";
import { useCategories } from "@/hooks/useCategories";
import { useFinancialEntities } from "@/hooks/useFinancialEntities";
import { CardPurchaseForm } from "@/components/cartoes/CardPurchaseForm";
import { DeleteDialog } from "@/components/configuracoes/DeleteDialog";
import type { CardPurchase } from "@/types/database";

const today = startOfDay(new Date());

function StatusBadge({ status, dueDate }: { status: string; dueDate?: string }) {
  if (status === "paid") return <Badge className="bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]">Paga</Badge>;
  if (status === "cancelled") return <Badge variant="destructive">Cancelada</Badge>;
  // Check if overdue
  if (dueDate && isBefore(parseISO(dueDate), today) && status !== "paid" && status !== "cancelled") {
    return <Badge variant="destructive">Vencida</Badge>;
  }
  return <Badge variant="outline" className="border-primary text-primary">Aberta</Badge>;
}

export default function ComprasCartao() {
  const { data: installments = [], isLoading: loadingInstallments } = useCardInstallments();
  const { create, update, remove } = useCardPurchases();
  const { data: cards = [] } = useCards();
  const { data: categories = [] } = useCategories();
  const { data: entities = [] } = useFinancialEntities();

  const [search, setSearch] = useState("");
  const [filterCard, setFilterCard] = useState("all");
  const [filterEntity, setFilterEntity] = useState("all");
  const currentMonth = format(new Date(), "yyyy-MM");
  const [filterMonth, setFilterMonth] = useState(currentMonth);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CardPurchase | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const entityMap = useMemo(() => {
    const map = new Map<string, string>();
    entities.forEach(e => map.set(e.id, e.entity_type));
    return map;
  }, [entities]);

  const personalEntities = useMemo(() => entities.filter(e => e.entity_type === "personal"), [entities]);
  const businessEntities = useMemo(() => entities.filter(e => e.entity_type === "business"), [entities]);

  // Build month options from installments
  const monthOptions = useMemo(() => {
    const months = new Set<string>();
    months.add(currentMonth);
    installments.forEach((inst) => {
      if (inst.billing_month) {
        months.add(inst.billing_month.substring(0, 7));
      }
    });
    return Array.from(months).sort().reverse();
  }, [installments, currentMonth]);

  // Filter installments
  const filtered = useMemo(() => {
    return installments.filter((inst) => {
      const desc = inst.card_purchases?.description || "";
      if (search && !desc.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterCard !== "all" && inst.card_purchases?.card_id !== filterCard) return false;
      if (filterEntity !== "all" && inst.card_purchases?.financial_entity_id !== filterEntity) return false;
      if (filterMonth !== "all") {
        const instMonth = inst.billing_month?.substring(0, 7);
        if (instMonth !== filterMonth) return false;
      }
      return true;
    });
  }, [installments, search, filterCard, filterEntity, filterMonth]);

  const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
  const fmtDate = (d: string | null) => d ? format(parseISO(d), "dd/MM/yyyy") : "—";

  const columns: Column<InstallmentRow>[] = [
    { key: "purchase_date", header: "Data Compra", sortable: true, sortValue: (r) => r.card_purchases?.purchase_date || "", render: (r) => fmtDate(r.card_purchases?.purchase_date || null) },
    { key: "due_date", header: "Vencimento", sortable: true, sortValue: (r) => r.due_date || "", render: (r) => fmtDate(r.due_date) },
    { key: "description", header: "Descrição", sortable: true, sortValue: (r) => (r.card_purchases?.description || "").toLowerCase(), render: (r) => r.card_purchases?.description || "—" },
    { key: "payee", header: "Favorecido", render: (r) => r.card_purchases?.payee || "—" },
    { key: "card", header: "Cartão", render: (r) => r.card_purchases?.cards?.name || "—" },
    { key: "category", header: "Categoria", render: (r) => r.card_purchases?.categories?.name || "—" },
    {
      key: "entity", header: "Entidade", render: (r) => {
        const entId = r.card_purchases?.financial_entity_id;
        const type = entId ? entityMap.get(entId) : undefined;
        return (
          <div className="flex items-center gap-1.5">
            <span>{r.card_purchases?.financial_entities?.name || "—"}</span>
            {type === "personal" && <Badge variant="outline" className="text-[10px] border-primary text-primary">Pessoal</Badge>}
            {type === "business" && <Badge variant="outline" className="text-[10px] border-accent-foreground text-accent-foreground">Empresa</Badge>}
          </div>
        );
      },
    },
    {
      key: "installment", header: "Parcela", sortable: true, sortValue: (r) => r.installment_number,
      render: (r) => <span className="font-mono text-xs">{r.installment_number}/{r.card_purchases?.installments_count || "?"}</span>,
    },
    { key: "amount", header: "Valor", sortable: true, sortValue: (r) => r.amount, render: (r) => <span className={r.amount < 0 ? "text-destructive font-medium" : ""}>{fmt(r.amount)}</span> },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} dueDate={r.due_date} /> },
    {
      key: "actions", header: "Ações", render: (r) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => handleEditPurchase(r.card_purchase_id)}><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={() => setDeleting(r.card_purchase_id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </div>
      ),
    },
  ];

  // Build a purchase map from installments for editing
  const handleEditPurchase = (purchaseId: string) => {
    // Find any installment with this purchase to get purchase data
    const inst = installments.find(i => i.card_purchase_id === purchaseId);
    if (!inst?.card_purchases) return;
    const p = inst.card_purchases;
    setEditing({
      id: purchaseId,
      description: p.description,
      card_id: p.card_id,
      financial_entity_id: p.financial_entity_id,
      purchase_date: p.purchase_date,
      payee: p.payee,
      installments_count: p.installments_count,
      // Fill other fields as needed
    } as any);
    setFormOpen(true);
  };

  const handleSubmit = (d: Partial<CardPurchase>) => {
    const mutation = d.id ? update : create;
    mutation.mutate(d as any, { onSuccess: () => { setFormOpen(false); setEditing(null); } });
  };

  return (
    <AppLayout>
      <PageHeader title="Compras no Cartão" description="Registre e acompanhe compras parceladas" actions={
        <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="h-4 w-4 mr-1" />Nova</Button>
      } />

      <FilterBar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Buscar compra...">
        <Select value={filterMonth} onValueChange={setFilterMonth}>
          <SelectTrigger className="h-9 w-[160px] text-xs"><SelectValue placeholder="Mês" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os meses</SelectItem>
            {monthOptions.map(m => {
              const d = parse(m, "yyyy-MM", new Date());
              return <SelectItem key={m} value={m}>{format(d, "MMM/yyyy", { locale: ptBR })}</SelectItem>;
            })}
          </SelectContent>
        </Select>
        <Select value={filterCard} onValueChange={setFilterCard}>
          <SelectTrigger className="h-9 w-[160px] text-xs"><SelectValue placeholder="Cartão" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos cartões</SelectItem>
            {cards.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterEntity} onValueChange={setFilterEntity}>
          <SelectTrigger className="h-9 w-[160px] text-xs"><SelectValue placeholder="Entidade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas entidades</SelectItem>
            {personalEntities.length > 0 && (
              <>
                <SelectItem value="__p" disabled className="text-xs font-semibold text-muted-foreground">— Pessoais —</SelectItem>
                {personalEntities.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
              </>
            )}
            {businessEntities.length > 0 && (
              <>
                <SelectItem value="__b" disabled className="text-xs font-semibold text-muted-foreground">— Empresariais —</SelectItem>
                {businessEntities.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
              </>
            )}
          </SelectContent>
        </Select>
      </FilterBar>

      <DataTable columns={columns} data={filtered} loading={loadingInstallments} emptyMessage="Nenhuma parcela encontrada para o período selecionado." defaultSortKey="due_date" defaultSortDir="asc" />

      <p className="text-xs text-muted-foreground mt-4 flex items-center gap-1">
        <Info className="h-3 w-3" />
        Cada linha representa uma parcela individual. Parcelas vencidas e não pagas são destacadas em vermelho.
      </p>

      <CardPurchaseForm
        open={formOpen}
        onOpenChange={(o) => { setFormOpen(o); if (!o) setEditing(null); }}
        purchase={editing}
        cards={cards}
        categories={categories}
        entities={entities}
        onSubmit={handleSubmit}
        loading={create.isPending || update.isPending}
      />

      <DeleteDialog open={!!deleting} onOpenChange={() => setDeleting(null)} onConfirm={() => { if (deleting) remove.mutate(deleting, { onSuccess: () => setDeleting(null) }); }} loading={remove.isPending} />
    </AppLayout>
  );
}
