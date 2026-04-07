import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { getUserErrorMessage } from "@/lib/errorMessages";

export interface Recurrence {
  id: string;
  description: string;
  amount: number;
  frequency: string;
  type: string;
  category_id: string | null;
  financial_entity_id: string | null;
  account_id: string | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  payee: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  categories?: { name: string } | null;
  financial_entities?: { name: string; entity_type: string } | null;
  accounts?: { name: string } | null;
}

export function useRecurrences() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["recurrences"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("recurrences")
        .select("*, categories(name), financial_entities(name, entity_type), accounts(name)")
        .order("description");
      if (error) throw error;
      return data as Recurrence[];
    },
  });

  const create = useMutation({
    mutationFn: async (item: Partial<Recurrence>) => {
      const { categories, financial_entities, accounts, ...rest } = item as any;
      const { error } = await (supabase as any).from("recurrences").insert(rest);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurrences"] });
      toast.success("Recorrência criada com sucesso");
    },
    onError: (e: any) => toast.error(getUserErrorMessage(e)),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Recurrence> & { id: string }) => {
      const { categories, financial_entities, accounts, ...rest } = data as any;
      const { data: updated, error } = await (supabase as any).from("recurrences").update(rest).eq("id", id).select();
      if (error) throw error;
      if (!updated || updated.length === 0) throw new Error("Nenhum registro foi atualizado. Verifique as permissões.");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurrences"] });
      toast.success("Recorrência atualizada");
    },
    onError: (e: any) => toast.error(getUserErrorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("recurrences").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurrences"] });
      toast.success("Recorrência excluída");
    },
    onError: (e: any) => toast.error(getUserErrorMessage(e)),
  });

  return { ...query, create, update, remove };
}
