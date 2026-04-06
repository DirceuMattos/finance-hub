import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { getUserErrorMessage } from "@/lib/errorMessages";
import type { CardPurchase } from "@/types/database";

export function useCardPurchases() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["card_purchases"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("card_purchases")
        .select("*, cards(name), categories(name), financial_entities(name)")
        .order("purchase_date", { ascending: false });
      if (error) throw error;
      return data as CardPurchase[];
    },
  });

  const create = useMutation({
    mutationFn: async (item: Partial<CardPurchase>) => {
      const { cards, categories, financial_entities, ...rest } = item as any;
      const { error } = await (supabase as any).from("card_purchases").insert(rest);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["card_purchases"] });
      queryClient.invalidateQueries({ queryKey: ["card_installments"] });
      queryClient.invalidateQueries({ queryKey: ["card_billing_projection"] });
      toast.success("Compra registrada com sucesso");
    },
    onError: (e: any) => toast.error(getUserErrorMessage(e)),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...data }: Partial<CardPurchase> & { id: string }) => {
      const { cards, categories, financial_entities, ...rest } = data as any;
      const { data: updated, error } = await (supabase as any).from("card_purchases").update(rest).eq("id", id).select();
      if (error) throw error;
      if (!updated || updated.length === 0) throw new Error("Nenhum registro foi atualizado. Verifique as permissões.");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["card_purchases"] });
      queryClient.invalidateQueries({ queryKey: ["card_installments"] });
      queryClient.invalidateQueries({ queryKey: ["card_billing_projection"] });
      toast.success("Compra atualizada");
    },
    onError: (e: any) => toast.error(getUserErrorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("card_purchases").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["card_purchases"] });
      queryClient.invalidateQueries({ queryKey: ["card_installments"] });
      queryClient.invalidateQueries({ queryKey: ["card_billing_projection"] });
      toast.success("Compra excluída");
    },
    onError: (e: any) => toast.error(getUserErrorMessage(e)),
  });

  return { ...query, create, update, remove };
}
