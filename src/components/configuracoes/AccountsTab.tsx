import { useState } from "react";
import { useAccounts } from "@/hooks/useAccounts";
import { useFinancialEntities } from "@/hooks/useFinancialEntities";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { getUserErrorMessage } from "@/lib/errorMessages";
import { toast } from "sonner";
import { FilterBar } from "@/components/shared/FilterBar";
import { DataTable, Column } from "@/components/shared/DataTable";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, RefreshCw } from "lucide-react";
import { AccountForm } from "./AccountForm";
import { DeleteDialog } from "./DeleteDialog";
import type { Account } from "@/types/database";

const typeLabels: Record<string, string> = { checking: "Corrente", savings: "Poupança", investment: "Investimento", cash: "Caixa" };

export function AccountsTab() {
  const { data = [], isLoading, create, update, remove } = useAccounts();
  const { data: entities = [] } = useFinancialEntities();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [recalculating, setRecalculating] = useState(false);

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      const { data: accounts, error: accErr } = await (supabase as any)
        .from("accounts")
        .select("id, opening_balance")
        .eq("is_active", true);
      if (accErr) throw accErr;

      let totalAccounts = 0;
      for (const acc of accounts ?? []) {
        const { data: txns, error: txErr } = await (supabase as any)
          .from("transactions")
          .select("transaction_type, amount")
          .eq("account_id", acc.id)
          .eq("status", "paid");
        if (txErr) throw txErr;

        let balance = Number(acc.opening_balance ?? 0);
        for (const t of txns || []) {
          const amount = Math.abs(Number(t.amount ?? 0));
          if (t.transaction_type === "income") balance += amount;
          if (t.transaction_type === "expense") balance -= amount;
        }

        await (supabase as any)
          .from("accounts")
          .update({ current_balance: balance })
          .eq("id", acc.id);
        totalAccounts++;
      }

      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_account_balances_split"] });
      toast.success(`Saldos recalculados: ${totalAccounts} contas atualizadas`);
    } catch (e: any) {
      toast.error(getUserErrorMessage(e));
    } finally {
      setRecalculating(false);
    }
  };

  const filtered = data.filter((a) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return [a.name, a.bank_name, typeLabels[a.account_type] || a.account_type, a.financial_entities?.name].filter(Boolean).join(" ").toLowerCase().includes(s);
  });

  const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const columns: Column<Account>[] = [
    { key: "name", header: "Nome" },
    { key: "bank_name", header: "Banco", render: (r) => r.bank_name || "—" },
    { key: "account_type", header: "Tipo", render: (r) => typeLabels[r.account_type] || r.account_type },
    { key: "financial_entity", header: "Entidade", render: (r) => r.financial_entities?.name || "—" },
    { key: "current_balance", header: "Saldo Atual", render: (r) => <span className={r.current_balance < 0 ? "text-destructive font-medium" : ""}>{fmt(r.current_balance)}</span> },
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

  const handleSubmit = (data: Partial<Account>) => {
    const mutation = data.id ? update : create;
    mutation.mutate(data as any, { onSuccess: () => { setFormOpen(false); setEditing(null); } });
  };

  return (
    <div>
      <PageHeader title="Contas Bancárias" description="Gerencie suas contas" actions={
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleRecalculate} disabled={recalculating}>
            <RefreshCw className={`h-4 w-4 mr-1 ${recalculating ? "animate-spin" : ""}`} />
            Recalcular Saldos
          </Button>
          <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="h-4 w-4 mr-1" />Nova</Button>
        </div>
      } />
      <FilterBar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Buscar conta..." />
      <DataTable columns={columns} data={filtered as any} loading={isLoading} emptyMessage="Nenhuma conta encontrada." />
      <AccountForm open={formOpen} onOpenChange={(o) => { setFormOpen(o); if (!o) setEditing(null); }} account={editing} entities={entities} onSubmit={handleSubmit} loading={create.isPending || update.isPending} />
      <DeleteDialog open={!!deleting} onOpenChange={() => setDeleting(null)} onConfirm={() => { if (deleting) remove.mutate(deleting, { onSuccess: () => setDeleting(null) }); }} loading={remove.isPending} />
    </div>
  );
}
