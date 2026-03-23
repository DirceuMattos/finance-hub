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
import type { FinancialEntity } from "@/types/database";

const schema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(100),
  entity_type: z.string().min(1, "Tipo é obrigatório"),
  is_primary_business_entity: z.boolean(),
  is_active: z.boolean(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entity?: FinancialEntity | null;
  onSubmit: (data: Partial<FinancialEntity>) => void;
  loading?: boolean;
}

export function FinancialEntityForm({ open, onOpenChange, entity, onSubmit, loading }: Props) {
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", entity_type: "personal", is_primary_business_entity: false, is_active: true },
  });

  useEffect(() => {
    if (entity) {
      form.reset({
        name: entity.name,
        entity_type: entity.entity_type,
        is_primary_business_entity: entity.is_primary_business_entity,
        is_active: entity.is_active,
      });
    } else {
      form.reset({ name: "", entity_type: "personal", is_primary_business_entity: false, is_active: true });
    }
  }, [entity, open]);

  const handleSubmit = (data: FormData) => {
    onSubmit(entity ? { id: entity.id, ...data } : data);
  };

  return (
    <FormDrawer open={open} onOpenChange={onOpenChange} title={entity ? "Editar Entidade" : "Nova Entidade"}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem><FormLabel>Nome *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="entity_type" render={({ field }) => (
            <FormItem><FormLabel>Tipo *</FormLabel><FormControl>
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal">Pessoal</SelectItem>
                  <SelectItem value="business">Empresarial</SelectItem>
                </SelectContent>
              </Select>
            </FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="is_primary_business_entity" render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border p-3">
              <FormLabel>Entidade principal</FormLabel>
              <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
            </FormItem>
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
