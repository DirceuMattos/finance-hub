import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
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
    onError: (e: any) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...data }: Partial<CardPurchase> & { id: string }) => {
      const { cards, categories, financial_entities, ...rest } = data as any;
      const { error } = await (supabase as any).from("card_purchases").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["card_purchases"] });
      queryClient.invalidateQueries({ queryKey: ["card_installments"] });
      queryClient.invalidateQueries({ queryKey: ["card_billing_projection"] });
      toast.success("Compra atualizada");
    },
    onError: (e: any) => toast.error(e.message),
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
    onError: (e: any) => {
      if (e.message?.includes("foreign key") || e.message?.includes("violates")) {
        toast.error("Não é possível excluir: existem parcelas vinculadas.");
      } else {
        toast.error(e.message);
      }
    },
  });

  return { ...query, create, update, remove };
}
