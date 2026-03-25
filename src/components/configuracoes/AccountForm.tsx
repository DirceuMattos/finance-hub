import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FormDrawer } from "@/components/shared/FormDrawer";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Account, FinancialEntity } from "@/types/database";

const schema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(100),
  bank_name: z.string().max(100).optional().nullable(),
  account_type: z.string().min(1, "Tipo é obrigatório"),
  financial_entity_id: z.string().min(1, "Entidade é obrigatória"),
  opening_balance: z.coerce.number(),
  current_balance: z.coerce.number(),
  currency: z.string().min(1, "Moeda é obrigatória"),
  is_active: z.boolean(),
});

type FormData = z.infer<typeof schema>;

const balanceInputPattern = /^-?\d*(\.\d{0,2})?$/;

const normalizeBalanceInput = (value: string) => value.replace(",", ".");

const isAllowedBalanceInput = (value: string) => {
  const normalized = normalizeBalanceInput(value);
  return ["", "-", ".", "-."] .includes(normalized) || balanceInputPattern.test(normalized);
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: Account | null;
  entities: FinancialEntity[];
  onSubmit: (data: Partial<Account>) => void;
  loading?: boolean;
}

export function AccountForm({ open, onOpenChange, account, entities, onSubmit, loading }: Props) {
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", bank_name: "", account_type: "checking", financial_entity_id: "", opening_balance: 0, current_balance: 0, currency: "BRL", is_active: true },
  });

  useEffect(() => {
    if (account) {
      form.reset({
        name: account.name,
        bank_name: account.bank_name || "",
        account_type: account.account_type,
        financial_entity_id: account.financial_entity_id,
        opening_balance: account.opening_balance,
        current_balance: account.current_balance,
        currency: account.currency,
        is_active: account.is_active,
      });
    } else {
      form.reset({ name: "", bank_name: "", account_type: "checking", financial_entity_id: "", opening_balance: 0, current_balance: 0, currency: "BRL", is_active: true });
    }
  }, [account, open]);

  const handleSubmit = (data: FormData) => {
    onSubmit(account ? { id: account.id, ...data } : data);
  };

  return (
    <FormDrawer open={open} onOpenChange={onOpenChange} title={account ? "Editar Conta" : "Nova Conta"}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem><FormLabel>Nome *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="bank_name" render={({ field }) => (
            <FormItem><FormLabel>Banco</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="account_type" render={({ field }) => (
            <FormItem><FormLabel>Tipo *</FormLabel><FormControl>
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="checking">Corrente</SelectItem>
                  <SelectItem value="savings">Poupança</SelectItem>
                  <SelectItem value="investment">Investimento</SelectItem>
                  <SelectItem value="cash">Caixa</SelectItem>
                </SelectContent>
              </Select>
            </FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="financial_entity_id" render={({ field }) => (
            <FormItem><FormLabel>Entidade Financeira *</FormLabel><FormControl>
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {entities.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormControl><FormMessage /></FormItem>
          )} />
          <div className="grid grid-cols-2 gap-3">
            <FormField control={form.control} name="opening_balance" render={({ field }) => (
              <FormItem>
                <FormLabel>Saldo Inicial</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={field.value?.toString() ?? ""}
                    onChange={(e) => {
                      if (!isAllowedBalanceInput(e.target.value)) return;
                      field.onChange(normalizeBalanceInput(e.target.value));
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="current_balance" render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-1">
                  Saldo Atual
                  <span className="text-[10px] text-muted-foreground font-normal" title="Idealmente derivado de saldo inicial + lançamentos realizados">(calculado)</span>
                </FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={field.value?.toString() ?? ""}
                    onChange={(e) => {
                      if (!isAllowedBalanceInput(e.target.value)) return;
                      field.onChange(normalizeBalanceInput(e.target.value));
                    }}
                  />
                </FormControl>
                <span className="text-[10px] text-muted-foreground">Saldo derivado do saldo inicial + lançamentos. Ajuste manualmente se necessário.</span>
                <FormMessage />
              </FormItem>
            )} />
          </div>
          <FormField control={form.control} name="currency" render={({ field }) => (
            <FormItem><FormLabel>Moeda *</FormLabel><FormControl>
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BRL">BRL</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="is_active" render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border p-3">
              <FormLabel>Ativo</FormLabel>
              <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
            </FormItem>
          )} />
          <Button type="submit" className="w-full" disabled={loading}>Salvar</Button>
        </form>
      </Form>
    </FormDrawer>
  );
}
