import { useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Transaction } from "@/types/database";

interface PaymentDialogProps {
  transaction: Transaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: { id: string; status: string; payment_date: string; amount: number }) => void;
  loading?: boolean;
}

export function PaymentDialog({ transaction, open, onOpenChange, onConfirm, loading }: PaymentDialogProps) {
  const [paymentDate, setPaymentDate] = useState<Date | undefined>(undefined);
  const [amount, setAmount] = useState("");

  const handleOpen = (isOpen: boolean) => {
    if (isOpen && transaction) {
      setPaymentDate(new Date());
      setAmount(String(transaction.amount));
    }
    onOpenChange(isOpen);
  };

  const handleConfirm = () => {
    if (!transaction || !paymentDate) return;
    onConfirm({
      id: transaction.id,
      status: "paid",
      payment_date: format(paymentDate, "yyyy-MM-dd"),
      amount: parseFloat(amount) || transaction.amount,
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Baixa</DialogTitle>
        </DialogHeader>
        {transaction && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {transaction.description} — {transaction.transaction_type === "income" ? "Receita" : "Despesa"}
            </p>
            <div className="space-y-2">
              <Label>Data efetiva do pagamento</Label>
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
            <div className="space-y-2">
              <Label>Valor realizado (R$)</Label>
              <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
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
  );
}
