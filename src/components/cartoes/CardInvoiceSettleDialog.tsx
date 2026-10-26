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
import { AlertTriangle, Banknote, Calculator, CalendarClock, CheckCircle2, HandCoins, Lock } from "lucide-react";
import { useAccounts } from "@/hooks/useAccounts";
import { cardCycleWindow, formatIsoDateBR, normalizeDueDay } from "@/lib/cardCycle";
import { evaluateExpression } from "@/lib/calc";
import { buildReimbursement, isReimbursementOf, summarizeReimbursements } from "@/lib/reimbursement";
import { useCardReimbursements } from "@/hooks/useCardReimbursements";
import { buildAmountChange } from "@/lib/invoiceAmountEdit";

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
  notes: string | null;
}

interface RowState {
  selected: boolean;
  accountId: string | null;
  paymentDate: string;
  amountText: string; // valor editável (IOF/impostos da fatura)
}

type Action = "settle" | "reschedule" | null;

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const today = () => format(new Date(), "yyyy-MM-dd");
const toText = (v: number) => Math.abs(Number(v) || 0).toFixed(2).replace(".", ",");

export function CardInvoiceSettleDialog({ open, onOpenChange, cardId, cardName, dueDay, referenceMonth, referenceLabel }: Props) {
  const queryClient = useQueryClient();
  const { data: allAccounts = [] } = useAccounts();
  const accounts = useMemo(() => allAccounts.filter((a) => a.is_active), [allAccounts]);

  const due = normalizeDueDay(dueDay);
  const cycle = useMemo(() => cardCycleWindow(referenceMonth, due), [referenceMonth, due]);
  const nextCycle = useMemo(() => {
    const [y, m] = referenceMonth.split("-").map(Number);
    return cardCycleWindow(format(addMonths(new Date(y, m - 1, 1), 1), "yyyy-MM"), due);
  }, [referenceMonth, due]);

  const todayIso = today();
  const overdue = cycle.end < todayIso;
  const futureInvoice = cycle.start > todayIso || cycle.end > todayIso;

  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [bulkDate, setBulkDate] = useState(todayIso);
  const [bulkAccount, setBulkAccount] = useState<string>("");
  const [newDueDate, setNewDueDate] = useState(nextCycle.end);
  const [confirming, setConfirming] = useState<Action>(null);
  const [calcExpr, setCalcExpr] = useState("");
  const [showCalc, setShowCalc] = useState(false);
  const [saving, setSaving] = useState(false);
  // Reembolso: vira receita prevista na conta escolhida, com vencimento da fatura.
  const [showReimb, setShowReimb] = useState(false);
  const [reimbAmount, setReimbAmount] = useState("");
  const [reimbAccount, setReimbAccount] = useState("");
  const [reimbConfirm, setReimbConfirm] = useState(false);

  useEffect(() => { setNewDueDate(nextCycle.end); }, [nextCycle.end]);
  useEffect(() => {
    if (!open) { setShowReimb(false); setReimbAmount(""); setReimbAccount(""); setReimbConfirm(false); setCancelReimbId(null); }
  }, [open]);

  // Reembolsos já lançados para esta fatura (vencimento = vencimento da fatura).
  const { data: reimbTxs = [], categoryId: reimbCategoryId } = useCardReimbursements(cycle.end, cycle.end, open);
  const reimbursements = useMemo(
    () => reimbTxs.filter((t) => isReimbursementOf(t, { id: cardId, name: cardName }, cycle.end)),
    [reimbTxs, cardId, cardName, cycle.end],
  );
  const reimbSummary = useMemo(() => summarizeReimbursements(reimbursements), [reimbursements]);
  const [cancelReimbId, setCancelReimbId] = useState<string | null>(null);
  // Valores ajustados em itens já pagos (IOF/impostos calculados só na fatura).
  const [paidEdits, setPaidEdits] = useState<Record<string, string>>({});

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["card_invoice_items", cardId, referenceMonth],
    enabled: open,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("transactions")
        .select("id, description, amount, due_date, status, payment_date, installment_number, installment_total, account_id, notes")
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

  // Nada vem selecionado: toda ação é explícita.
  useEffect(() => {
    const init: Record<string, RowState> = {};
    pending.forEach((i) => { init[i.id] = { selected: false, accountId: i.account_id, paymentDate: today(), amountText: toText(i.amount) }; });
    setRows(init);
    setConfirming(null);
  }, [pending]);

  useEffect(() => {
    const init: Record<string, string> = {};
    alreadyPaid.forEach((i) => { init[i.id] = toText(i.amount); });
    setPaidEdits(init);
  }, [alreadyPaid]);

  // Valor a usar para um item em aberto selecionado: o digitado (se válido) ou o lançado.
  const effAmount = (i: InvoiceItem) => {
    const v = evaluateExpression(rows[i.id]?.amountText ?? "");
    return v !== null && v > 0 ? Math.round(v * 100) / 100 : Math.abs(i.amount);
  };
  const changedOf = (list: { item: InvoiceItem; text: string }[]) => list
    .map(({ item, text }) => ({ item, change: buildAmountChange(item, text, todayIso) }))
    .filter(({ change }) => change.ok || !change.error.includes("igual"));

  const patch = (id: string, p: Partial<RowState>) => { setConfirming(null); setRows((prev) => ({ ...prev, [id]: { ...prev[id], ...p } })); };
  const selectedItems = pending.filter((i) => rows[i.id]?.selected);
  const totalPending = pending.reduce((s, i) => s + Math.abs(i.amount), 0);
  const totalSelected = selectedItems.reduce((s, i) => s + effAmount(i), 0);
  const pendingChanges = changedOf(selectedItems.map((i) => ({ item: i, text: rows[i.id]?.amountText ?? "" })));
  const paidChanges = changedOf(alreadyPaid.map((i) => ({ item: i, text: paidEdits[i.id] ?? toText(i.amount) })));
  const totalPaid = alreadyPaid.reduce((s, i) => s + Math.abs(i.amount), 0);
  const allSelected = pending.length > 0 && selectedItems.length === pending.length;
  const readyToClose = !closedInvoice && pending.length === 0 && alreadyPaid.length > 0;

  const accountName = (id: string | null) => allAccounts.find((a) => a.id === id)?.name || "—";
  const paidByAccount = useMemo(() => {
    const map = new Map<string, number>();
    alreadyPaid.forEach((i) => map.set(i.account_id ?? "", (map.get(i.account_id ?? "") || 0) + Math.abs(i.amount)));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [alreadyPaid]);

  const setAll = (selected: boolean) => {
    setConfirming(null);
    setRows((prev) => {
      const next = { ...prev };
      pending.forEach((i) => { next[i.id] = { ...next[i.id], selected }; });
      return next;
    });
  };

  const applyBulk = () => {
    if (selectedItems.length === 0) { toast.info("Selecione os lançamentos antes de aplicar."); return; }
    setConfirming(null);
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
  const futurePayment = selectedItems.some((i) => (rows[i.id]?.paymentDate || "") > todayIso);
  const badNewDue = !newDueDate || newDueDate <= cycle.end;

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
    return data;
  };

  const recalc = async () => {
    // Mantém o recálculo de saldos que já existia (regra de saldo será revista no módulo Contas).
    const { error } = await (supabase as any).rpc("recalculate_account_balances_from_date", { p_from_date: "2026-04-01" });
    if (error) toast.warning("Operação registrada, mas o recálculo de saldos falhou. Recarregue a tela de Contas.");
  };

  const requestAction = (a: Exclude<Action, null>) => {
    if (selectedItems.length === 0) { toast.info("Selecione ao menos um lançamento."); return; }
    if (a === "settle" && missingAccount) { toast.error("Informe a conta bancária de todos os itens selecionados."); return; }
    if (a === "settle" && missingDate) { toast.error("Informe a data de pagamento de todos os itens selecionados."); return; }
    const bad = pendingChanges.find(({ change }) => !change.ok);
    if (bad) { toast.error(`${bad.item.description}: ${bad.change.error}`); return; }
    if (a === "reschedule" && badNewDue) { toast.error(`A nova data de vencimento deve ser posterior a ${formatIsoDateBR(cycle.end)}.`); return; }
    setConfirming(a);
  };

  // Grava os valores ajustados (valor anterior fica nas observações).
  const applyAmountChanges = async (list: typeof pendingChanges) => {
    for (const { item, change } of list) {
      const { data: updated, error } = await (supabase as any)
        .from("transactions")
        .update({ amount: change.amount, notes: change.notes })
        .eq("id", item.id)
        .select("id");
      if (error) throw error;
      if (!updated || updated.length === 0) throw new Error(`"${item.description}" não foi alterado. Verifique as permissões.`);
    }
  };

  const runAction = async () => {
    if (!confirming) return;
    setSaving(true);
    try {
      if (pendingChanges.length) await applyAmountChanges(pendingChanges);
      if (confirming === "settle") {
        const data = await callSettle(
          selectedItems.map((i) => ({ id: i.id, account_id: rows[i.id].accountId, payment_date: rows[i.id].paymentDate })),
          [], false);
        await recalc();
        toast.success(`${data?.settled ?? selectedItems.length} lançamento(s) baixado(s)${data?.remaining ? ` · ${data.remaining} ainda em aberto` : " · nada mais em aberto: confira e feche a fatura"}.`);
      } else {
        const data = await callSettle([], selectedItems.map((i) => ({ id: i.id, due_date: newDueDate })), false);
        toast.success(`${data?.rescheduled ?? selectedItems.length} lançamento(s) reagendado(s) para ${formatIsoDateBR(newDueDate)}.`);
      }
      invalidateAll();
      setConfirming(null);
    } catch (e: any) {
      toast.error("Não foi possível concluir: " + (e?.message || "erro desconhecido"));
    } finally {
      setSaving(false);
    }
  };

  const reimbAccountObj = allAccounts.find((a) => a.id === reimbAccount);
  const reimb = buildReimbursement({
    amountText: reimbAmount,
    accountId: reimbAccount,
    accountEntityId: reimbAccountObj?.financial_entity_id,
    categoryId: reimbCategoryId,
    cardId,
    cardName,
    dueDate: cycle.end,
    referenceLabel,
  });

  const requestReimbursement = () => {
    if (!reimb.ok) { toast.error(reimb.error); return; }
    setReimbConfirm(true);
  };

  const saveReimbursement = async () => {
    if (!reimb.ok) { toast.error(reimb.error); return; }
    setSaving(true);
    try {
      const { error } = await (supabase as any).from("transactions").insert(reimb.payload);
      if (error) throw error;
      invalidateReimb();
      toast.success(`Reembolso de ${fmt(reimb.amount)} lançado como receita prevista em ${accountName(reimbAccount)}, vencimento ${formatIsoDateBR(cycle.end)}.`);
      setReimbAmount("");
      setReimbConfirm(false);
      setShowReimb(false);
    } catch (e: any) {
      toast.error("Não foi possível lançar o reembolso: " + (e?.message || "erro desconhecido"));
    } finally {
      setSaving(false);
    }
  };

  const invalidateReimb = () =>
    ["transactions", "card_reimbursements", "dashboard_account_balances_split", "accounts"]
      .forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));

  // Cancelar só reembolso ainda previsto (status vira "cancelled"; reversível em Lançamentos).
  const cancelReimbursement = async (id: string) => {
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("transactions")
        .update({ status: "cancelled" })
        .eq("id", id)
        .eq("status", "planned");
      if (error) throw error;
      invalidateReimb();
      toast.success("Reembolso cancelado.");
      setCancelReimbId(null);
    } catch (e: any) {
      toast.error("Não foi possível cancelar o reembolso: " + (e?.message || "erro desconhecido"));
    } finally {
      setSaving(false);
    }
  };

  const savePaidAdjustments = async () => {
    const bad = paidChanges.find(({ change }) => !change.ok);
    if (bad) { toast.error(`${bad.item.description}: ${bad.change.error}`); return; }
    setSaving(true);
    try {
      await applyAmountChanges(paidChanges);
      await recalc(); // itens pagos mexem no saldo das contas
      invalidateAll();
      toast.success(`${paidChanges.length} valor(es) ajustado(s). Valores anteriores registrados nas observações.`);
    } catch (e: any) {
      toast.error("Não foi possível ajustar os valores: " + (e?.message || "erro desconhecido"));
    } finally {
      setSaving(false);
    }
  };

  const handleCloseInvoice = async () => {
    setSaving(true);
    try {
      const data = await callSettle([], [], true);
      invalidateAll();
      if (!data?.invoice_paid) { toast.error("A fatura não pôde ser fechada: ainda há lançamentos em aberto. Atualize a tela."); return; }
      toast.success(`Fatura fechada (${fmt(Number(data.paid_total) || 0)}). Novo período: ${formatIsoDateBR(nextCycle.start)} a ${formatIsoDateBR(nextCycle.end)}.`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Não foi possível fechar a fatura: " + (e?.message || "erro desconhecido"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <Banknote className="h-5 w-5 text-primary" />
            Fatura — {cardName}
            {referenceLabel && <Badge variant="outline" className="text-xs">{referenceLabel}</Badge>}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Período de gastos: {formatIsoDateBR(cycle.start)} a {formatIsoDateBR(cycle.end)} · Vencimento {formatIsoDateBR(cycle.end)}.
            Marque os lançamentos e escolha <b>Baixar</b> ou <b>Reagendar</b>; os demais ficam como estão.
            {!closedInvoice && <> O valor pode ser ajustado na própria linha (ex.: IOF ou impostos cobrados na fatura).</>}
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
              Se já foram pagos pelo módulo Lançamentos, marque-os lá ou baixe aqui; se não, reagende.
            </span>
          </div>
        )}

        {!closedInvoice && pending.length > 0 && !overdue && (
          <div className="flex items-start gap-2 rounded-md px-3 py-2 text-xs bg-muted text-muted-foreground">
            <CalendarClock className="h-4 w-4 shrink-0" />
            Fatura ainda não venceu (vence em {formatIsoDateBR(cycle.end)}). Só dê baixa no que já foi efetivamente pago.
          </div>
        )}

        {readyToClose && !isLoading && !loadingClosed && (
          <div className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3 space-y-2 text-sm">
            <p className="font-medium flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
              Varredura concluída: nenhum lançamento em aberto neste ciclo.
            </p>
            <p>{alreadyPaid.length} lançamento(s) pagos, total de <b>{fmt(totalPaid)}</b>. Confira com o extrato antes de fechar.</p>
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
              <Button size="sm" onClick={handleCloseInvoice} disabled={saving || futureInvoice}>
                <Lock className="h-4 w-4 mr-1" />
                {saving ? "Fechando..." : "Fechar fatura e iniciar novo período"}
              </Button>
              <span className="text-xs text-muted-foreground">
                {futureInvoice
                  ? `Disponível após o vencimento (${formatIsoDateBR(cycle.end)}).`
                  : `Próximo período de gastos: ${formatIsoDateBR(nextCycle.start)} a ${formatIsoDateBR(nextCycle.end)}`}
              </span>
            </div>
          </div>
        )}

        {/* Barra de ações sobre os selecionados */}
        {pending.length > 0 && (
          <div className="grid gap-3 py-2 border-b md:grid-cols-2">
            <div className="rounded-md border p-2 space-y-2">
              <p className="text-xs font-medium flex items-center gap-1"><Banknote className="h-3.5 w-3.5" />Baixa (pagamento)</p>
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1">
                  <Label htmlFor="settle-bulk-date" className="text-[11px]">Data</Label>
                  <Input id="settle-bulk-date" type="date" value={bulkDate} max={todayIso} onChange={(e) => setBulkDate(e.target.value)} className="h-8 w-36 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">Conta</Label>
                  <Select value={bulkAccount} onValueChange={setBulkAccount}>
                    <SelectTrigger id="settle-bulk-account" className="h-8 w-44 text-xs"><SelectValue placeholder="Manter a de cada item" /></SelectTrigger>
                    <SelectContent>
                      {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}{a.bank_name ? ` · ${a.bank_name}` : ""}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button size="sm" variant="secondary" className="h-8" onClick={applyBulk} disabled={selectedItems.length === 0}>Aplicar</Button>
                <Button size="sm" className="h-8" onClick={() => requestAction("settle")} disabled={saving || selectedItems.length === 0}>
                  Baixar selecionados ({selectedItems.length})
                </Button>
              </div>
            </div>
            <div className="rounded-md border p-2 space-y-2">
              <p className="text-xs font-medium flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" />Reagendamento</p>
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1">
                  <Label htmlFor="resched-date" className="text-[11px]">Novo vencimento</Label>
                  <Input id="resched-date" type="date" value={newDueDate} min={nextCycle.start} onChange={(e) => { setConfirming(null); setNewDueDate(e.target.value); }} className="h-8 w-36 text-xs" />
                </div>
                <Button size="sm" variant="outline" className="h-8" onClick={() => requestAction("reschedule")} disabled={saving || selectedItems.length === 0}>
                  Reagendar selecionados ({selectedItems.length})
                </Button>
              </div>
            </div>
            <div className="md:col-span-2 flex flex-wrap gap-2">
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAll(!allSelected)}>
                {allSelected ? "Desmarcar todos" : "Selecionar todos"}
              </Button>
              <Button size="sm" variant={showCalc ? "default" : "ghost"} className="h-7 text-xs" onClick={() => setShowCalc((v) => !v)}>
                <Calculator className="h-3.5 w-3.5 mr-1" />Calculadora
              </Button>
            </div>
          </div>
        )}

        {/* Confirmação explícita */}
        {confirming && (
          <div className={`rounded-md border p-3 text-sm space-y-2 ${confirming === "settle" ? "border-primary/50 bg-primary/5" : "border-amber-500/50 bg-amber-500/5"}`}>
            {confirming === "settle" ? (
              <>
                <p className="font-medium">Confirmar baixa de {selectedItems.length} lançamento(s), total {fmt(totalSelected)}?</p>
                {pendingChanges.length > 0 && <p className="text-xs">{pendingChanges.length} valor(es) ajustado(s) antes da baixa; o valor anterior fica nas observações.</p>}
                <ul className="text-xs text-muted-foreground">
                  {Array.from(new Set(selectedItems.map((i) => `${accountName(rows[i.id].accountId)} em ${formatIsoDateBR(rows[i.id].paymentDate)}`))).map((t) => <li key={t}>• {t}</li>)}
                </ul>
                {!overdue && <p className="text-xs text-amber-700 dark:text-amber-400">Atenção: esta fatura vence em {formatIsoDateBR(cycle.end)}. Confirme só se o pagamento já foi feito.</p>}
                {futurePayment && <p className="text-xs text-destructive">Há data de pagamento no futuro. Corrija antes de confirmar.</p>}
              </>
            ) : (
              <p className="font-medium">Reagendar {selectedItems.length} lançamento(s) ({fmt(totalSelected)}) para {formatIsoDateBR(newDueDate)}? Eles saem desta fatura.{pendingChanges.length > 0 ? ` ${pendingChanges.length} valor(es) ajustado(s) junto.` : ""}</p>
            )}
            <div className="flex gap-2">
              <Button size="sm" onClick={runAction} disabled={saving || (confirming === "settle" && futurePayment)}>{saving ? "Processando..." : "Confirmar"}</Button>
              <Button size="sm" variant="outline" onClick={() => setConfirming(null)} disabled={saving}>Voltar</Button>
            </div>
          </div>
        )}

        {showCalc && pending.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 py-2 border-b text-sm">
            <Input id="settle-calc" value={calcExpr} onChange={(e) => setCalcExpr(e.target.value)} placeholder="Ex.: 3.027,40 - 150 + 12,90" className="h-8 w-64 font-mono" />
            <span className="font-mono">= {calcResult !== null ? fmt(calcResult) : "—"}</span>
            <Button size="sm" variant="ghost" onClick={() => setCalcExpr(totalSelected.toFixed(2).replace(".", ","))}>Usar total selecionado</Button>
            {calcDiff !== null && (
              <span className={calcDiff === 0 ? "text-emerald-600" : "text-amber-600"}>
                {calcDiff === 0 ? "Confere com o selecionado" : `Diferença para o selecionado: ${fmt(calcDiff)}`}
              </span>
            )}
          </div>
        )}

        {/* Reembolso (receita prevista) */}
        <div className="py-1">
          {!showReimb ? (
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowReimb(true)}>
              <HandCoins className="h-3.5 w-3.5 mr-1" />Lançar reembolso
            </Button>
          ) : (
            <div className="rounded-md border p-2 space-y-2">
              <p className="text-xs font-medium flex items-center gap-1">
                <HandCoins className="h-3.5 w-3.5" />Reembolso — entra como receita prevista, vencimento {formatIsoDateBR(cycle.end)}, categoria Reembolsos
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1">
                  <Label htmlFor="reimb-amount" className="text-[11px]">Valor</Label>
                  <Input id="reimb-amount" inputMode="decimal" value={reimbAmount} placeholder="Ex.: 350,00"
                    onChange={(e) => { setReimbConfirm(false); setReimbAmount(e.target.value); }} className="h-8 w-36 text-xs font-mono" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">Conta que recebe</Label>
                  <Select value={reimbAccount} onValueChange={(v) => { setReimbConfirm(false); setReimbAccount(v); }}>
                    <SelectTrigger id="reimb-account" className="h-8 w-52 text-xs"><SelectValue placeholder="Escolha a conta" /></SelectTrigger>
                    <SelectContent>
                      {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}{a.bank_name ? ` · ${a.bank_name}` : ""}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button size="sm" className="h-8" onClick={requestReimbursement} disabled={saving}>Lançar</Button>
                <Button size="sm" variant="ghost" className="h-8" onClick={() => { setShowReimb(false); setReimbConfirm(false); }} disabled={saving}>Cancelar</Button>
              </div>
              {reimbConfirm && reimb.ok && (
                <div className="rounded-md border border-primary/50 bg-primary/5 p-2 text-sm space-y-2">
                  <p>Lançar receita prevista de <b>{fmt(reimb.amount)}</b> em <b>{accountName(reimbAccount)}</b>, vencimento {formatIsoDateBR(cycle.end)}?</p>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveReimbursement} disabled={saving}>{saving ? "Lançando..." : "Confirmar"}</Button>
                    <Button size="sm" variant="outline" onClick={() => setReimbConfirm(false)} disabled={saving}>Voltar</Button>
                  </div>
                </div>
              )}
            </div>
          )}
          {reimbursements.length > 0 && (
            <div className="mt-2 rounded-md border p-2 space-y-1">
              <p className="text-xs font-medium flex items-center gap-1">
                <HandCoins className="h-3.5 w-3.5" />Reembolsos desta fatura ({reimbursements.length})
              </p>
              <ul className="text-xs divide-y">
                {reimbursements.map((r) => (
                  <li key={r.id} className="py-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-mono w-24 text-right">{fmt(Math.abs(r.amount))}</span>
                    <span className="text-muted-foreground min-w-0 flex-1">{accountName(r.account_id)}</span>
                    {r.status === "paid" ? (
                      <span className="text-emerald-700 dark:text-emerald-400">Recebido em {formatIsoDateBR(r.payment_date)}</span>
                    ) : cancelReimbId === r.id ? (
                      <span className="flex items-center gap-2">
                        <span>Cancelar este reembolso?</span>
                        <Button size="sm" variant="destructive" className="h-6 text-xs" onClick={() => cancelReimbursement(r.id)} disabled={saving}>Confirmar</Button>
                        <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => setCancelReimbId(null)} disabled={saving}>Voltar</Button>
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <span className="text-amber-700 dark:text-amber-400">Previsto</span>
                        <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setCancelReimbId(r.id)} disabled={saving}>Cancelar</Button>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

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
                  <th className="text-left py-2 pr-2 font-medium">Pagamento</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((item) => {
                  const r = rows[item.id];
                  if (!r) return null;
                  return (
                    <tr key={item.id} className={`border-b ${r.selected ? "bg-primary/5" : ""}`}>
                      <td className="py-2 pl-2">
                        <Checkbox checked={r.selected} onCheckedChange={(c) => patch(item.id, { selected: !!c })} aria-label={`Selecionar ${item.description}`} />
                      </td>
                      <td className="py-2 pr-2">
                        {item.description}
                        {item.installment_total && item.installment_total > 1 && (
                          <span className="text-[10px] text-muted-foreground ml-1">({item.installment_number}/{item.installment_total})</span>
                        )}
                      </td>
                      <td className="py-2 text-xs text-muted-foreground whitespace-nowrap">{formatIsoDateBR(item.due_date)}</td>
                      <td className="py-2 text-right font-mono whitespace-nowrap">
                        {r.selected ? (
                          <Input id={`valor-${item.id}`} inputMode="decimal" value={r.amountText} onChange={(e) => patch(item.id, { amountText: e.target.value })}
                            className={`h-7 w-28 ml-auto text-xs font-mono text-right ${effAmount(item) !== Math.abs(item.amount) ? "border-amber-500" : ""}`}
                            aria-label={`Valor de ${item.description}`} title="Ajuste se a fatura cobrou IOF ou impostos" />
                        ) : fmt(Math.abs(item.amount))}
                      </td>
                      <td className="py-2 pl-3">
                        {r.selected ? (
                          <Select value={r.accountId ?? ""} onValueChange={(v) => patch(item.id, { accountId: v })}>
                            <SelectTrigger id={`acc-${item.id}`} className="h-7 w-40 text-xs"><SelectValue placeholder="Escolha a conta" /></SelectTrigger>
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
                          <Input id={`pay-${item.id}`} type="date" value={r.paymentDate} max={todayIso} onChange={(e) => patch(item.id, { paymentDate: e.target.value })} className="h-7 w-36 text-xs" />
                        ) : (
                          <span className="text-xs text-amber-700 dark:text-amber-400">Em aberto</span>
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
                    <td className="py-2 text-right font-mono whitespace-nowrap">
                      {closedInvoice ? fmt(Math.abs(item.amount)) : (
                        <Input id={`valor-pago-${item.id}`} inputMode="decimal" value={paidEdits[item.id] ?? toText(item.amount)}
                          onChange={(e) => setPaidEdits((p) => ({ ...p, [item.id]: e.target.value }))}
                          className={`h-7 w-28 ml-auto text-xs font-mono text-right ${paidChanges.some((c) => c.item.id === item.id) ? "border-amber-500 text-foreground" : "border-transparent bg-transparent"}`}
                          aria-label={`Valor de ${item.description}`} title="Ajuste se a fatura cobrou IOF ou impostos" />
                      )}
                    </td>
                    <td className="py-2 pl-3 text-xs">{accountName(item.account_id)}</td>
                    <td className="py-2 pr-2 text-xs">Pago em {formatIsoDateBR(item.payment_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {paidChanges.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-500/50 bg-amber-500/5 px-3 py-2 text-sm">
            <span>{paidChanges.length} valor(es) alterado(s) em itens já pagos. O saldo das contas será recalculado.</span>
            <div className="flex gap-2">
              <Button size="sm" onClick={savePaidAdjustments} disabled={saving}>{saving ? "Salvando..." : "Salvar ajustes"}</Button>
              <Button size="sm" variant="outline" onClick={() => setPaidEdits(Object.fromEntries(alreadyPaid.map((i) => [i.id, toText(i.amount)])))} disabled={saving}>Descartar</Button>
            </div>
          </div>
        )}

        {items.length > 0 && (
          <div className="border-t pt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
            <div><p className="text-xs text-muted-foreground">Já pago no ciclo</p><p className="font-semibold text-emerald-600">{fmt(totalPaid)}</p></div>
            <div><p className="text-xs text-muted-foreground">Em aberto</p><p className="font-semibold text-amber-600">{fmt(totalPending)}</p></div>
            <div><p className="text-xs text-muted-foreground">Selecionado ({selectedItems.length}/{pending.length})</p><p className="font-semibold">{fmt(totalSelected)}</p></div>
            <div><p className="text-xs text-muted-foreground">Total do ciclo</p><p className="font-semibold">{fmt(totalPaid + totalPending)}</p></div>
            {reimbSummary.count > 0 && (
              <>
                <div><p className="text-xs text-muted-foreground">Reembolso recebido</p><p className="font-semibold text-emerald-600">{fmt(reimbSummary.received)}</p></div>
                <div><p className="text-xs text-muted-foreground">Reembolso previsto</p><p className="font-semibold text-sky-700 dark:text-sky-400">{fmt(reimbSummary.planned)}</p></div>
                <div className="sm:col-span-2"><p className="text-xs text-muted-foreground">Custo líquido (total − reembolsos)</p><p className="font-semibold">{fmt(totalPaid + totalPending - reimbSummary.total)}</p></div>
              </>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Fechar janela</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
