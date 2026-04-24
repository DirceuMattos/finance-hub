import { useState, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, Column } from "@/components/shared/DataTable";
import { FilterBar } from "@/components/shared/FilterBar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useRecurrences, type Recurrence } from "@/hooks/useRecurrences";
import { useFinancialEntities } from "@/hooks/useFinancialEntities";
import { useAccounts } from "@/hooks/useAccounts";
import { useCategories } from "@/hooks/useCategories";
import { RecurrenceForm } from "@/components/recorrencias/RecurrenceForm";
import { DeleteDialog } from "@/components/configuracoes/DeleteDialog";
import { supabase } from "@/lib/supabaseClient";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type ViewType = "all" | "personal" | "business";

export default function Recorrencias() {
  const { data = [], isLoading, create, update, remove } = useRecurrences();
  const { data: entities = [] } = useFinancialEntities();
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();

  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewType>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Recurrence | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { data, error } = await (supabase as any).rpc(
        "generate_recurring_transactions",
        { p_until: null }
      );
      if (error) throw error;
      const count = Number(data) || 0;
      toast.success(`${count} lançamento(s) gerado(s) com sucesso`);
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    } catch (e: any) {
      toast.error("Erro ao gerar lançamentos: " + e.message);
    } finally {
      setGenerating(false);
    }
  };

  const filtered = useMemo(() => {
    return data.filter((r) => {
      if (search && !r.description.toLowerCase().includes(search.toLowerCase())) return false;
      if (view !== "all") {
        const et = r.financial_entities?.entity_type;
        if (et !== view) return false;
      }
      return true;
    });
  }, [data, search, view]);

  const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
  const fmtDate = (d: string | null) => d ? format(parseISO(d), "dd/MM/yyyy") : "—";

  const columns: Column<Recurrence>[] = [
    { key: "description", header: "Descrição", sortable: true, sortValue: (r) => r.description.toLowerCase() },
    { key: "payee", header: "Favorecido", sortable: true, sortValue: (r) => r.payee || "", render: (r) => r.payee || "—" },
    { key: "type", header: "Tipo", render: (r) => r.transaction_type === "income" ? <Badge className="bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]">Receita</Badge> : <Badge variant="destructive">Despesa</Badge> },
    { key: "amount", header: "Valor", sortable: true, sortValue: (r) => r.amount, render: (r) => <span className={r.transaction_type === "income" ? "text-[hsl(var(--success))]" : r.amount < 0 ? "text-destructive font-medium" : ""}>{fmt(r.amount)}</span> },
    { key: "frequency", header: "Frequência", render: (r) => r.frequency === "weekly" ? "Semanal" : r.frequency === "monthly" ? "Mensal" : r.frequency === "yearly" ? "Anual" : r.frequency },
    { key: "category", header: "Categoria", render: (r) => r.categories?.name || "—" },
    { key: "entity", header: "Entidade", render: (r) => {
      const et = r.financial_entities?.entity_type;
      if (et === "personal") return <Badge variant="outline" className="text-xs border-primary text-primary">Pessoal</Badge>;
      if (et === "business") return <Badge variant="outline" className="text-xs border-accent-foreground text-accent-foreground">Empresa</Badge>;
      return "—";
    }},
    { key: "starts_on", header: "Início", render: (r) => fmtDate(r.starts_on) },
    { key: "ends_on", header: "Fim", render: (r) => fmtDate(r.ends_on) },
    { key: "is_active", header: "Status", render: (r) => r.is_active ? <Badge className="bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]">Ativo</Badge> : <Badge variant="secondary">Inativo</Badge> },
    {
      key: "actions", header: "", render: (r) => (
        <div className="flex gap-0.5">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(r); setFormOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleting(r.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
        </div>
      ),
    },
  ];

  const handleSubmit = (d: Partial<Recurrence>) => {
    const mutation = d.id ? update : create;
    mutation.mutate(d as any, { onSuccess: () => { setFormOpen(false); setEditing(null); } });
  };

  return (
    <AppLayout>
      <PageHeader
        title="Recorrências"
        description="Lançamentos automáticos recorrentes"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleGenerate} disabled={generating}>
              {generating ? "Gerando..." : "Gerar Lançamentos"}
            </Button>
            <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="h-4 w-4 mr-1" />Nova</Button>
          </div>
        }
      />

      <Tabs value={view} onValueChange={(v) => setView(v as ViewType)} className="mb-4">
        <TabsList>
          <TabsTrigger value="all">Consolidado</TabsTrigger>
          <TabsTrigger value="personal">Pessoal</TabsTrigger>
          <TabsTrigger value="business">Empresarial</TabsTrigger>
        </TabsList>
      </Tabs>

      <FilterBar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Buscar recorrência..." />

      <DataTable
        columns={columns}
        data={filtered as any}
        loading={isLoading}
        emptyMessage="Nenhuma recorrência encontrada."
        className="text-xs [&_th]:text-xs [&_th]:px-2 [&_th]:py-2 [&_td]:px-2 [&_td]:py-1.5"
      />

      <RecurrenceForm
        open={formOpen}
        onOpenChange={(o) => { setFormOpen(o); if (!o) setEditing(null); }}
        recurrence={editing}
        entities={entities}
        accounts={accounts}
        categories={categories}
        onSubmit={handleSubmit}
        loading={create.isPending || update.isPending}
      />

      <DeleteDialog open={!!deleting} onOpenChange={() => setDeleting(null)} onConfirm={() => { if (deleting) remove.mutate(deleting, { onSuccess: () => setDeleting(null) }); }} loading={remove.isPending} />
    </AppLayout>
  );
}
