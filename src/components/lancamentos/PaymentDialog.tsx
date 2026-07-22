import { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAccounts } from "@/hooks/useAccounts";
import type { Transaction } from "@/types/database";

interface PaymentDialogProps {
  transaction: Transaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: { id: string; status: string; payment_date: string; amount: number; account_id?: string }) => void;
  onCreateRemainder?: (data: Partial<Transaction>) => void;
  loading?: boolean;
}

export function PaymentDialog({ transaction, open, onOpenChange, onConfirm, onCreateRemainder, loading }: PaymentDialogProps) {
  const [paymentDate, setPaymentDate] = useState<Date | undefined>(undefined);
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState<string>("");
  const [showRemainderAlert, setShowRemainderAlert] = useState(false);
  const [pendingConfirmData, setPendingConfirmData] = useState<{ id: string; status: string; payment_date: string; amount: number; account_id?: string } | null>(null);
  const [showCalc, setShowCalc] = useState(false);
  const [calcInput, setCalcInput] = useState("");
  const { data: accounts = [] } = useAccounts();

  const parseAmountInput = (raw: unknown): number => {
    if (raw == null) return NaN;
    const s = String(raw).trim().replace(/\s|R\$/gi, "");
    if (!s) return NaN;
    const hasComma = s.includes(",");
    const hasDot = s.includes(".");
    if (hasComma && hasDot) {
      return parseFloat(s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, ""));
    }
    return parseFloat(hasComma ? s.replace(",", ".") : s);
  };

  useEffect(() => {
    if (transaction && open) {
      setAmount(String(transaction.amount));
      setPaymentDate(new Date());
      setAccountId(transaction.account_id || "");
      setShowCalc(false);
      setCalcInput("");
    }
  }, [transaction, open]);

  const handleOpen = (isOpen: boolean) => {
    onOpenChange(isOpen);
  };

  const handleConfirm = () => {
    if (!transaction || !paymentDate) return;
    const parsedAmount = parseAmountInput(amount);
    const realizedAmount = Number.isFinite(parsedAmount) ? parsedAmount : transaction.amount;
    const confirmData = {
      id: transaction.id,
      status: "paid",
      payment_date: format(paymentDate, "yyyy-MM-dd"),
      amount: realizedAmount,
      account_id: accountId || transaction.account_id || undefined,
    };

    if (realizedAmount < transaction.amount && onCreateRemainder) {
      setPendingConfirmData(confirmData);
      setShowRemainderAlert(true);
    } else {
      onConfirm(confirmData);
    }
  };

  const parsedAmount = parseAmountInput(amount);
  const effectiveAmount = Number.isFinite(parsedAmount) ? parsedAmount : 0;
  const remainderAmount = transaction ? transaction.amount - effectiveAmount : 0;
  const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const handleRemainderYes = () => {
    if (!pendingConfirmData || !transaction) return;
    onConfirm(pendingConfirmData);
    onCreateRemainder?.({
      description: transaction.description,
      transaction_type: transaction.transaction_type,
      card_id: transaction.card_id,
      category_id: transaction.category_id,
      financial_entity_id: transaction.financial_entity_id,
      account_id: transaction.account_id,
      amount: remainderAmount,
      competence_date: transaction.competence_date,
      due_date: transaction.due_date,
      status: "planned",
      notes: transaction.notes,
      payee: transaction.payee,
      payment_method: transaction.payment_method,
      source_type: transaction.source_type,
      tags: transaction.tags,
    });
    setShowRemainderAlert(false);
    setPendingConfirmData(null);
  };

  const handleRemainderNo = () => {
    if (pendingConfirmData) {
      onConfirm(pendingConfirmData);
    }
    setShowRemainderAlert(false);
    setPendingConfirmData(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Registrar Baixa</DialogTitle>
          </DialogHeader>
          {transaction && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {transaction.description} — {transaction.transaction_type === "income" ? "Receita" : "Despesa"}
              </p>

              {/* Datas: Prevista x Efetiva lado a lado */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">Vencimento previsto</Label>
                  <div className="flex items-center h-10 px-3 rounded-md border border-input bg-muted text-sm">
                    {transaction.due_date ? format(parseISO(transaction.due_date), "dd/MM/yyyy") : "—"}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Data efetiva</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !paymentDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {paymentDate ? format(paymentDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={paymentDate} onSelect={setPaymentDate} initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Conta bancária */}
              <div className="space-y-2">
                <Label>Conta bancária</Label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a conta..." />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((acc: any) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Valores: Previsto x Realizado lado a lado */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">Valor previsto (R$)</Label>
                  <div className="flex items-center h-10 px-3 rounded-md border border-input bg-muted text-sm">
                    {fmt(transaction.amount)}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Valor realizado (R$)</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      onFocus={(e) => e.target.select()}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      title="Abrir calculadora"
                      onClick={() => setShowCalc(!showCalc)}
                    >
                      <span className="text-base">🧮</span>
                    </Button>
                  </div>
                  {showCalc && (
                    <div className="border rounded-lg p-3 bg-muted/30 space-y-2">
                      <p className="text-xs text-muted-foreground">Digite os valores separados por + para somar</p>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Ex: 150.00 + 89.90 + 45.00"
                          value={calcInput}
                          onChange={(e) => setCalcInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              try {
                                const sanitized = calcInput.replace(/[^0-9+\-*/.]/g, "");
                                const result = Function(`"use strict"; return (${sanitized})`)();
                                if (Number.isFinite(result) && result > 0) {
                                  setAmount(result.toFixed(2));
                                  setCalcInput("");
                                  setShowCalc(false);
                                }
                              } catch {}
                            }
                          }}
                          className="font-mono text-sm"
                        />
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            try {
                              const sanitized = calcInput.replace(/[^0-9+\-*/.]/g, "");
                              const result = Function(`"use strict"; return (${sanitized})`)();
                              if (Number.isFinite(result) && result > 0) {
                                setAmount(result.toFixed(2));
                                setCalcInput("");
                                setShowCalc(false);
                              }
                            } catch {}
                          }}
                        >
                          OK
                        </Button>
                      </div>
                      {calcInput && (() => {
                        try {
                          const sanitized = calcInput.replace(/[^0-9+\-*/.]/g, "");
                          const result = Function(`"use strict"; return (${sanitized})`)();
                          return Number.isFinite(result) ? (
                            <p className="text-xs text-emerald-600 font-medium">
                              Total: {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(result)}
                            </p>
                          ) : null;
                        } catch { return null; }
                      })()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleConfirm} disabled={loading || !paymentDate}>
              {loading ? "Salvando..." : "Confirmar Baixa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showRemainderAlert} onOpenChange={setShowRemainderAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gerar lançamento de saldo?</AlertDialogTitle>
            <AlertDialogDescription>
              O valor realizado ({fmt(parseFloat(amount) || 0)}) é menor que o previsto ({fmt(transaction?.amount || 0)}).
              Deseja gerar um novo lançamento previsto com o saldo de <strong className="text-foreground">{fmt(remainderAmount)}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleRemainderNo}>Não, apenas registrar a baixa</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemainderYes}>Sim, gerar saldo</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
