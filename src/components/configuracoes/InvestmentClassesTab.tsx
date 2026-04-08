import { useState } from "react";
import { useInvestmentClassesCrud, InvestmentClassRow } from "@/hooks/useInvestmentClassesCrud";
import { FilterBar } from "@/components/shared/FilterBar";
import { DataTable, Column } from "@/components/shared/DataTable";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { InvestmentClassForm } from "./InvestmentClassForm";
import { DeleteDialog } from "./DeleteDialog";

export function InvestmentClassesTab() {
  const { data, isLoading, create, update, remove } = useInvestmentClassesCrud();
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<InvestmentClassRow | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const filtered = data.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));

  const columns: Column<InvestmentClassRow>[] = [
    { key: "name", header: "Nome", sortable: true, sortValue: (r) => r.name },
    {
      key: "is_active", header: "Status",
      render: (r) => r.is_active
        ? <Badge className="bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]">Ativo</Badge>
        : <Badge variant="secondary">Inativo</Badge>,
    },
    {
      key: "actions", header: "Ações",
      render: (r) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => { setEditing(r); setFormOpen(true); }}><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={() => setDeleting(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </div>
      ),
    },
  ];

  const handleSubmit = (d: Partial<InvestmentClassRow>) => {
    const mutation = d.id ? update : create;
    mutation.mutate(d as any, { onSuccess: () => { setFormOpen(false); setEditing(null); } });
  };

  return (
    <div>
      <PageHeader title="Classes de Investimento" description="Gerencie as classes de investimento disponíveis" actions={
        <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="h-4 w-4 mr-1" />Nova</Button>
      } />
      <FilterBar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Buscar classe..." />
      <DataTable columns={columns} data={filtered} loading={isLoading} emptyMessage="Nenhuma classe encontrada." />
      <InvestmentClassForm open={formOpen} onOpenChange={(o) => { setFormOpen(o); if (!o) setEditing(null); }} investmentClass={editing} onSubmit={handleSubmit} loading={create.isPending || update.isPending} />
      <DeleteDialog open={!!deleting} onOpenChange={() => setDeleting(null)} onConfirm={() => { if (deleting) remove.mutate(deleting, { onSuccess: () => setDeleting(null) }); }} loading={remove.isPending} />
    </div>
  );
}
