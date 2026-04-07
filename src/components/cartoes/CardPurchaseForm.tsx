import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { FormDrawer } from "@/components/shared/FormDrawer";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import type { CardPurchase, Card, Category, FinancialEntity } from "@/types/database";

const schema = z.object({
  description: z.string().min(1, "Descrição é obrigatória").max(200),
  card_id: z.string().min(1, "Cartão é obrigatório"),
  category_id: z.string().optional().nullable(),
  financial_entity_id: z.string().min(1, "Entidade é obrigatória"),
  total_amount: z.coerce.number().min(0.01, "Valor deve ser maior que zero"),
  installments_count: z.coerce.number().min(1, "Mínimo 1 parcela").max(72),
  purchase_date: z.date({ required_error: "Data é obrigatória" }),
  payee: z.string().max(200).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchase?: CardPurchase | null;
  cards: Card[];
  categories: Category[];
  entities: FinancialEntity[];
  onSubmit: (data: Partial<CardPurchase>) => void;
  loading?: boolean;
}

export function CardPurchaseForm({ open, onOpenChange, purchase, cards, categories, entities, onSubmit, loading }: Props) {
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      description: "", card_id: "", category_id: "", financial_entity_id: "",
      total_amount: 0, installments_count: 1, purchase_date: new Date(), payee: "", notes: "",
    },
  });

  const watchCardId = form.watch("card_id");

  // Auto-fill entity when card is selected
  useEffect(() => {
    if (watchCardId && watchCardId !== "") {
      const card = cards.find(c => c.id === watchCardId);
      if (card?.financial_entity_id) {
        form.setValue("financial_entity_id", card.financial_entity_id);
      }
    }
  }, [watchCardId, cards, form]);

  useEffect(() => {
    if (purchase) {
      form.reset({
        description: purchase.description,
        card_id: purchase.card_id,
        category_id: purchase.category_id || "",
        financial_entity_id: purchase.financial_entity_id,
        total_amount: purchase.total_amount,
        installments_count: purchase.installments_count,
        purchase_date: new Date(purchase.purchase_date),
        payee: purchase.payee || "",
        notes: purchase.notes || "",
      });
    } else {
      form.reset({
        description: "", card_id: "", category_id: "", financial_entity_id: "",
        total_amount: 0, installments_count: 1, purchase_date: new Date(), payee: "", notes: "",
      });
    }
  }, [purchase, open]);

  const totalAmount = form.watch("total_amount");
  const installmentsCount = form.watch("installments_count");
  const installmentAmount = installmentsCount > 0 ? totalAmount / installmentsCount : 0;

  const personalEntities = entities.filter(e => e.is_active && e.entity_type === "personal");
  const businessEntities = entities.filter(e => e.is_active && e.entity_type === "business");

  const handleSubmit = (data: FormData) => {
    const payload: any = {
      ...data,
      category_id: data.category_id || null,
      notes: data.notes || null,
      purchase_date: format(data.purchase_date, "yyyy-MM-dd"),
      installment_amount: data.total_amount / data.installments_count,
    };
    onSubmit(purchase ? { id: purchase.id, ...payload } : payload);
  };

  return (
    <FormDrawer open={open} onOpenChange={onOpenChange} title={purchase ? "Editar Compra" : "Nova Compra"}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <FormField control={form.control} name="description" render={({ field }) => (
            <FormItem><FormLabel>Descrição *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
          )} />

          <FormField control={form.control} name="card_id" render={({ field }) => (
            <FormItem><FormLabel>Cartão *</FormLabel><FormControl>
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {cards.filter(c => c.is_active).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormControl><FormMessage /></FormItem>
          )} />

          <FormField control={form.control} name="category_id" render={({ field }) => (
            <FormItem><FormLabel>Categoria</FormLabel><FormControl>
              <Select onValueChange={field.onChange} value={field.value || ""}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {categories.filter(c => c.is_active).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormControl><FormMessage /></FormItem>
          )} />

          <FormField control={form.control} name="financial_entity_id" render={({ field }) => (
            <FormItem><FormLabel>Entidade Financeira *</FormLabel><FormControl>
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {personalEntities.length > 0 && (
                    <>
                      <SelectItem value="__p_hdr" disabled className="text-xs font-semibold text-muted-foreground">— Pessoais —</SelectItem>
                      {personalEntities.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                    </>
                  )}
                  {businessEntities.length > 0 && (
                    <>
                      <SelectItem value="__b_hdr" disabled className="text-xs font-semibold text-muted-foreground">— Empresariais —</SelectItem>
                      {businessEntities.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                    </>
                  )}
                </SelectContent>
              </Select>
            </FormControl><FormMessage /></FormItem>
          )} />

          <div className="grid grid-cols-2 gap-3">
            <FormField control={form.control} name="total_amount" render={({ field }) => (
              <FormItem><FormLabel>Valor Total *</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="installments_count" render={({ field }) => (
              <FormItem><FormLabel>Parcelas *</FormLabel><FormControl><Input type="number" min={1} max={72} {...field} /></FormControl><FormMessage /></FormItem>
            )} />
          </div>

          {installmentsCount > 0 && totalAmount > 0 && (
            <div className="rounded-lg border p-3 text-sm text-muted-foreground">
              Valor por parcela: <span className="font-semibold text-foreground">
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(installmentAmount)}
              </span> × {installmentsCount}x
            </div>
          )}

          <FormField control={form.control} name="purchase_date" render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Data da Compra *</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                      {field.value ? format(field.value, "dd/MM/yyyy") : <span>Selecione...</span>}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="notes" render={({ field }) => (
            <FormItem><FormLabel>Observações</FormLabel><FormControl><Textarea rows={2} {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
          )} />

          <Button type="submit" className="w-full" disabled={loading}>Salvar</Button>
        </form>
      </Form>
    </FormDrawer>
  );
}
