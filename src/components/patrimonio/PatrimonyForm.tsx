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
  asset_type: z.string().optional().nullable(),
  financial_entity_id: z.string().min(1, "Entidade é obrigatória"),
  opening_value: z.coerce.number(),
  // Vazio = "em aberto" (null); antes virava 0 ou copiava a abertura.
  closing_value: z.preprocess((v) => (v === "" || v === null || v === undefined ? null : Number(v)), z.number().nullable()).optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

// Tipos aceitos em asset_categories.asset_type (CHECK no banco). Passivo subtrai do patrimônio.
const ASSET_TYPES: { value: string; label: string }[] = [
  { value: "cash", label: "Ativo · Conta / caixa" },
  { value: "investment", label: "Ativo · Investimento" },
  { value: "property", label: "Ativo · Imóvel" },
  { value: "vehicle", label: "Ativo · Veículo" },
  { value: "crypto", label: "Ativo · Cripto" },
  { value: "pension", label: "Ativo · Previdência" },
  { value: "international", label: "Ativo · Conta internacional" },
  { value: "receivable", label: "Ativo · Valores a receber" },
  { value: "other", label: "Ativo · Outros" },
  { value: "liability", label: "Passivo · Dívida, financiamento, cartão" },
];

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
      asset_type: "other",
      financial_entity_id: "",
      opening_value: 0,
      closing_value: null,
      notes: "",
    },
  });

  const watchMonth = form.watch("reference_month");
  const watchItem = form.watch("item_name");
  const watchEntity = form.watch("financial_entity_id");
  const watchCategory = form.watch("asset_category_name");
  const watchType = form.watch("asset_type");
  const matchedCategory = categories.find(
    (c) => c.name.toLowerCase().trim() === (watchCategory || "").toLowerCase().trim()
  );

  // Ao escolher uma categoria existente, assume o tipo dela.
  useEffect(() => {
    if (matchedCategory) form.setValue("asset_type", matchedCategory.asset_type || "other");
  }, [matchedCategory?.id]);

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
        asset_type: categories.find((c) => c.id === snapshot.asset_category_id)?.asset_type || "other",
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
        asset_type: "other",
        financial_entity_id: "",
        opening_value: 0,
        closing_value: null,
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
      const assetType = data.asset_type || "other";
      if (existing) {
        categoryId = existing.id;
        // Tipo alterado vale para a categoria inteira (todos os meses).
        if (existing.asset_type !== assetType) {
          await (supabase as any).from("asset_categories").update({ asset_type: assetType }).eq("id", existing.id);
        }
      } else {
        const { data: newCat, error } = await (supabase as any)
          .from("asset_categories")
          .insert({ name: data.asset_category_name.trim(), asset_type: assetType })
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
      closing_value: data.closing_value ?? null,
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

          <FormField control={form.control} name="asset_type" render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo da categoria</FormLabel>
              <FormControl>
                <Select onValueChange={field.onChange} value={field.value || "other"}>
                  <SelectTrigger id="patrimony-asset-type"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {ASSET_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormControl>
              {watchType === "liability" && (
                <p className="text-[11px] text-muted-foreground">Passivo: informe o saldo devedor como valor positivo; ele é subtraído do patrimônio.</p>
              )}
              {matchedCategory && matchedCategory.asset_type !== (watchType || "other") && (
                <p className="text-[11px] text-amber-700 dark:text-amber-400">O novo tipo vale para todos os itens da categoria "{matchedCategory.name}".</p>
              )}
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
                <FormControl><Input type="number" step="0.01" placeholder="Em aberto" {...field} value={field.value ?? ""} /></FormControl>
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
