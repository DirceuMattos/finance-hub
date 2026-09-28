import { useEffect, useMemo, useState } from "react";
import { addMonths, format } from "date-fns";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { AlertTriangle, Banknote, Calculator, CalendarClock, CheckCircle2, Lock } from "lucide-react";
import { useAccounts } from "@/hooks/useAccounts";
import { cardCycleWindow, formatIsoDateBR, normalizeDueDay } from "@/lib/cardCycle";
import { evaluateExpression } from "@/lib/calc";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cardId: string;
  cardName: string;
  dueDay: number;
  referenceMonth: string; // "yyyy-MM-01"
  referenceLabel?: string;
}

interface InvoiceItem {
  id: string;
  description: string;
  amount: number;
  due_date: string;
  status: "planned" | "paid";
  payment_date: string | null;
  installment_number: number | null;
  installment_total: number | null;
  account_id: string | null;
}

interface RowState {
  selected: boolean;
  accountId: string | null;
  paymentDate: string;
  reschedule: boolean;
  newDueDate: string;
}

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const today = () => format(new Date(), "yyyy-MM-dd");

export function CardInvoiceSettleDialog({
  open,
  onOpenChange,
  cardId,
  cardName,
  dueDay,
  referenceMonth,
  referenceLabel,
}: Props) {
  const queryClient = useQueryClient();
  const { data: allAccounts = [] } = useAccounts();
  const accounts = useMemo(() => allAccounts.filter((a) => a.is_active), [allAccounts]);

  const due = normalizeDueDay(dueDay);
  const cycle = useMemo(() => cardCycleWindow(referenceMonth, due), [referenceMonth, due]);
  const nextDueDate = useMemo(() => {
    const [y, m] = referenceMonth.split("-").map(Number);
    const next = addMonths(new Date(y, m - 1, 1), 1);
    return cardCycleWindow(format(next, "yyyy-MM"), due).end;
  }, [referenceMonth, due]);

  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [bulkDate, setBulkDate] = useState(today());
  const [bulkAccount, setBulkAccount] = useState<string>("");
  const [calcExpr, setCalcExpr] = useState("");
  const [showCalc, setShowCalc] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["card_invoice_items", cardId, referenceMonth],
    enabled: open,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("transactions")
        .select("id, description, amount, due_date, status, payment_date, installment_number, installment_total, account_id")
        .eq("center_cost", cardName)
        .in("status", ["planned", "paid"])
        .gte("due_date", cycle.start)
        .lte("due_date", cycle.end)
        .order("due_date")
        .order("description");
      if (error) throw error;
      return (data || []) as InvoiceItem[];
    },
  });

  // Fatura já fechada (virada) pelo operador?
  const { data: closedInvoice = null, isLoading: loadingClosed } = useQuery({
    queryKey: ["card_invoice_payment", cardId, referenceMonth],
    enabled: open,
    staleTime: 0,
    gcTime: 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("card_invoice_payments")
        .select("amount_paid, payment_date, updated_at")
        .eq("card_id", cardId)
        .eq("reference_month", referenceMonth)
        .maybeSingle();
      if (error) throw error;
      return data as { amount_paid: number; payment_date: string; updated_at: string } | null;
    },
  });

  const pending = useMemo(() => items.filter((i) => i.status === "planned"), [items]);
  const alreadyPaid = useMemo(() => items.filter((i) => i.status === "paid"), [items]);

  // Nada vem selecionado: a baixa é sempre uma escolha explícita, item a item ou em lote.
  useEffect(() => {
    const init: Record<string, RowState> = {};
    pending.forEach((i) => {
      init[i.id] = { selected: false, accountId: i.account_id, paymentDate: today(), reschedule: false, newDueDate: nextDueDate };
    });
    setRows(init);
  }, [pending, nextDueDate]);

  const patch = (id: string, p: Partial<RowState>) => setRows((prev) => ({ ...prev, [id]: { ...prev[id], ...p } }));
  const selectedItems = pending.filter((i) => rows[i.id]?.selected);
  const rescheduleItems = pending.filter((i) => !rows[i.id]?.selected && rows[i.id]?.reschedule);
  const totalPending = pending.reduce((s, i) => s + Math.abs(i.amount), 0);
  const totalSelected = selectedItems.reduce((s, i) => s + Math.abs(i.amount), 0);
  const totalPaid = alreadyPaid.reduce((s, i) => s + Math.abs(i.amount), 0);
  const allSelected = pending.length > 0 && selectedItems.length === pending.length;
  const todayIso = today();
  const overdue = cycle.end < todayIso;
  // Varredura: nada pendente e algo pago -> conferência e pedido para virar a fatura.
  const readyToClose = !closedInvoice && pending.length === 0 && alreadyPaid.length > 0;
  const paidByAccount = useMemo(() => {
    const map = new Map<string, number>();
    alreadyPaid.forEach((i) => map.set(i.account_id ?? "", (map.get(i.account_id ?? "") || 0) + Math.abs(i.amount)));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [alreadyPaid]);
  const nextCycle = useMemo(() => {
    const [yy, mm] = referenceMonth.split("-").map(Number);
    return cardCycleWindow(format(addMonths(new Date(yy, mm - 1, 1), 1), "yyyy-MM"), due);
  }, [referenceMonth, due]);

  const setAll = (selected: boolean) =>
    setRows((prev) => {
      const next = { ...prev };
      pending.forEach((i) => { next[i.id] = { ...next[i.id], selected, reschedule: selected ? false : next[i.id].reschedule }; });
      return next;
    });

  const applyBulk = () => {
    if (selectedItems.length === 0) { toast.info("Selecione os lançamentos antes de aplicar."); return; }
    setRows((prev) => {
      const next = { ...prev };
      selectedItems.forEach((i) => {
        next[i.id] = { ...next[i.id], paymentDate: bulkDate || next[i.id].paymentDate, accountId: bulkAccount || next[i.id].accountId };
      });
      return next;
    });
  };

  const calcResult = evaluateExpression(calcExpr);
  const calcDiff = calcResult !== null ? Math.round((calcResult - totalSelected) * 100) / 100 : null;

  const missingAccount = selectedItems.some((i) => !rows[i.id]?.accountId);
  const missingDate = selectedItems.some((i) => !rows[i.id]?.paymentDate);
  const badReschedule = rescheduleItems.some((i) => !rows[i.id]?.newDueDate || rows[i.id].newDueDate <= cycle.end);
  const nothingToDo = selectedItems.length === 0 && rescheduleItems.length === 0;

  const invalidateAll = () =>
    ["transactions", "card_cycle_totals", "dashboard_account_balances_split", "card_invoice_items",
     "card_invoice_transactions", "card_invoice_payment", "accounts"]
      .forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));

  const callSettle = async (settle: unknown[], reschedule: unknown[], close: boolean) => {
    const { data, error } = await (supabase as any).rpc("settle_card_invoice", {
      p_card_id: cardId,
      p_reference_month: referenceMonth,
      p_settle: settle,
      p_reschedule: reschedule,
      p_close: close,
    });
    if (error) throw error;
    invalidateAll();
    return data;
  };

  const handleCloseInvoice = async () => {
    setSaving(true);
    try {
      const data = await callSettle([], [], true);
      if (!data?.invoice_paid) {
        toast.error("A fatura não pôde ser fechada: ainda há lançamentos em aberto. Atualize a tela.");
        return;
      }
      toast.success(`Fatura fechada (${fmt(Number(data.paid_total) || 0)}). Novo período: ${formatIsoDateBR(nextCycle.start)} a ${formatIsoDateBR(nextCycle.end)}.`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Não foi possível fechar a fatura: " + (e?.message || "erro desconhecido"));
    } finally {
      setSaving(false);
    }
  };

  const handleConfirm = async () => {
    if (nothingToDo) return;
    if (missingAccount) { toast.error("Informe a conta bancária de todos os itens selecionados."); return; }
    if (missingDate) { toast.error("Informe a data de pagamento de todos os itens selecionados."); return; }
    if (badReschedule) { toast.error(`A nova data de vencimento deve ser posterior a ${formatIsoDateBR(cycle.end)}.`); return; }
    setSaving(true);
    try {
      // Baixas não fecham a fatura: o fechamento é sempre confirmado na conferência.
      const data = await callSettle(
        selectedItems.map((i) => ({ id: i.id, account_id: rows[i.id].accountId, payment_date: rows[i.id].paymentDate })),
        rescheduleItems.map((i) => ({ id: i.id, due_date: rows[i.id].newDueDate })),
        false,
      );

      // Mantém o recálculo de saldos que já existia (regra de saldo será revista no módulo Contas).
      const { error: recalcError } = await (supabase as any).rpc("recalculate_account_balances_from_date", { p_from_date: "2026-04-01" });
      if (recalcError) toast.warning("Baixa registrada, mas o recálculo de saldos falhou. Recarregue a tela de Contas.");

      const parts: string[] = [];
      if (data?.settled) parts.push(`${data.settled} baixado(s)`);
      if (data?.rescheduled) parts.push(`${data.rescheduled} reagendado(s)`);
      if (data?.remaining) parts.push(`${data.remaining} ainda em aberto`);
      else parts.push("nada mais em aberto: confira e feche a fatura");
      toast.success(parts.join(" · "));
      // Não fecha o modal: a varredura recarrega e, se tudo estiver pago, mostra a conferência.
    } catch (e: any) {
      toast.error("Não foi possível processar a fatura: " + (e?.message || "erro desconhecido"));
    } finally {
      setSaving(false);
    }
  };

  const accountName = (id: string | null) => accounts.find((a) => a.id === id)?.name || allAccounts.find((a) => a.id === id)?.name || "—";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <Banknote className="h-5 w-5 text-primary" />
            Quitar Fatura — {cardName}
            {referenceLabel && <Badge variant="outline" className="text-xs">{referenceLabel}</Badge>}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Ciclo: {formatIsoDateBR(cycle.start)} a {formatIsoDateBR(cycle.end)} · Só os lançamentos marcados são baixados; os demais ficam como estão.
          </p>
        </DialogHeader>

        {closedInvoice && (
          <div className="flex items-center gap-2 rounded-md px-3 py-2 text-sm bg-emerald-500/10 text-emerald-800 dark:text-emerald-300">
            <Lock className="h-4 w-4 shrink-0" />
            Fatura fechada — {fmt(Number(closedInvoice.amount_paid) || 0)}, pago até {formatIsoDateBR(closedInvoice.payment_date)}.
            Novo período: {formatIsoDateBR(nextCycle.start)} a {formatIsoDateBR(nextCycle.end)}.
          </div>
        )}

        {!closedInvoice && pending.length > 0 && overdue && (
          <div className="flex items-start gap-2 rounded-md px-3 py-2 text-sm bg-amber-500/10 text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Varredura: a fatura venceu em {formatIsoDateBR(cycle.end)} e {pending.length} lançamento(s) seguem em aberto ({fmt(totalPending)}).
              Se já foram pagos pelo módulo Lançamentos, marque-os lá ou baixe aqui. Você também pode reagendá-los.
            </span>
          </div>
        )}

        {readyToClose && !isLoading && !loadingClosed && (
          <div className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3 space-y-2 text-sm">
            <p className="font-medium flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
              Varredura concluída: nenhum lançamento em aberto neste ciclo.
            </p>
            <p>
              {alreadyPaid.length} lançamento(s) pagos, total de <b>{fmt(totalPaid)}</b>. Confira com o extrato antes de fechar.
            </p>
            {paidByAccount.length > 0 && (
              <ul className="text-xs text-muted-foreground grid sm:grid-cols-2 gap-x-6">
                {paidByAccount.map(([acc, v]) => (
                  <li key={acc || "sem-conta"} className="flex justify-between gap-3">
                    <span>{acc ? accountName(acc) : "Sem conta"}</span><span className="font-mono">{fmt(v)}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button size="sm" onClick={handleCloseInvoice} disabled={saving}>
                <Lock className="h-4 w-4 mr-1" />
                {saving ? "Fechando..." : "Fechar fatura e iniciar novo período"}
              </Button>
              <span className="text-xs text-muted-foreground">
                Próximo período de gastos: {formatIsoDateBR(nextCycle.start)} a {formatIsoDateBR(nextCycle.end)}
              </span>
            </div>
          </div>
        )}

        {/* Ações em lote */}
        {pending.length > 0 && (
        <div className="flex flex-wrap items-end gap-3 py-2 border-b">
          <div className="space-y-1">
            <Label className="text-xs">Data de pagamento</Label>
            <Input id="settle-bulk-date" type="date" value={bulkDate} onChange={(e) => setBulkDate(e.target.value)} className="h-8 w-40 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Conta bancária</Label>
            <Select value={bulkAccount} onValueChange={setBulkAccount}>
              <SelectTrigger id="settle-bulk-account" className="h-8 w-52 text-sm"><SelectValue placeholder="Manter a de cada item" /></SelectTrigger>
              <SelectContent>
                {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}{a.bank_name ? ` · ${a.bank_name}` : ""}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" variant="secondary" onClick={applyBulk} disabled={selectedItems.length === 0}>Aplicar aos selecionados</Button>
          <div className="flex gap-2 ml-auto">
            <Button size="sm" variant="outline" onClick={() => setAll(!allSelected)} disabled={pending.length === 0}>
              {allSelected ? "Desmarcar todos" : "Selecionar todos (baixa geral)"}
            </Button>
            <Button size="sm" variant={showCalc ? "default" : "outline"} onClick={() => setShowCalc((v) => !v)}>
              <Calculator className="h-4 w-4 mr-1" />Calculadora
            </Button>
          </div>
        </div>
        )}

        {showCalc && pending.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 py-2 border-b text-sm">
            <Input
              id="settle-calc"
              value={calcExpr}
              onChange={(e) => setCalcExpr(e.target.value)}
              placeholder="Ex.: 3.027,40 - 150 + 12,90"
              className="h-8 w-64 font-mono"
            />
            <span className="font-mono">= {calcResult !== null ? fmt(calcResult) : "—"}</span>
            <Button size="sm" variant="ghost" onClick={() => setCalcExpr(totalSelected.toFixed(2).replace(".", ","))}>Usar total selecionado</Button>
            {calcDiff !== null && (
              <span className={calcDiff === 0 ? "text-emerald-600" : "text-amber-600"}>
                {calcDiff === 0 ? "Confere com o selecionado" : `Diferença para o selecionado: ${fmt(calcDiff)}`}
              </span>
            )}
          </div>
        )}

        {/* Itens */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8 text-sm">Carregando...</p>
          ) : items.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">Nenhum lançamento neste ciclo.</p>
          ) : (
            <table className="w-full text-sm min-w-[720px]">
              <thead className="border-b sticky top-0 bg-background">
                <tr className="text-muted-foreground">
                  <th className="w-8 py-2 pl-2 text-left">
                    <Checkbox checked={allSelected} onCheckedChange={(c) => setAll(!!c)} aria-label="Selecionar todos" disabled={pending.length === 0} />
                  </th>
                  <th className="text-left py-2 font-medium">Descrição</th>
                  <th className="text-left py-2 font-medium">Venc.</th>
                  <th className="text-right py-2 font-medium">Valor</th>
                  <th className="text-left py-2 pl-3 font-medium">Conta</th>
                  <th className="text-left py-2 pr-2 font-medium">Pagamento / Reagendar</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((item) => {
                  const r = rows[item.id];
                  if (!r) return null;
                  return (
                    <tr key={item.id} className={`border-b ${r.selected ? "bg-emerald-50/40 dark:bg-emerald-950/20" : ""}`}>
                      <td className="py-2 pl-2">
                        <Checkbox
                          checked={r.selected}
                          onCheckedChange={(c) => patch(item.id, { selected: !!c, reschedule: c ? false : r.reschedule })}
                          aria-label={`Baixar ${item.description}`}
                        />
                      </td>
                      <td className="py-2 pr-2">
                        {item.description}
                        {item.installment_total && item.installment_total > 1 && (
                          <span className="text-[10px] text-muted-foreground ml-1">({item.installment_number}/{item.installment_total})</span>
                        )}
                      </td>
                      <td className="py-2 text-xs text-muted-foreground whitespace-nowrap">{formatIsoDateBR(item.due_date)}</td>
                      <td className="py-2 text-right font-mono whitespace-nowrap">{fmt(Math.abs(item.amount))}</td>
                      <td className="py-2 pl-3">
                        {r.selected ? (
                          <Select value={r.accountId ?? ""} onValueChange={(v) => patch(item.id, { accountId: v })}>
                            <SelectTrigger id={`acc-${item.id}`} className="h-7 w-44 text-xs"><SelectValue placeholder="Escolha a conta" /></SelectTrigger>
                            <SelectContent>
                              {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-xs text-muted-foreground">{accountName(r.accountId)}</span>
                        )}
                      </td>
                      <td className="py-2 pr-2">
                        {r.selected ? (
                          <Input id={`pay-${item.id}`} type="date" value={r.paymentDate} onChange={(e) => patch(item.id, { paymentDate: e.target.value })} className="h-7 w-36 text-xs" />
                        ) : (
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id={`res-${item.id}`}
                              checked={r.reschedule}
                              onCheckedChange={(c) => patch(item.id, { reschedule: !!c })}
                              aria-label={`Reagendar ${item.description}`}
                            />
                            <Label htmlFor={`res-${item.id}`} className="text-xs text-muted-foreground flex items-center gap-1">
                              <CalendarClock className="h-3 w-3" />Reagendar
                            </Label>
                            {r.reschedule && (
                              <Input id={`due-${item.id}`} type="date" value={r.newDueDate} min={cycle.end} onChange={(e) => patch(item.id, { newDueDate: e.target.value })} className="h-7 w-36 text-xs" />
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {alreadyPaid.map((item) => (
                  <tr key={item.id} className="border-b text-muted-foreground">
                    <td className="py-2 pl-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" /></td>
                    <td className="py-2 pr-2">{item.description}</td>
                    <td className="py-2 text-xs whitespace-nowrap">{formatIsoDateBR(item.due_date)}</td>
                    <td className="py-2 text-right font-mono whitespace-nowrap">{fmt(Math.abs(item.amount))}</td>
                    <td className="py-2 pl-3 text-xs">{accountName(item.account_id)}</td>
                    <td className="py-2 pr-2 text-xs">Pago em {formatIsoDateBR(item.payment_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Resumo */}
        {items.length > 0 && (
          <div className="border-t pt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
            <div><p className="text-xs text-muted-foreground">Já pago no ciclo</p><p className="font-semibold text-emerald-600">{fmt(totalPaid)}</p></div>
            <div><p className="text-xs text-muted-foreground">Em aberto</p><p className="font-semibold text-amber-600">{fmt(totalPending)}</p></div>
            <div><p className="text-xs text-muted-foreground">Selecionado ({selectedItems.length}/{pending.length})</p><p className="font-semibold">{fmt(totalSelected)}</p></div>
            <div><p className="text-xs text-muted-foreground">Fica em aberto após a baixa</p><p className="font-semibold">{fmt(totalPending - totalSelected)}</p></div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>{pending.length > 0 ? "Cancelar" : "Fechar"}</Button>
          {pending.length > 0 && (
          <Button onClick={handleConfirm} disabled={saving || nothingToDo}>
            {saving
              ? "Processando..."
              : nothingToDo
                ? "Selecione lançamentos"
                : `Confirmar${selectedItems.length ? ` ${selectedItems.length} baixa(s)` : ""}${rescheduleItems.length ? ` · ${rescheduleItems.length} reagend.` : ""}`}
          </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
