import { useState } from "react";
import { useAccounts } from "@/hooks/useAccounts";
import { useFinancialEntities } from "@/hooks/useFinancialEntities";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
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
      // Fetch all active accounts
      const { data: accounts, error: accErr } = await (supabase as any)
        .from("accounts")
        .select("id")
        .eq("is_active", true);
      if (accErr) throw accErr;

      for (const acc of accounts) {
        // Sum paid transactions (income positive, expense negative)
        const { data: txns, error: txErr } = await (supabase as any)
          .from("transactions")
          .select("transaction_type, amount")
          .eq("account_id", acc.id)
          .eq("status", "paid");
        if (txErr) throw txErr;

        let balance = 0;
        for (const t of txns || []) {
          balance += t.transaction_type === "income" ? Number(t.amount) : -Number(t.amount);
        }

        // Subtract paid card installments linked via cards → card_purchases
        const { data: cards, error: cardErr } = await (supabase as any)
          .from("cards")
          .select("id")
          .eq("account_id", acc.id);
        if (cardErr) throw cardErr;

        if (cards && cards.length > 0) {
          const cardIds = cards.map((c: any) => c.id);
          const { data: purchases, error: purErr } = await (supabase as any)
            .from("card_purchases")
            .select("id")
            .in("card_id", cardIds);
          if (purErr) throw purErr;

          if (purchases && purchases.length > 0) {
            const purchaseIds = purchases.map((p: any) => p.id);
            const { data: installments, error: instErr } = await (supabase as any)
              .from("card_installments")
              .select("amount")
              .in("card_purchase_id", purchaseIds)
              .eq("status", "paid");
            if (instErr) throw instErr;

            for (const inst of installments || []) {
              balance -= Number(inst.amount);
            }
          }
        }

        // Update account balance
        const { error: upErr } = await (supabase as any)
          .from("accounts")
          .update({ current_balance: balance })
          .eq("id", acc.id);
        if (upErr) throw upErr;
      }

      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_account_balances_split"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_monthly_flow_view"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_cashflow_chart"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_patrimony"] });
      toast.success("Saldos recalculados com sucesso");
    } catch (e: any) {
      toast.error(e.message || "Erro ao recalcular saldos");
    } finally {
      setRecalculating(false);
    }
  };

  const filtered = data.filter((a) => a.name.toLowerCase().includes(search.toLowerCase()));

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
