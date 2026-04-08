import { useState, useMemo } from "react";
import { useCards } from "@/hooks/useCards";
import { useFinancialEntities } from "@/hooks/useFinancialEntities";
import { FilterBar } from "@/components/shared/FilterBar";
import { DataTable, Column } from "@/components/shared/DataTable";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { CardForm } from "./CardForm";
import { DeleteDialog } from "./DeleteDialog";
import type { Card } from "@/types/database";

export function CardsTab() {
  const { data = [], isLoading, create, update, remove } = useCards();
  const { data: entities = [] } = useFinancialEntities();
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Card | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const entityMap = useMemo(() => {
    const map = new Map<string, string>();
    entities.forEach(e => map.set(e.id, e.entity_type));
    return map;
  }, [entities]);

  const filtered = data.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));
  const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const columns: Column<Card>[] = [
    { key: "name", header: "Nome" },
    { key: "issuer_bank", header: "Banco", render: (r) => r.issuer_bank || "—" },
    { key: "credit_limit", header: "Limite", render: (r) => fmt(r.credit_limit) },
    { key: "managerial_limit", header: "Teto Gerencial", render: (r) => fmt(r.managerial_limit || r.credit_limit) },
    { key: "closing_day", header: "Fecha Dia", render: (r) => String(r.closing_day) },
    { key: "due_day", header: "Vence Dia", render: (r) => String(r.due_day) },
    {
      key: "financial_entity", header: "Entidade", render: (r) => {
        const type = entityMap.get(r.financial_entity_id);
        return (
          <div className="flex items-center gap-1.5">
            <span>{r.financial_entities?.name || "—"}</span>
            {type === "personal" && <Badge variant="outline" className="text-[10px] border-primary text-primary">Pessoal</Badge>}
            {type === "business" && <Badge variant="outline" className="text-[10px] border-accent-foreground text-accent-foreground">Empresa</Badge>}
          </div>
        );
      },
    },
    { key: "is_active", header: "Status", render: (r) => r.is_active ? <Badge className="bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]">Ativo</Badge> : <Badge variant="secondary">Inativo</Badge> },
    {
      key: "actions", header: "Ações", render: (r) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => { setEditing(r); setFormOpen(true); }}><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={() => setDeleting(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </div>
      ),
    },
  ];

  const handleSubmit = (data: Partial<Card>) => {
    const mutation = data.id ? update : create;
    mutation.mutate(data as any, { onSuccess: () => { setFormOpen(false); setEditing(null); } });
  };

  return (
    <div>
      <PageHeader title="Cartões" description="Gerencie seus cartões de crédito" actions={
        <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="h-4 w-4 mr-1" />Novo</Button>
      } />
      <FilterBar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Buscar cartão..." />
      <DataTable columns={columns} data={filtered as any} loading={isLoading} emptyMessage="Nenhum cartão encontrado." />
      <CardForm open={formOpen} onOpenChange={(o) => { setFormOpen(o); if (!o) setEditing(null); }} card={editing} entities={entities} onSubmit={handleSubmit} loading={create.isPending || update.isPending} />
      <DeleteDialog open={!!deleting} onOpenChange={() => setDeleting(null)} onConfirm={() => { if (deleting) remove.mutate(deleting, { onSuccess: () => setDeleting(null) }); }} loading={remove.isPending} />
    </div>
  );
}
