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
import type { Card, FinancialEntity } from "@/types/database";

const schema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(100),
  issuer_bank: z.string().max(100).optional().nullable(),
  credit_limit: z.coerce.number().min(0),
  managerial_limit: z.coerce.number().min(0).optional().nullable(),
  closing_day: z.coerce.number().min(1).max(31),
  due_day: z.coerce.number().min(1).max(31),
  financial_entity_id: z.string().min(1, "Entidade é obrigatória"),
  is_active: z.boolean(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card?: Card | null;
  entities: FinancialEntity[];
  onSubmit: (data: Partial<Card>) => void;
  loading?: boolean;
}

export function CardForm({ open, onOpenChange, card, entities, onSubmit, loading }: Props) {
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", issuer_bank: "", credit_limit: 0, managerial_limit: 0, closing_day: 1, due_day: 10, financial_entity_id: "", is_active: true },
  });

  useEffect(() => {
    if (card) {
      form.reset({
        name: card.name,
        issuer_bank: card.issuer_bank || "",
        credit_limit: card.credit_limit,
        managerial_limit: card.managerial_limit || 0,
        closing_day: card.closing_day,
        due_day: card.due_day,
        financial_entity_id: card.financial_entity_id,
        is_active: card.is_active,
      });
    } else {
      form.reset({ name: "", issuer_bank: "", credit_limit: 0, managerial_limit: 0, closing_day: 1, due_day: 10, financial_entity_id: "", is_active: true });
    }
  }, [card, open]);

  const handleSubmit = (data: FormData) => {
    onSubmit(card ? { id: card.id, ...data } : data);
  };

  return (
    <FormDrawer open={open} onOpenChange={onOpenChange} title={card ? "Editar Cartão" : "Novo Cartão"}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem><FormLabel>Nome *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="issuer_bank" render={({ field }) => (
            <FormItem><FormLabel>Banco Emissor</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
          )} />
          <div className="grid grid-cols-2 gap-3">
            <FormField control={form.control} name="credit_limit" render={({ field }) => (
              <FormItem><FormLabel>Limite *</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="managerial_limit" render={({ field }) => (
              <FormItem><FormLabel>Teto Gerencial</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value ?? 0} /></FormControl><FormMessage /></FormItem>
            )} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField control={form.control} name="closing_day" render={({ field }) => (
              <FormItem><FormLabel>Dia Fechamento *</FormLabel><FormControl><Input type="number" min={1} max={31} {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="due_day" render={({ field }) => (
              <FormItem><FormLabel>Dia Vencimento *</FormLabel><FormControl><Input type="number" min={1} max={31} {...field} /></FormControl><FormMessage /></FormItem>
            )} />
          </div>
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
