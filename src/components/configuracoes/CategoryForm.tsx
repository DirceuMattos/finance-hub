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
import type { Category } from "@/types/database";

const schema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(100),
  parent_id: z.string().optional().nullable(),
  category_group: z.string().optional().nullable(),
  transaction_nature: z.string().optional().nullable(),
  is_containable: z.boolean(),
  is_active: z.boolean(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: Category | null;
  categories: Category[];
  onSubmit: (data: Partial<Category>) => void;
  loading?: boolean;
}

export function CategoryForm({ open, onOpenChange, category, categories, onSubmit, loading }: Props) {
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", parent_id: null, category_group: null, transaction_nature: null, is_containable: false, is_active: true },
  });

  useEffect(() => {
    if (category) {
      form.reset({
        name: category.name,
        parent_id: category.parent_id || "",
        category_group: category.category_group || "",
        transaction_nature: category.transaction_nature || "",
        is_containable: category.is_containable,
        is_active: category.is_active,
      });
    } else {
      form.reset({ name: "", parent_id: "", category_group: "", transaction_nature: "", is_containable: false, is_active: true });
    }
  }, [category, open]);

  const handleSubmit = (data: FormData) => {
    const cleaned = {
      ...data,
      parent_id: data.parent_id || null,
      category_group: data.category_group || null,
      transaction_nature: data.transaction_nature || null,
    };
    onSubmit(category ? { id: category.id, ...cleaned } : cleaned);
  };

  const parentOptions = categories.filter((c) => c.id !== category?.id);

  return (
    <FormDrawer open={open} onOpenChange={onOpenChange} title={category ? "Editar Categoria" : "Nova Categoria"}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem><FormLabel>Nome *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="parent_id" render={({ field }) => (
            <FormItem><FormLabel>Categoria Pai</FormLabel><FormControl>
              <Select onValueChange={field.onChange} value={field.value || ""}>
                <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {parentOptions.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="category_group" render={({ field }) => (
            <FormItem><FormLabel>Grupo</FormLabel><FormControl>
              <Select onValueChange={field.onChange} value={field.value || ""}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  <SelectItem value="fixed">Fixo</SelectItem>
                  <SelectItem value="variable">Variável</SelectItem>
                  <SelectItem value="exceptional">Excepcional</SelectItem>
                </SelectContent>
              </Select>
            </FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="transaction_nature" render={({ field }) => (
            <FormItem><FormLabel>Natureza da Transação</FormLabel><FormControl>
              <Select onValueChange={field.onChange} value={field.value || ""}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  <SelectItem value="income">Receita</SelectItem>
                  <SelectItem value="expense">Despesa</SelectItem>
                  <SelectItem value="transfer">Transferência</SelectItem>
                </SelectContent>
              </Select>
            </FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="is_containable" render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border p-3">
              <FormLabel>Contível</FormLabel>
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
