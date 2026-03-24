import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { getUserErrorMessage } from "@/lib/errorMessages";
import type { FinancialEntity } from "@/types/database";

export function useFinancialEntities() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["financial_entities"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("financial_entities")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as FinancialEntity[];
    },
  });

  const create = useMutation({
    mutationFn: async (entity: Partial<FinancialEntity>) => {
      const { error } = await (supabase as any).from("financial_entities").insert(entity);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial_entities"] });
      toast.success("Entidade criada com sucesso");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...data }: Partial<FinancialEntity> & { id: string }) => {
      const { error } = await (supabase as any).from("financial_entities").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial_entities"] });
      toast.success("Entidade atualizada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("financial_entities").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial_entities"] });
      toast.success("Entidade excluída");
    },
    onError: (e: any) => {
      if (e.message?.includes("foreign key") || e.message?.includes("violates")) {
        toast.error("Não é possível excluir: existem registros vinculados a esta entidade.");
      } else {
        toast.error(e.message);
      }
    },
  });

  return { ...query, create, update, remove };
}
