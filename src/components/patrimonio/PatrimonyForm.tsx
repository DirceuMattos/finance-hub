import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FormDrawer } from "@/components/shared/FormDrawer";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAssetCategories, usePreviousPatrimonyClosingValue, type PatrimonySnapshot } from "@/hooks/usePatrimony";
import { useFinancialEntities } from "@/hooks/useFinancialEntities";
import { supabase } from "@/lib/supabaseClient";

const schema = z.object({
  reference_month: z.string().min(1, "Mês de referência é obrigatório"),
  item_name: z.string().min(1, "Nome do item é obrigatório"),
  asset_category_name: z.string().optional().nullable(),
  financial_entity_id: z.string().min(1, "Entidade é obrigatória"),
  opening_value: z.coerce.number(),
  closing_value: z.coerce.number().optional().nullable(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  snapshot?: PatrimonySnapshot | null;
  onSubmit: (data: any) => void;
  loading?: boolean;
}

export function PatrimonyForm({ open, onOpenChange, snapshot, onSubmit, loading }: Props) {
  const { data: categories = [] } = useAssetCategories();
  const { data: entities = [] } = useFinancialEntities();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      reference_month: "",
      item_name: "",
      asset_category_name: "",
      financial_entity_id: "",
      opening_value: 0,
      closing_value: 0,
      notes: "",
    },
  });

  const watchMonth = form.watch("reference_month");
  const watchItem = form.watch("item_name");
  const watchEntity = form.watch("financial_entity_id");

  const { data: prevClosing } = usePreviousPatrimonyClosingValue(
    !snapshot ? watchMonth : undefined,
    !snapshot ? watchItem : undefined,
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
        item_name: snapshot.item_name,
        asset_category_name: snapshot.asset_category_id
          ? categories.find((c) => c.id === snapshot.asset_category_id)?.name || ""
          : "",
        financial_entity_id: snapshot.financial_entity_id,
        opening_value: snapshot.opening_value,
        closing_value: snapshot.closing_value,
        notes: snapshot.notes || "",
      });
    } else {
      form.reset({
        reference_month: "",
        item_name: "",
        asset_category_name: "",
        financial_entity_id: "",
        opening_value: 0,
        closing_value: 0,
        notes: "",
      });
    }
  }, [snapshot, open, categories]);

  const handleSubmit = async (data: FormData) => {
    let categoryId: string | null = null;

    if (data.asset_category_name && data.asset_category_name.trim() !== "") {
      const existing = categories.find(
        (c) => c.name.toLowerCase().trim() === data.asset_category_name!.toLowerCase().trim()
      );
      if (existing) {
        categoryId = existing.id;
      } else {
        const { data: newCat, error } = await (supabase as any)
          .from("asset_categories")
          .insert({ name: data.asset_category_name.trim() })
          .select("id")
          .single();
        if (!error && newCat) {
          categoryId = newCat.id;
        }
      }
    }

    const payload: any = {
      reference_month:
        data.reference_month.length === 7 ? `${data.reference_month}-01` : data.reference_month,
      item_name: data.item_name,
      asset_category_id: categoryId,
      financial_entity_id: data.financial_entity_id,
      opening_value: data.opening_value,
      closing_value: data.closing_value ?? data.opening_value ?? 0,
      notes: data.notes,
    };

    onSubmit(snapshot ? { id: snapshot.id, ...payload } : payload);
  };

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={snapshot ? "Editar Registro" : "Novo Registro de Patrimônio"}
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

          <FormField control={form.control} name="item_name" render={({ field }) => (
            <FormItem>
              <FormLabel>Item *</FormLabel>
              <FormControl><Input {...field} placeholder="Ex: Poupança, Imóvel..." /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="asset_category_name" render={({ field }) => (
            <FormItem>
              <FormLabel>Categoria (opcional)</FormLabel>
              <FormControl>
                <>
                  <Input
                    {...field}
                    value={field.value || ""}
                    list="asset-categories-list"
                    placeholder="Digite ou selecione uma categoria"
                  />
                  <datalist id="asset-categories-list">
                    {[...categories]
                      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
                      .map((c) => (
                        <option key={c.id} value={c.name} />
                      ))}
                  </datalist>
                </>
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
                <FormLabel>Valor Fechamento</FormLabel>
                <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>

          <FormField control={form.control} name="notes" render={({ field }) => (
            <FormItem>
              <FormLabel>Notas</FormLabel>
              <FormControl><Textarea {...field} placeholder="Observações opcionais..." /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <Button type="submit" className="w-full" disabled={loading}>Salvar</Button>
        </form>
      </Form>
    </FormDrawer>
  );
}
