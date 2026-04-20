import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getUserErrorMessage } from "@/lib/errorMessages";
import { subMonths, addMonths, format, parseISO } from "date-fns";

export interface InvestmentClass {
  id: string;
  name: string;
  is_active: boolean;
}

export interface InvestmentSnapshot {
  id: string;
  reference_month: string;
  investment_class_id: string;
  financial_entity_id: string;
  opening_value: number;
  closing_value: number;
  created_at: string;
  updated_at: string;
  investment_classes?: { name: string };
  financial_entities?: { name: string };
}

export function useInvestmentClasses() {
  return useQuery({
    queryKey: ["investment_classes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("investment_classes")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as InvestmentClass[];
    },
  });
}

export function useInvestmentSnapshots(month?: string) {
  return useQuery({
    queryKey: ["investment_snapshots", month],
    queryFn: async () => {
      let query = supabase
        .from("investment_snapshots")
        .select("*, investment_classes(name), financial_entities(name)")
        .order("closing_value", { ascending: false });
      if (month) {
        query = query.eq("reference_month", month);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as InvestmentSnapshot[];
    },
  });
}

/** Helper: get effective closing value for a snapshot, considering next month's opening */
export function getEffectiveClosing(
  snapshot: InvestmentSnapshot,
  allSnapshots: InvestmentSnapshot[]
): number {
  if (snapshot.closing_value > 0) return snapshot.closing_value;
  // Find the next month's opening for the same class+entity
  const nextMonth = format(addMonths(parseISO(snapshot.reference_month), 1), "yyyy-MM-dd");
  const next = allSnapshots.find(
    (s) =>
      s.reference_month === nextMonth &&
      s.investment_class_id === snapshot.investment_class_id &&
      s.financial_entity_id === snapshot.financial_entity_id
  );
  return next?.opening_value ?? snapshot.closing_value;
}

export function usePreviousClosingValue(month?: string, investmentClassId?: string, financialEntityId?: string) {
  return useQuery({
    queryKey: ["prev_closing_investment", month, investmentClassId, financialEntityId],
    enabled: !!month && !!investmentClassId && !!financialEntityId && month.length >= 7,
    queryFn: async () => {
      const prevMonth = format(subMonths(new Date(month + "-01"), 1), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("investment_snapshots" as any)
        .select("closing_value")
        .eq("reference_month", prevMonth)
        .eq("investment_class_id", investmentClassId!)
        .eq("financial_entity_id", financialEntityId!)
        .maybeSingle();
      if (error) throw error;
      return (data as any)?.closing_value as number | null;
    },
  });
}

export function useInvestmentCrud() {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["investment_snapshots"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard_investments"] });
  };

  const normalizeMonth = (data: Partial<InvestmentSnapshot>) => {
    const copy = { ...data };
    if (copy.reference_month && copy.reference_month.length === 7) {
      copy.reference_month = `${copy.reference_month}-01`;
    }
    return copy;
  };

  const create = useMutation({
    mutationFn: async (snapshot: Partial<InvestmentSnapshot>) => {
      const payload = normalizeMonth(snapshot);
      const { error } = await (supabase as any).from("investment_snapshots").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Registro criado com sucesso"); },
    onError: (e: any) => toast.error(getUserErrorMessage(e)),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...data }: Partial<InvestmentSnapshot> & { id: string }) => {
      const payload = normalizeMonth(data);
      const { error } = await (supabase as any).from("investment_snapshots").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Registro atualizado"); },
    onError: (e: any) => toast.error(getUserErrorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("investment_snapshots").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Registro excluído"); },
    onError: (e: any) => toast.error(getUserErrorMessage(e)),
  });

  return { create, update, remove };
}
