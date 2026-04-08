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

  const query = useQuery({
    queryKey: ["transactions", filterMonth],
    queryFn: async () => {
      let q = (supabase as any)
        .from("transactions")
        .select("*, categories(name), financial_entities(name, entity_type), accounts(name)")
        .order("competence_date", { ascending: false });

      if (filterMonth && filterMonth !== "all") {
        const { start, end } = getMonthRange(filterMonth);
        // Filter: due_date in month OR (due_date is null AND competence_date in month)
        q = q.or(`and(due_date.gte.${start},due_date.lt.${end}),and(due_date.is.null,competence_date.gte.${start},competence_date.lt.${end})`);
      } else {
        q = q.limit(5000);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data as Transaction[];
    },
  });

  const create = useMutation({
    mutationFn: async (item: Partial<Transaction>) => {
      const { categories, financial_entities, accounts, ...rest } = item as any;
      const { error } = await (supabase as any).from("transactions").insert(rest);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Lançamento criado com sucesso");
    },
    onError: (e: any) => toast.error(getUserErrorMessage(e)),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Transaction> & { id: string }) => {
      const { categories, financial_entities, accounts, ...rest } = data as any;
      const { data: updated, error } = await (supabase as any).from("transactions").update(rest).eq("id", id).select();
      if (error) throw error;
      if (!updated || updated.length === 0) throw new Error("Nenhum registro foi atualizado. Verifique as permissões.");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Lançamento atualizado");
    },
    onError: (e: any) => toast.error(getUserErrorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Lançamento excluído");
    },
    onError: (e: any) => toast.error(getUserErrorMessage(e)),
  });

  return { ...query, create, update, remove };
}
