import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import type { Transaction } from "@/types/database";

export function useTransactions() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("transactions")
        .select("*, categories(name), financial_entities(name), accounts(name)")
        .order("competence_date", { ascending: false });
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
    onError: (e: any) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Transaction> & { id: string }) => {
      const { categories, financial_entities, accounts, ...rest } = data as any;
      const { error } = await (supabase as any).from("transactions").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Lançamento atualizado");
    },
    onError: (e: any) => toast.error(e.message),
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
    onError: (e: any) => {
      if (e.message?.includes("foreign key") || e.message?.includes("violates")) {
        toast.error("Não é possível excluir: existem registros vinculados.");
      } else {
        toast.error(e.message);
      }
    },
  });

  return { ...query, create, update, remove };
}
