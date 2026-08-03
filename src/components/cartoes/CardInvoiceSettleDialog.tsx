import { useState, useEffect, useMemo } from "react";
import { format, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { CheckSquare, Square, CalendarClock, Banknote } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cardId: string;
  cardName: string;
  dueDay: number;
  referenceMonth: string; // "yyyy-MM-dd"
}

interface InvoiceItem {
  id: string;
  description: string;
  amount: number;
  due_date: string;
  installment_number: number | null;
  installment_total: number | null;
  account_id: string | null;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export function CardInvoiceSettleDialog({
  open,
  onOpenChange,
  cardId,
  cardName,
  dueDay,
  referenceMonth,
}: Props) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reschedule, setReschedule] = useState<Record<string, string>>({});
  const [paymentDate, setPaymentDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [saving, setSaving] = useState(false);

  // Compute next due date (same day, next month)
  const [y, m] = referenceMonth.split("-").map(Number);
  const nextDueDate = useMemo(() => {
    const next = addMonths(new Date(y, m - 1, 1), 1);
    return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(dueDay).padStart(2, "0")}`;
  }, [y, m, dueDay]);

  // Cycle window: from day 26 of previous month to due_day of current month
  const cycleStart = useMemo(() => {
    const prev = addMonths(new Date(y, m - 1, 1), -1);
    return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}-26`;
  }, [y, m]);
  const cycleEnd = useMemo(() => {
    return `${y}-${String(m).padStart(2, "0")}-${String(dueDay).padStart(2, "0")}`;
  }, [y, m, dueDay]);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["card_invoice_items", cardName, referenceMonth],
    enabled: open,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("transactions")
        .select("id, description, amount, due_date, installment_number, installment_total, account_id")
        .eq("center_cost", cardName)
        .eq("status", "planned")
        .gte("due_date", cycleStart)
        .lte("due_date", cycleEnd)
        .order("due_date")
        .order("description");
      if (error) throw error;
      return (data || []) as InvoiceItem[];
    },
  });

  // Select all by default when items load
  useEffect(() => {
    if (items.length > 0) {
      setSelected(new Set(items.map((i) => i.id)));
      const defaults: Record<string, string> = {};
      items.forEach((i) => { defaults[i.id] = nextDueDate; });
      setReschedule(defaults);
    }
  }, [items, nextDueDate]);

  const totalSelected = useMemo(
    () => items.filter((i) => selected.has(i.id)).reduce((s, i) => s + i.amount, 0),
    [items, selected]
  );

  const totalNotSelected = useMemo(
    () => items.filter((i) => !selected.has(i.id)).reduce((s, i) => s + i.amount, 0),
    [items, selected]
  );

  const toggleAll = () => {
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((i) => i.id)));
    }
  };

  const handleConfirm = async () => {
    if (selected.size === 0 && items.filter((i) => !selected.has(i.id)).length === 0) {
      toast.info("Nenhum lançamento para processar.");
      return;
    }
    setSaving(true);
    try {
      // 1. Settle selected items (mark as paid)
      const toSettle = items.filter((i) => selected.has(i.id));
      if (toSettle.length > 0) {
        const updates = toSettle.map((i) => ({
          id: i.id,
          status: "paid",
          payment_date: paymentDate,
          amount: i.amount,
          account_id: i.account_id,
        }));
        for (const upd of updates) {
          const { error } = await (supabase as any)
            .from("transactions")
            .update({
              status: upd.status,
              payment_date: upd.payment_date,
            })
            .eq("id", upd.id);
          if (error) throw error;
        }
      }

      // 2. Reschedule unselected items
      const toReschedule = items.filter((i) => !selected.has(i.id));
      for (const item of toReschedule) {
        const newDate = reschedule[item.id] || nextDueDate;
        const [ny, nm] = newDate.split("-").map(Number);
        const newCompetence = `${ny}-${String(nm).padStart(2, "0")}-01`;
        const { error } = await (supabase as any)
          .from("transactions")
          .update({
            due_date: newDate,
            competence_date: newCompetence,
          })
          .eq("id", item.id);
        if (error) throw error;
      }

      // 3. Recalculate balances
      await (supabase as any).rpc("recalculate_account_balances_from_date", {
        p_from_date: "2026-04-01",
      });

      // 4. Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["card_cycle_totals"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_account_balances_split"] });
      queryClient.invalidateQueries({ queryKey: ["card_invoice_items"] });

      const settledCount = toSettle.length;
      const rescheduledCount = toReschedule.length;
      let msg = "";
      if (settledCount > 0) msg += `${settledCount} lançamento(s) baixado(s). `;
      if (rescheduledCount > 0) msg += `${rescheduledCount} reagendado(s).`;
      toast.success(msg || "Fatura processada com sucesso.");
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Erro ao processar fatura: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const monthLabel = format(new Date(y, m - 1, 1), "MMMM yyyy", { locale: ptBR })
    .replace(/^\w/, (c) => c.toUpperCase());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-primary" />
            Quitar Fatura — {cardName}
            <Badge variant="outline" className="text-xs ml-1">{monthLabel}</Badge>
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Ciclo: {cycleStart.split("-").reverse().join("/")} até {cycleEnd.split("-").reverse().join("/")}
          </p>
        </DialogHeader>

        {/* Payment date */}
        <div className="flex items-center gap-3 py-2 border-b">
          <Label className="whitespace-nowrap text-sm">Data do Pagamento:</Label>
          <Input
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            className="w-44 h-8 text-sm"
          />
        </div>

        {/* Items list */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8 text-sm">Carregando...</p>
          ) : items.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">
              Nenhum lançamento pendente neste ciclo.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b sticky top-0 bg-background">
                <tr>
                  <th className="text-left py-2 pl-2 w-8">
                    <button onClick={toggleAll} className="text-muted-foreground hover:text-foreground">
                      {selected.size === items.length
                        ? <CheckSquare className="h-4 w-4 text-primary" />
                        : <Square className="h-4 w-4" />}
                    </button>
                  </th>
                  <th className="text-left py-2 font-medium text-muted-foreground">Descrição</th>
                  <th className="text-right py-2 font-medium text-muted-foreground">Valor</th>
                  <th className="text-right py-2 pr-2 font-medium text-muted-foreground w-36">
                    <span className="flex items-center justify-end gap-1">
                      <CalendarClock className="h-3.5 w-3.5" />Reagendar
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const isSelected = selected.has(item.id);
                  return (
                    <tr
                      key={item.id}
                      className={`border-b last:border-0 transition-colors ${isSelected ? "bg-emerald-50/30 dark:bg-emerald-950/10" : "bg-amber-50/30 dark:bg-amber-950/10"}`}
                    >
                      <td className="py-2 pl-2">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => {
                            const next = new Set(selected);
                            if (checked) next.add(item.id);
                            else next.delete(item.id);
                            setSelected(next);
                          }}
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <span className={isSelected ? "" : "text-muted-foreground"}>
                          {item.description}
                        </span>
                        {item.installment_total && item.installment_total > 1 && (
                          <span className="text-[10px] text-muted-foreground ml-1">
                            ({item.installment_number}/{item.installment_total})
                          </span>
                        )}
                      </td>
                      <td className="py-2 text-right font-mono text-sm">
                        {fmt(item.amount)}
                      </td>
                      <td className="py-2 pr-2">
                        {!isSelected && (
                          <Input
                            type="date"
                            value={reschedule[item.id] || nextDueDate}
                            onChange={(e) =>
                              setReschedule((prev) => ({ ...prev, [item.id]: e.target.value }))
                            }
                            className="h-7 text-xs w-full"
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Summary footer */}
        {items.length > 0 && (
          <div className="border-t pt-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Selecionados para baixa ({selected.size}/{items.length}):
              </span>
              <span className="font-semibold text-emerald-600">{fmt(totalSelected)}</span>
            </div>
            {totalNotSelected > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Reagendar ({items.length - selected.size}):</span>
                <span className="font-semibold text-amber-600">{fmt(totalNotSelected)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold border-t pt-1 mt-1">
              <span>Total da Fatura:</span>
              <span>{fmt(totalSelected + totalNotSelected)}</span>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={saving || items.length === 0}
          >
            {saving ? "Processando..." : `Confirmar${selected.size > 0 ? ` (${selected.size} baixas)` : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
