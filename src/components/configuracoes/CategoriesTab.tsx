import { useState } from "react";
import { useCategories } from "@/hooks/useCategories";
import { FilterBar } from "@/components/shared/FilterBar";
import { DataTable, Column } from "@/components/shared/DataTable";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { CategoryForm } from "./CategoryForm";
import { DeleteDialog } from "./DeleteDialog";
import type { Category } from "@/types/database";

const natureLabels: Record<string, string> = { income: "Receita", expense: "Despesa", transfer: "Transferência" };
const groupLabels: Record<string, string> = { fixed: "Fixo", variable: "Variável", exceptional: "Excepcional" };

export function CategoriesTab() {
  const { data = [], isLoading, create, update, remove } = useCategories();
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const filtered = data.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));

  const columns: Column<Category>[] = [
    { key: "name", header: "Nome" },
    { key: "parent", header: "Pai", render: (r) => r.parent?.name || "—" },
    { key: "category_group", header: "Grupo", render: (r) => (r.category_group && groupLabels[r.category_group]) || "—" },
    { key: "transaction_nature", header: "Natureza", render: (r) => (r.transaction_nature && natureLabels[r.transaction_nature]) || "—" },
    { key: "is_containable", header: "Contível", render: (r) => r.is_containable ? <Badge>Sim</Badge> : <Badge variant="secondary">Não</Badge> },
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

  const handleSubmit = (d: Partial<Category>) => {
    const mutation = d.id ? update : create;
    mutation.mutate(d as any, { onSuccess: () => { setFormOpen(false); setEditing(null); } });
  };

  return (
    <div>
      <PageHeader title="Categorias" description="Gerencie categorias de receitas e despesas" actions={
        <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="h-4 w-4 mr-1" />Nova</Button>
      } />
      <FilterBar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Buscar categoria..." />
      <DataTable columns={columns} data={filtered as any} loading={isLoading} emptyMessage="Nenhuma categoria encontrada." />
      <CategoryForm open={formOpen} onOpenChange={(o) => { setFormOpen(o); if (!o) setEditing(null); }} category={editing} categories={data} onSubmit={handleSubmit} loading={create.isPending || update.isPending} />
      <DeleteDialog open={!!deleting} onOpenChange={() => setDeleting(null)} onConfirm={() => { if (deleting) remove.mutate(deleting, { onSuccess: () => setDeleting(null) }); }} loading={remove.isPending} />
    </div>
  );
}
