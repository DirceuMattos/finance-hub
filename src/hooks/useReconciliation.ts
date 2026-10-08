import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import type { ReconAccount, ReconTransaction } from "@/lib/reconciliation";

const PAGE = 1000;

/** Lançamentos com conta bancária (pagos e previstos), paginados para não esbarrar no limite de 1000 linhas da API. */
async function fetchAccountTransactions(): Promise<(ReconTransaction & { account_id: string })[]> {
  const out: (ReconTransaction & { account_id: string })[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await (supabase as any)
      .from("transactions")
      .select("id, account_id, description, amount, transaction_type, status, payment_date, competence_date, due_date, center_cost, payee, categories(name)")
      .not("account_id", "is", null)
      .in("status", ["paid", "planned"])
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data || []) as any[];
    rows.forEach((r) => out.push({ ...r, amount: Number(r.amount) || 0, category: r.categories?.name ?? null }));
    if (rows.length < PAGE) break;
  }
  return out;
}

async function fetchAccounts(): Promise<ReconAccount[]> {
  const { data, error } = await (supabase as any)
    .from("accounts")
    .select("id, name, opening_balance, opening_balance_date, current_balance, is_active")
    .eq("is_active", true)
    .order("name");
  if (error) throw error;
  return ((data || []) as any[]).map((a) => ({
    ...a,
    opening_balance: Number(a.opening_balance) || 0,
    current_balance: Number(a.current_balance) || 0,
  }));
}

export function useReconciliationData() {
  return useQuery({
    queryKey: ["reconciliation_data"],
    staleTime: 0,
    queryFn: async () => {
      const [accounts, transactions] = await Promise.all([fetchAccounts(), fetchAccountTransactions()]);
      const byAccount = new Map<string, ReconTransaction[]>();
      transactions.forEach((t) => {
        const list = byAccount.get(t.account_id) || [];
        list.push(t);
        byAccount.set(t.account_id, list);
      });
      return { accounts, byAccount };
    },
  });
}
