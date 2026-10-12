import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { getUserErrorMessage } from "@/lib/errorMessages";
import type { MatchRule } from "@/lib/statementMatching";

export interface StatementImport {
  id: string;
  account_id: string;
  file_name: string;
  file_hash: string;
  source: string;
  period_start: string | null;
  period_end: string | null;
  ledger_balance: number | null;
  ledger_date: string | null;
  line_count: number;
  balance_before: number | null;
  balance_after: number | null;
  status: "aplicada" | "desfeita";
  created_at: string;
  undone_at: string | null;
}

export interface ApplyPayload {
  import: Record<string, unknown>;
  lines: Record<string, unknown>[];
  actions: Record<string, unknown>[];
}

const INVALIDATE = ["reconciliation_data", "transactions", "accounts", "statement_imports", "reconciliation_rules",
  "dashboard_account_balances_split", "dashboard_outlook", "card_invoice_transactions"];

export function useReconciliationRules() {
  return useQuery({
    queryKey: ["reconciliation_rules"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("reconciliation_rules")
        .select("id, pattern, description, category_id, transaction_type, account_id");
      if (error) throw error;
      return (data || []) as (MatchRule & { account_id: string | null })[];
    },
  });
}

export function useStatementImports(accountId: string | null) {
  return useQuery({
    queryKey: ["statement_imports", accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("statement_imports")
        .select("*")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false })
        .limit(24);
      if (error) throw error;
      return (data || []) as StatementImport[];
    },
  });
}

/** Previstos sem conta definida, para sugerir baixa (os com conta já vêm nos dados da conciliação). */
export function useUnassignedPlanned(from: string | null, to: string | null) {
  return useQuery({
    queryKey: ["unassigned_planned", from, to],
    enabled: !!from && !!to,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("transactions")
        .select("id, description, amount, transaction_type, status, payment_date, competence_date, due_date, center_cost, account_id")
        .eq("status", "planned")
        .is("account_id", null)
        .gte("due_date", from)
        .lte("due_date", to)
        .limit(1000);
      if (error) throw error;
      return (data || []).map((t: any) => ({ ...t, amount: Number(t.amount) || 0 }));
    },
  });
}

export async function findAppliedImport(accountId: string, hash: string): Promise<StatementImport | null> {
  const { data, error } = await (supabase as any)
    .from("statement_imports")
    .select("*")
    .eq("account_id", accountId)
    .eq("file_hash", hash)
    .eq("status", "aplicada")
    .maybeSingle();
  if (error) throw error;
  return data as StatementImport | null;
}

export function useApplyReconciliation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: ApplyPayload) => {
      const { data, error } = await (supabase as any).rpc("apply_statement_reconciliation", {
        p_import: p.import, p_lines: p.lines, p_actions: p.actions,
      });
      if (error) throw error;
      return data as { import_id: string; balance_before: number; balance_after: number; actions: Record<string, number> };
    },
    onSuccess: () => INVALIDATE.forEach((k) => qc.invalidateQueries({ queryKey: [k] })),
    onError: (e: any) => toast.error("Não foi possível aplicar: " + getUserErrorMessage(e)),
  });
}

export function useUndoReconciliation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (importId: string) => {
      const { data, error } = await (supabase as any).rpc("undo_statement_reconciliation", { p_import_id: importId });
      if (error) throw error;
      return data as { undone: number; changed_after_apply: number; balance: number };
    },
    onSuccess: (d) => {
      INVALIDATE.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      toast.success(`Conciliação desfeita (${d.undone} ação(ões)).${d.changed_after_apply ? ` Atenção: ${d.changed_after_apply} lançamento(s) tinham sido alterados depois.` : ""}`);
    },
    onError: (e: any) => toast.error("Não foi possível desfazer: " + getUserErrorMessage(e)),
  });
}
