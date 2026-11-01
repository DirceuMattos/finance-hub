import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";

export interface StatementBalance { account_id: string; month: string; balance: number }

const key = ["account_statement_balances"];

/** Saldo do extrato digitado na Conciliação, gravado no banco por conta e mês. */
export function useStatementBalances() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("account_statement_balances")
        .select("account_id, month, balance");
      if (error) throw error;
      const map = new Map<string, number>();
      (data || []).forEach((r: any) => map.set(`${r.account_id}_${String(r.month).slice(0, 7)}`, Number(r.balance)));
      return map;
    },
    retry: false,
  });

  const save = useMutation({
    mutationFn: async ({ accountId, month, balance }: { accountId: string; month: string; balance: number | null }) => {
      const m = `${month}-01`;
      if (balance === null) {
        const { error } = await (supabase as any).from("account_statement_balances").delete().eq("account_id", accountId).eq("month", m);
        if (error) throw error;
        return;
      }
      const { error } = await (supabase as any)
        .from("account_statement_balances")
        .upsert({ account_id: accountId, month: m, balance, updated_at: new Date().toISOString() }, { onConflict: "account_id,month" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  // Tabela ainda não criada (migração pendente): a tela volta a guardar só no navegador.
  const missing = !!query.error && /account_statement_balances|42P01|PGRST205|does not exist/i.test(String((query.error as any)?.message ?? (query.error as any)?.code ?? ""));
  return { balances: query.data ?? new Map<string, number>(), loading: query.isLoading, missing, save };
}
