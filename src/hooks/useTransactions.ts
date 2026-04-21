import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { getUserErrorMessage } from "@/lib/errorMessages";
import type { Transaction } from "@/types/database";

function getMonthRange(monthStr: string) {
  const [y, m] = monthStr.split("-").map(Number);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const endMonth = m === 12 ? 1 : m + 1;
  const endYear = m === 12 ? y + 1 : y;
  const end = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;
  return { start, end };
}

export function useTransactions(filterMonth?: string) {
  const queryClient = useQueryClient();
  const editableFields = [
    "description",
    "transaction_type",
    "card_id",
    "category_id",
    "financial_entity_id",
    "account_id",
    "amount",
    "competence_date",
    "due_date",
    "payment_date",
    "status",
    "payee",
    "notes",
    "payment_method",
    "installment_number",
    "installment_total",
    "center_cost",
  ] as const;

  const recalcBalances = async () => {
    try {
      await (supabase as any).rpc("recalculate_account_balances");
    } catch { /* silently ignore */ }
  };

  const query = useQuery({
    queryKey: ["transactions", filterMonth],
    queryFn: async () => {
      let q = (supabase as any)
        .from("transactions")
        .select("id, description, transaction_type, card_id, category_id, financial_entity_id, account_id, amount, competence_date, due_date, payment_date, status, installment_number, installment_total, payment_method, source_type, source_id, payee, tags, notes, created_at, updated_at, center_cost, categories(name), financial_entities(name, entity_type), accounts(name)")
        .order("competence_date", { ascending: false });

      if (filterMonth && filterMonth !== "all") {
        const { start, end } = getMonthRange(filterMonth);
        q = q.or(`and(due_date.gte.${start},due_date.lt.${end}),and(competence_date.gte.${start},competence_date.lt.${end})`);
      } else {
        q = q.limit(500);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data as Transaction[];
    },
  });

  const recalcAccountBalance = async (accountId?: string | null) => {
    if (!accountId) return;
    try {
      const { data: txns } = await (supabase as any)
        .from("transactions")
        .select("transaction_type, amount")
        .eq("account_id", accountId)
        .eq("status", "paid");
      const { data: acc } = await (supabase as any)
        .from("accounts")
        .select("opening_balance")
        .eq("id", accountId)
        .single();
      if (!txns || !acc) return;
      let balance = Number(acc.opening_balance ?? 0);
      for (const t of txns) {
        const amount = Math.abs(Number(t.amount ?? 0));
        if (t.transaction_type === "income") balance += amount;
        if (t.transaction_type === "expense") balance -= amount;
      }
      await (supabase as any).from("accounts").update({ current_balance: balance }).eq("id", accountId);
    } catch { /* silently ignore */ }
  };

  const create = useMutation({
    mutationFn: async (item: Partial<Transaction> & { installments_count?: number }) => {
      const { categories, financial_entities, accounts, installments_count, ...rest } = item as any;
      const N = Math.max(1, Math.floor(Number(installments_count) || 1));

      if (N <= 1) {
        const { error } = await (supabase as any).from("transactions").insert(rest);
        if (error) throw error;
        return;
      }

      // Generate N installments
      const totalAmount = Number(rest.amount) || 0;
      const baseCents = Math.floor((totalAmount * 100) / N);
      const remainderCents = Math.round(totalAmount * 100) - baseCents * N;
      const baseDescription = String(rest.description || "").replace(/\s*\(\d+\/\d+\)\s*$/, "");

      const addMonthsKeepDay = (isoDate: string, monthsToAdd: number): string => {
        const [y, m, d] = isoDate.split("-").map(Number);
        const target = new Date(y, m - 1 + monthsToAdd, 1);
        const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
        const day = Math.min(d, lastDay);
        const yy = target.getFullYear();
        const mm = String(target.getMonth() + 1).padStart(2, "0");
        const dd = String(day).padStart(2, "0");
        return `${yy}-${mm}-${dd}`;
      };

      const rows = Array.from({ length: N }, (_, i) => {
        const installmentNumber = i + 1;
        const isLast = installmentNumber === N;
        const cents = baseCents + (isLast ? remainderCents : 0);
        const amount = Number((cents / 100).toFixed(2));

        const due = rest.due_date ? addMonthsKeepDay(rest.due_date, i) : null;
        const competence = rest.competence_date ? addMonthsKeepDay(rest.competence_date, i) : null;

        return {
          ...rest,
          description: `${baseDescription} (${installmentNumber}/${N})`,
          amount,
          installment_number: installmentNumber,
          installment_total: N,
          due_date: due,
          competence_date: competence,
          status: "planned",
          payment_date: null,
        };
      });

      const { error } = await (supabase as any).from("transactions").insert(rows);
      if (error) throw error;
    },
    onSuccess: async (_data, variables) => {
      await recalcBalances();
      void recalcAccountBalance((variables as any)?.account_id);
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_monthly_flow_view"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_account_balances_split"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_expenses_category"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_cashflow_chart"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_patrimony"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_investments"] });
      toast.success("Lançamento criado com sucesso");
    },
    onError: (e: any) => toast.error(getUserErrorMessage(e)),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Transaction> & { id: string }) => {
      const sanitized = Object.fromEntries(
        Object.entries(data as Record<string, unknown>).filter(([key, value]) => editableFields.includes(key as (typeof editableFields)[number]) && value !== undefined)
      );
      const { data: updated, error } = await (supabase as any).from("transactions").update(sanitized).eq("id", id).select();
      if (error) throw error;
      if (!updated || updated.length === 0) throw new Error("Nenhum registro foi atualizado. Verifique as permissões.");
    },
    onSuccess: async (_data, variables) => {
      await recalcBalances();
      void recalcAccountBalance((variables as any)?.account_id);
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_monthly_flow_view"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_account_balances_split"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_expenses_category"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_cashflow_chart"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_patrimony"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_investments"] });
      toast.success("Lançamento atualizado");
    },
    onError: (e: any) => toast.error(getUserErrorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await recalcBalances();
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_monthly_flow_view"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_account_balances_split"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_expenses_category"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_cashflow_chart"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_patrimony"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_investments"] });
      toast.success("Lançamento excluído");
    },
    onError: (e: any) => toast.error(getUserErrorMessage(e)),
  });

  return { ...query, create, update, remove };
}
