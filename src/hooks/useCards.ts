import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { getUserErrorMessage } from "@/lib/errorMessages";
import type { Card } from "@/types/database";

export function useCards() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["cards"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("cards")
        .select("*, financial_entities(name)")
        .order("name");
      if (error) throw error;
      return data as Card[];
    },
  });

  const create = useMutation({
    mutationFn: async (item: Partial<Card>) => {
      const { financial_entities, ...rest } = item as any;
      const { error } = await (supabase as any).from("cards").insert(rest);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cards"] });
      toast.success("Cartão criado com sucesso");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Card> & { id: string }) => {
      const { financial_entities, ...rest } = data as any;
      const { error } = await (supabase as any).from("cards").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cards"] });
      toast.success("Cartão atualizado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("cards").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cards"] });
      toast.success("Cartão excluído");
    },
    onError: (e: any) => {
      if (e.message?.includes("foreign key") || e.message?.includes("violates")) {
        toast.error("Não é possível excluir: existem registros vinculados a este cartão.");
      } else {
        toast.error(e.message);
      }
    },
  });

  return { ...query, create, update, remove };
}
