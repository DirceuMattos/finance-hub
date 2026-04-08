import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FormDrawer } from "@/components/shared/FormDrawer";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import type { InvestmentClassRow } from "@/hooks/useInvestmentClassesCrud";

const schema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  is_active: z.boolean(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  investmentClass?: InvestmentClassRow | null;
  onSubmit: (data: any) => void;
  loading?: boolean;
}

export function InvestmentClassForm({ open, onOpenChange, investmentClass, onSubmit, loading }: Props) {
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", is_active: true },
  });

  useEffect(() => {
    if (investmentClass) {
      form.reset({ name: investmentClass.name, is_active: investmentClass.is_active });
    } else {
      form.reset({ name: "", is_active: true });
    }
  }, [investmentClass, open]);

  const handleSubmit = (data: FormData) => {
    onSubmit(investmentClass ? { id: investmentClass.id, ...data } : data);
  };

  return (
    <FormDrawer open={open} onOpenChange={onOpenChange} title={investmentClass ? "Editar Classe" : "Nova Classe de Investimento"}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem>
              <FormLabel>Nome *</FormLabel>
              <FormControl><Input {...field} placeholder="Ex: Renda Fixa, Ações..." /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="is_active" render={({ field }) => (
            <FormItem className="flex items-center gap-3">
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
