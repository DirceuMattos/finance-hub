import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { getUserErrorMessage } from "@/lib/errorMessages";
import type { SystemParameter } from "@/types/database";

export function useSystemParameters() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["system_parameters"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("system_parameters")
        .select("*")
        .order("parameter_key");
      if (error) throw error;
      return data as SystemParameter[];
    },
  });

  const create = useMutation({
    mutationFn: async (item: Partial<SystemParameter>) => {
      const { error } = await (supabase as any).from("system_parameters").insert(item);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system_parameters"] });
      toast.success("Parâmetro criado com sucesso");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...data }: Partial<SystemParameter> & { id: string }) => {
      const { error } = await (supabase as any).from("system_parameters").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system_parameters"] });
      toast.success("Parâmetro atualizado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("system_parameters").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system_parameters"] });
      toast.success("Parâmetro excluído");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return { ...query, create, update, remove };
}
