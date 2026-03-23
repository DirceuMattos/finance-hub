import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FormDrawer } from "@/components/shared/FormDrawer";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { SystemParameter } from "@/types/database";

const schema = z.object({
  parameter_key: z.string().min(1, "Chave é obrigatória").max(100),
  parameter_value: z.string().min(1, "Valor é obrigatório"),
  value_type: z.string().min(1, "Tipo é obrigatório"),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parameter?: SystemParameter | null;
  onSubmit: (data: Partial<SystemParameter>) => void;
  loading?: boolean;
}

export function SystemParameterForm({ open, onOpenChange, parameter, onSubmit, loading }: Props) {
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { parameter_key: "", parameter_value: "", value_type: "string" },
  });

  useEffect(() => {
    if (parameter) {
      form.reset({
        parameter_key: parameter.parameter_key,
        parameter_value: parameter.parameter_value,
        value_type: parameter.value_type,
      });
    } else {
      form.reset({ parameter_key: "", parameter_value: "", value_type: "string" });
    }
  }, [parameter, open]);

  const handleSubmit = (data: FormData) => {
    onSubmit(parameter ? { id: parameter.id, ...data } : data);
  };

  return (
    <FormDrawer open={open} onOpenChange={onOpenChange} title={parameter ? "Editar Parâmetro" : "Novo Parâmetro"}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <FormField control={form.control} name="parameter_key" render={({ field }) => (
            <FormItem><FormLabel>Chave *</FormLabel><FormControl><Input {...field} disabled={!!parameter} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="parameter_value" render={({ field }) => (
            <FormItem><FormLabel>Valor *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="value_type" render={({ field }) => (
            <FormItem><FormLabel>Tipo *</FormLabel><FormControl>
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="string">Texto</SelectItem>
                  <SelectItem value="number">Número</SelectItem>
                  <SelectItem value="boolean">Booleano</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                </SelectContent>
              </Select>
            </FormControl><FormMessage /></FormItem>
          )} />
          <Button type="submit" className="w-full" disabled={loading}>Salvar</Button>
        </form>
      </Form>
    </FormDrawer>
  );
}
