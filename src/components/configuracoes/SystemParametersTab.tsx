import { useState } from "react";
import { useSystemParameters } from "@/hooks/useSystemParameters";
import { FilterBar } from "@/components/shared/FilterBar";
import { DataTable, Column } from "@/components/shared/DataTable";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { SystemParameterForm } from "./SystemParameterForm";
import { DeleteDialog } from "./DeleteDialog";
import type { SystemParameter } from "@/types/database";

const typeLabels: Record<string, string> = { string: "Texto", number: "Número", boolean: "Booleano", json: "JSON" };

const PARAMETER_LABELS: Record<string, { name: string; description: string }> = {
  reference_month: { name: "Mês de Referência", description: "Mês base para cálculos do sistema" },
  minimum_reserve_personal: { name: "Reserva Mínima Pessoal", description: "Valor mínimo de reserva para finanças pessoais" },
  minimum_reserve_business: { name: "Reserva Mínima Empresarial", description: "Valor mínimo de reserva para a empresa" },
  surplus_investment_ratio: { name: "Proporção de Investimento", description: "Percentual do superávit destinado a investimentos" },
  containment_reduction_target: { name: "Meta de Redução", description: "Meta percentual de contenção de despesas" },
  initial_consolidated_balance: { name: "Saldo Inicial Consolidado", description: "Saldo inicial para cálculo do fluxo consolidado" },
  default_patrimony_entity: { name: "Entidade Padrão Patrimônio", description: "Entidade financeira padrão para patrimônio" },
  default_investments_entity: { name: "Entidade Padrão Investimentos", description: "Entidade financeira padrão para investimentos" },
  primary_business_account: { name: "Conta Principal Empresa", description: "Conta bancária principal da empresa" },
};

export function SystemParametersTab() {
  const { data = [], isLoading, create, update, remove } = useSystemParameters();
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SystemParameter | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const filtered = data.filter((p) => p.parameter_key.toLowerCase().includes(search.toLowerCase()));

  const columns: Column<SystemParameter>[] = [
    {
      key: "parameter_key", header: "Parâmetro",
      render: (r) => {
        const label = PARAMETER_LABELS[r.parameter_key];
        return <span className="font-medium">{label?.name || r.parameter_key}</span>;
      },
    },
    {
      key: "description", header: "Descrição",
      render: (r) => {
        const label = PARAMETER_LABELS[r.parameter_key];
        return <span className="text-muted-foreground text-xs">{label?.description || "—"}</span>;
      },
    },
    { key: "parameter_value", header: "Valor", render: (r) => <span className="font-mono text-xs">{r.parameter_value}</span> },
    { key: "value_type", header: "Tipo", render: (r) => <Badge variant="secondary">{typeLabels[r.value_type] || r.value_type}</Badge> },
    {
      key: "actions", header: "Ações", render: (r) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => { setEditing(r); setFormOpen(true); }}><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={() => setDeleting(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </div>
      ),
    },
  ];

  const handleSubmit = (d: Partial<SystemParameter>) => {
    const mutation = d.id ? update : create;
    mutation.mutate(d as any, { onSuccess: () => { setFormOpen(false); setEditing(null); } });
  };

  return (
    <div>
      <PageHeader title="Parâmetros do Sistema" description="Configurações gerais do sistema" actions={
        <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="h-4 w-4 mr-1" />Novo</Button>
      } />
      <FilterBar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Buscar parâmetro..." />
      <DataTable columns={columns} data={filtered as any} loading={isLoading} emptyMessage="Nenhum parâmetro encontrado." />
      <SystemParameterForm open={formOpen} onOpenChange={(o) => { setFormOpen(o); if (!o) setEditing(null); }} parameter={editing} onSubmit={handleSubmit} loading={create.isPending || update.isPending} />
      <DeleteDialog open={!!deleting} onOpenChange={() => setDeleting(null)} onConfirm={() => { if (deleting) remove.mutate(deleting, { onSuccess: () => setDeleting(null) }); }} loading={remove.isPending} />
    </div>
  );
}
