import { useState } from "react";
import { useFinancialEntities } from "@/hooks/useFinancialEntities";
import { FilterBar } from "@/components/shared/FilterBar";
import { DataTable, Column } from "@/components/shared/DataTable";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { FinancialEntityForm } from "./FinancialEntityForm";
import { DeleteDialog } from "./DeleteDialog";
import type { FinancialEntity } from "@/types/database";

export function FinancialEntitiesTab() {
  const { data = [], isLoading, create, update, remove } = useFinancialEntities();
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FinancialEntity | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const filtered = data.filter((e) => e.name.toLowerCase().includes(search.toLowerCase()));

  const columns: Column<FinancialEntity>[] = [
    { key: "name", header: "Nome" },
    { key: "entity_type", header: "Tipo", render: (r) => r.entity_type === "personal" ? "Pessoal" : "Empresarial" },
    { key: "is_primary_business_entity", header: "Principal", render: (r) => r.is_primary_business_entity ? <Badge>Sim</Badge> : <Badge variant="secondary">Não</Badge> },
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

  const handleSubmit = (data: Partial<FinancialEntity>) => {
    const mutation = data.id ? update : create;
    mutation.mutate(data as any, { onSuccess: () => { setFormOpen(false); setEditing(null); } });
  };

  return (
    <div>
      <PageHeader title="Entidades Financeiras" description="Gerencie pessoas e empresas" actions={
        <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="h-4 w-4 mr-1" />Nova</Button>
      } />
      <FilterBar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Buscar entidade..." />
      <DataTable columns={columns} data={filtered as any} loading={isLoading} emptyMessage="Nenhuma entidade encontrada." />
      <FinancialEntityForm open={formOpen} onOpenChange={(o) => { setFormOpen(o); if (!o) setEditing(null); }} entity={editing} onSubmit={handleSubmit} loading={create.isPending || update.isPending} />
      <DeleteDialog open={!!deleting} onOpenChange={() => setDeleting(null)} onConfirm={() => { if (deleting) remove.mutate(deleting, { onSuccess: () => setDeleting(null) }); }} loading={remove.isPending} />
    </div>
  );
}
