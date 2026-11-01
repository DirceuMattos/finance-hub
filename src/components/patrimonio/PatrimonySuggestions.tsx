import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDownToLine, CheckCircle2, ChevronDown, ChevronUp, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabaseClient";
import { useInvestmentSnapshots } from "@/hooks/useInvestments";
import { useAccounts } from "@/hooks/useAccounts";
import { useReconciliationData } from "@/hooks/useReconciliation";
import { useStatementBalances } from "@/hooks/useStatementBalances";
import { reconcileMonth } from "@/lib/reconciliation";
import { buildSuggestions, type AccBalance, type PatItem } from "@/lib/patrimonySync";

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

/**
 * Sugere o fechamento de itens do Patrimônio a partir de Investimentos e dos saldos das contas
 * (regra oficial, último dia do mês). Nada é gravado sem confirmação.
 */
export function PatrimonySuggestions({ month, items }: { month: string; items: PatItem[] }) {
  const ym = month.slice(0, 7);
  const qc = useQueryClient();
  const { data: inv = [] } = useInvestmentSnapshots(month);
  const { data: accounts = [] } = useAccounts();
  const { data: recon } = useReconciliationData();
  const { balances } = useStatementBalances();
  const [open, setOpen] = useState(true);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const suggestions = useMemo(() => {
    if (!recon) return [];
    const accBalances: AccBalance[] = accounts
      .filter((a: any) => a.is_active)
      .map((a: any) => {
        const ra = recon.accounts.find((r) => r.id === a.id);
        const end = ra ? reconcileMonth(ra, recon.byAccount.get(a.id) || [], ym).endBalance : Number(a.current_balance) || 0;
        const k = `${a.id}_${ym}`;
        return { id: a.id, name: a.name, type: a.account_type ?? null, financial_entity_id: a.financial_entity_id, endBalance: end, statement: balances.has(k) ? balances.get(k)! : null };
      });
    return buildSuggestions({
      items,
      investments: inv.map((s: any) => ({ className: s.investment_classes?.name ?? "", financial_entity_id: s.financial_entity_id, closing_value: s.closing_value })),
      accounts: accBalances,
    });
  }, [items, inv, accounts, recon, balances, ym]);

  const toApply = suggestions.filter((s) => s.differs);
  if (!toApply.length) return null;
  const ready = toApply.filter((s) => s.complete);

  const apply = async (ids: string[]) => {
    setSaving(true);
    try {
      for (const id of ids) {
        const s = suggestions.find((x) => x.itemId === id)!;
        const { data, error } = await (supabase as any).from("patrimony_snapshots").update({ closing_value: s.suggested }).eq("id", id).select("id");
        if (error) throw error;
        if (!data?.length) throw new Error(`"${s.itemName}" não foi alterado. Verifique as permissões.`);
      }
      qc.invalidateQueries({ queryKey: ["patrimony_snapshots"] });
      qc.invalidateQueries({ queryKey: ["vw_patrimony_evolution"] });
      toast.success(`${ids.length} fechamento(s) aplicado(s).`);
      setConfirmId(null);
    } catch (e: any) {
      toast.error("Não foi possível aplicar: " + (e?.message || "erro"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="mb-4 border-sky-500/40">
      <CardContent className="p-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button className="flex items-center gap-2 text-sm font-medium" onClick={() => setOpen((v) => !v)}>
            <ArrowDownToLine className="h-4 w-4 text-sky-600" />
            {toApply.length} fechamento(s) sugerido(s) a partir de Investimentos e das contas
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {ready.length > 0 && (
            confirmId === "__all"
              ? <span className="flex items-center gap-2 text-xs">Aplicar {ready.length} conferido(s)?
                  <Button size="sm" className="h-7" onClick={() => apply(ready.map((s) => s.itemId))} disabled={saving}>Confirmar</Button>
                  <Button size="sm" variant="outline" className="h-7" onClick={() => setConfirmId(null)} disabled={saving}>Voltar</Button></span>
              : <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setConfirmId("__all")} disabled={saving}>Aplicar os conferidos ({ready.length})</Button>
          )}
        </div>
        {open && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead><tr className="text-xs text-muted-foreground border-b">
                <th className="text-left py-1 font-medium">Item</th><th className="text-right font-medium">Atual</th><th className="text-right font-medium">Sugerido</th>
                <th className="text-left pl-3 font-medium">Origem</th><th></th>
              </tr></thead>
              <tbody>
                {toApply.map((s) => (
                  <tr key={s.itemId} className="border-b last:border-0 align-top">
                    <td className="py-1.5">{s.itemName}</td>
                    <td className="text-right font-mono text-xs text-muted-foreground">{s.current === null ? "Em aberto" : fmt(s.current)}</td>
                    <td className="text-right font-mono text-xs font-medium">{fmt(s.suggested)}</td>
                    <td className="pl-3 text-[11px] text-muted-foreground max-w-[320px]">
                      <span className="block truncate" title={s.sources.join(" + ")}>{s.sources.join(" + ") || "—"}</span>
                      {s.complete
                        ? <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="h-3 w-3" />conferido</span>
                        : s.pending.map((p) => <span key={p} className="block text-amber-700 dark:text-amber-400">{p}</span>)}
                    </td>
                    <td className="text-right whitespace-nowrap pl-2">
                      {confirmId === s.itemId
                        ? <span className="inline-flex gap-1">
                            <Button size="sm" className="h-7 text-xs" onClick={() => apply([s.itemId])} disabled={saving}>Confirmar</Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setConfirmId(null)} disabled={saving}>Voltar</Button></span>
                        : <Button size="sm" variant={s.complete ? "secondary" : "ghost"} className="h-7 text-xs" onClick={() => setConfirmId(s.itemId)} disabled={saving}>Aplicar</Button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[11px] text-muted-foreground mt-1 flex items-start gap-1">
              <Info className="h-3 w-3 mt-0.5 shrink-0" />
              Contas: saldo do app no último dia do mês (regra oficial); "conferido" quando o saldo do extrato foi informado na Conciliação e bate.
              Investimentos: fechamento lançado no mês. Nada é gravado sem confirmar.
            </p>
          </div>
        )}
        {!open && <Badge variant="outline" className="text-[10px]">{ready.length} conferido(s) · {toApply.length - ready.length} com pendência</Badge>}
      </CardContent>
    </Card>
  );
}
