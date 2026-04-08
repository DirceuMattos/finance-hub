import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { getUserErrorMessage } from "@/lib/errorMessages";

export interface InvestmentClassRow {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useInvestmentClassesCrud() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["investment_classes"] });

  const query = useQuery({
    queryKey: ["investment_classes"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("investment_classes")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as InvestmentClassRow[];
    },
  });

  const create = useMutation({
    mutationFn: async (row: Partial<InvestmentClassRow>) => {
      const { error } = await (supabase as any).from("investment_classes").insert(row);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Classe criada com sucesso"); },
    onError: (e: any) => toast.error(getUserErrorMessage(e)),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...data }: Partial<InvestmentClassRow> & { id: string }) => {
      const { error } = await (supabase as any).from("investment_classes").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Classe atualizada"); },
    onError: (e: any) => toast.error(getUserErrorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("investment_classes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Classe excluída"); },
    onError: (e: any) => toast.error(getUserErrorMessage(e)),
  });

  return { data: query.data ?? [], isLoading: query.isLoading, create, update, remove };
}
