import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import type { ReimbursementTx } from "@/lib/reimbursement";

/** Id da categoria "Reembolsos" (null se não existir). */
export function useReimbursementCategoryId(enabled = true) {
  return useQuery({
    queryKey: ["category_reembolsos"],
    enabled,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("categories")
        .select("id")
        .eq("name", "Reembolsos")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data?.id as string) ?? null;
    },
  });
}

/**
 * Receitas da categoria Reembolsos com vencimento no intervalo [from, to].
 * O vínculo com cada cartão/fatura é feito na tela com isReimbursementOf.
 */
export function useCardReimbursements(from: string, to: string, enabled = true) {
  const { data: categoryId = null, isLoading: loadingCat } = useReimbursementCategoryId(enabled);
  const query = useQuery({
    queryKey: ["card_reimbursements", from, to, categoryId],
    enabled: enabled && !!categoryId,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("transactions")
        .select("id, description, notes, amount, due_date, status, payment_date, account_id")
        .eq("category_id", categoryId)
        .eq("transaction_type", "income")
        .in("status", ["planned", "paid"])
        .gte("due_date", from)
        .lte("due_date", to)
        .order("due_date");
      if (error) throw error;
      return (data || []) as ReimbursementTx[];
    },
  });
  return { ...query, categoryId, isLoading: loadingCat || query.isLoading };
}
