import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FormDrawer } from "@/components/shared/FormDrawer";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useInvestmentClasses, usePreviousClosingValue, type InvestmentSnapshot } from "@/hooks/useInvestments";
import { useFinancialEntities } from "@/hooks/useFinancialEntities";

const schema = z.object({
  reference_month: z.string().min(1, "Mês de referência é obrigatório"),
  investment_class_id: z.string().min(1, "Classe é obrigatória"),
  financial_entity_id: z.string().min(1, "Entidade é obrigatória"),
  opening_value: z.coerce.number(),
  closing_value: z.coerce.number(),
  has_quick_liquidity: z.boolean().optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  snapshot?: InvestmentSnapshot | null;
  onSubmit: (data: any) => void;
  loading?: boolean;
}

export function InvestmentForm({ open, onOpenChange, snapshot, onSubmit, loading }: Props) {
  const { data: classes = [] } = useInvestmentClasses();
  const { data: entities = [] } = useFinancialEntities();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      reference_month: "",
      investment_class_id: "",
      financial_entity_id: "",
      opening_value: 0,
      closing_value: 0,
      has_quick_liquidity: false,
    },
  });

  const watchMonth = form.watch("reference_month");
  const watchClass = form.watch("investment_class_id");
  const watchEntity = form.watch("financial_entity_id");

  const { data: prevClosing } = usePreviousClosingValue(
    !snapshot ? watchMonth : undefined,
    !snapshot ? watchClass : undefined,
    !snapshot ? watchEntity : undefined
  );

  // Auto-fill opening_value from previous month's closing_value (new records only)
  useEffect(() => {
    if (!snapshot && prevClosing != null) {
      form.setValue("opening_value", prevClosing);
    }
  }, [prevClosing, snapshot]);

  useEffect(() => {
    if (snapshot) {
      form.reset({
        reference_month: snapshot.reference_month,
        investment_class_id: snapshot.investment_class_id,
        financial_entity_id: snapshot.financial_entity_id,
        opening_value: snapshot.opening_value,
        closing_value: snapshot.closing_value,
        has_quick_liquidity: (snapshot as any).has_quick_liquidity ?? false,
      });
    } else {
      form.reset({
        reference_month: "",
        investment_class_id: "",
        financial_entity_id: "",
        opening_value: 0,
        closing_value: 0,
        has_quick_liquidity: false,
      });
    }
  }, [snapshot, open]);

  const handleSubmit = (data: FormData) => {
    onSubmit(snapshot ? { id: snapshot.id, ...data } : data);
  };

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={snapshot ? "Editar Registro" : "Novo Registro de Investimento"}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <FormField control={form.control} name="reference_month" render={({ field }) => (
            <FormItem>
              <FormLabel>Mês de Referência *</FormLabel>
              <FormControl><Input type="month" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="investment_class_id" render={({ field }) => (
            <FormItem>
              <FormLabel>Classe *</FormLabel>
              <FormControl>
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="financial_entity_id" render={({ field }) => (
            <FormItem>
              <FormLabel>Entidade *</FormLabel>
              <FormControl>
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {entities.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <div className="grid grid-cols-2 gap-4">
            <FormField control={form.control} name="opening_value" render={({ field }) => (
              <FormItem>
                <FormLabel>Valor Abertura</FormLabel>
                <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="closing_value" render={({ field }) => (
              <FormItem>
                <FormLabel>Valor Fechamento *</FormLabel>
                <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>

          <FormField control={form.control} name="has_quick_liquidity" render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3">
              <FormControl>
                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>Liquidez Rápida</FormLabel>
                <p className="text-xs text-muted-foreground">Marque se este investimento pode ser resgatado rapidamente</p>
              </div>
            </FormItem>
          )} />

          <Button type="submit" className="w-full" disabled={loading}>Salvar</Button>
        </form>
      </Form>
    </FormDrawer>
  );
}
