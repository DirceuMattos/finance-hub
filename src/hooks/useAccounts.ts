import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { getUserErrorMessage } from "@/lib/errorMessages";
import type { Account } from "@/types/database";

export function useAccounts() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("accounts")
        .select("*, financial_entities(name)")
        .order("name");
      if (error) throw error;
      return data as Account[];
    },
  });

  const create = useMutation({
    mutationFn: async (item: Partial<Account>) => {
      const { financial_entities, ...rest } = item as any;
      const { error } = await (supabase as any).from("accounts").insert(rest);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Conta criada com sucesso");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Account> & { id: string }) => {
      const { financial_entities, ...rest } = data as any;
      const { error } = await (supabase as any).from("accounts").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Conta atualizada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("accounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Conta excluída");
    },
    onError: (e: any) => {
      if (e.message?.includes("foreign key") || e.message?.includes("violates")) {
        toast.error("Não é possível excluir: existem registros vinculados a esta conta.");
      } else {
        toast.error(e.message);
      }
    },
  });

  return { ...query, create, update, remove };
}
