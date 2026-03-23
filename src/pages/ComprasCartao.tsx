import { useState } from "react";
import { format } from "date-fns";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, Column } from "@/components/shared/DataTable";
import { FilterBar } from "@/components/shared/FilterBar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useCardPurchases } from "@/hooks/useCardPurchases";
import { useCards } from "@/hooks/useCards";
import { useCategories } from "@/hooks/useCategories";
import { useFinancialEntities } from "@/hooks/useFinancialEntities";
import { CardPurchaseForm } from "@/components/cartoes/CardPurchaseForm";
import { DeleteDialog } from "@/components/configuracoes/DeleteDialog";
import type { CardPurchase } from "@/types/database";

const statusLabels: Record<string, string> = { open: "Aberta", closed: "Fechada", cancelled: "Cancelada" };

function StatusBadge({ status }: { status: string }) {
  if (status === "closed") return <Badge className="bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]">Fechada</Badge>;
  if (status === "cancelled") return <Badge variant="destructive">Cancelada</Badge>;
  return <Badge variant="outline" className="border-primary text-primary">Aberta</Badge>;
}

export default function ComprasCartao() {
  const { data = [], isLoading, create, update, remove } = useCardPurchases();
  const { data: cards = [] } = useCards();
  const { data: categories = [] } = useCategories();
  const { data: entities = [] } = useFinancialEntities();

  const [search, setSearch] = useState("");
  const [filterCard, setFilterCard] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CardPurchase | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const filtered = data.filter((p) => {
    if (search && !p.description.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterCard !== "all" && p.card_id !== filterCard) return false;
    return true;
  });

  const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
  const fmtDate = (d: string | null) => d ? format(new Date(d), "dd/MM/yyyy") : "—";

  const columns: Column<CardPurchase>[] = [
    { key: "purchase_date", header: "Data", render: (r) => fmtDate(r.purchase_date) },
    { key: "description", header: "Descrição" },
    { key: "card", header: "Cartão", render: (r) => r.cards?.name || "—" },
    { key: "category", header: "Categoria", render: (r) => r.categories?.name || "—" },
    { key: "total_amount", header: "Total", render: (r) => fmt(r.total_amount) },
    { key: "installments", header: "Parcelas", render: (r) => `${r.installments_count}x ${fmt(r.installment_amount)}` },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    {
      key: "actions", header: "Ações", render: (r) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => { setEditing(r); setFormOpen(true); }}><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={() => setDeleting(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </div>
      ),
    },
  ];

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
        <Select value={filterCard} onValueChange={setFilterCard}>
          <SelectTrigger className="h-9 w-[160px] text-xs"><SelectValue placeholder="Cartão" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos cartões</SelectItem>
            {cards.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </FilterBar>

      <DataTable columns={columns} data={filtered as any} loading={isLoading} emptyMessage="Nenhuma compra encontrada." />

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
