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
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import type { Recurrence } from "@/hooks/useRecurrences";
import type { FinancialEntity, Account, Category } from "@/types/database";

const schema = z.object({
  description: z.string().min(1, "Descrição é obrigatória").max(200),
  amount: z.string().min(1, "Valor é obrigatório"),
  frequency: z.string().min(1, "Frequência é obrigatória"),
  type: z.string().min(1, "Tipo é obrigatório"),
  category_id: z.string().optional().nullable(),
  financial_entity_id: z.string().optional().nullable(),
  account_id: z.string().optional().nullable(),
  start_date: z.date().optional().nullable(),
  end_date: z.date().optional().nullable(),
  is_active: z.boolean(),
  payee: z.string().max(200).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recurrence?: Recurrence | null;
  entities: FinancialEntity[];
  accounts: Account[];
  categories: Category[];
  onSubmit: (data: Partial<Recurrence>) => void;
  loading?: boolean;
}

export function RecurrenceForm({ open, onOpenChange, recurrence, entities, accounts, categories, onSubmit, loading }: Props) {
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      description: "", amount: "", frequency: "monthly", type: "expense",
      category_id: "", financial_entity_id: "", account_id: "",
      start_date: null, end_date: null, is_active: true, payee: "", notes: "",
    },
  });

  useEffect(() => {
    if (recurrence) {
      form.reset({
        description: recurrence.description,
        amount: String(recurrence.amount),
        frequency: recurrence.frequency,
        type: recurrence.type,
        category_id: recurrence.category_id || "",
        financial_entity_id: recurrence.financial_entity_id || "",
        account_id: recurrence.account_id || "",
        start_date: recurrence.start_date ? new Date(recurrence.start_date) : null,
        end_date: recurrence.end_date ? new Date(recurrence.end_date) : null,
        is_active: recurrence.is_active,
        payee: recurrence.payee || "",
        notes: recurrence.notes || "",
      });
    } else {
      form.reset({
        description: "", amount: "", frequency: "monthly", type: "expense",
        category_id: "", financial_entity_id: "", account_id: "",
        start_date: null, end_date: null, is_active: true, payee: "", notes: "",
      });
    }
  }, [recurrence, open]);

  const handleSubmit = (data: FormData) => {
    const parsedAmount = parseFloat(String(data.amount).replace(/\./g, "").replace(",", "."));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      form.setError("amount", { message: "Valor inválido" });
      return;
    }
    const payload: any = {
      description: data.description,
      amount: parsedAmount,
      frequency: data.frequency,
      type: data.type,
      category_id: data.category_id || null,
      financial_entity_id: data.financial_entity_id || null,
      account_id: data.account_id || null,
      start_date: data.start_date ? format(data.start_date, "yyyy-MM-dd") : null,
      end_date: data.end_date ? format(data.end_date, "yyyy-MM-dd") : null,
      is_active: data.is_active,
      payee: data.payee || null,
      notes: data.notes || null,
    };
    onSubmit(recurrence ? { id: recurrence.id, ...payload } : payload);
  };

  const DateField = ({ name, label }: { name: "start_date" | "end_date"; label: string }) => (
    <FormField control={form.control} name={name} render={({ field }) => (
      <FormItem className="flex flex-col">
        <FormLabel>{label}</FormLabel>
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
            <Calendar mode="single" selected={field.value ?? undefined} onSelect={field.onChange} initialFocus className={cn("p-3 pointer-events-auto")} />
          </PopoverContent>
        </Popover>
        <FormMessage />
      </FormItem>
    )} />
  );

  const personalEntities = entities.filter(e => e.is_active && e.entity_type === "personal");
  const businessEntities = entities.filter(e => e.is_active && e.entity_type === "business");

  return (
    <FormDrawer open={open} onOpenChange={onOpenChange} title={recurrence ? "Editar Recorrência" : "Nova Recorrência"}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <FormField control={form.control} name="description" render={({ field }) => (
            <FormItem><FormLabel>Descrição *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
          )} />

          <div className="grid grid-cols-2 gap-3">
            <FormField control={form.control} name="type" render={({ field }) => (
              <FormItem><FormLabel>Tipo *</FormLabel><FormControl>
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">Receita</SelectItem>
                    <SelectItem value="expense">Despesa</SelectItem>
                  </SelectContent>
                </Select>
              </FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="frequency" render={({ field }) => (
              <FormItem><FormLabel>Frequência *</FormLabel><FormControl>
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Mensal</SelectItem>
                    <SelectItem value="yearly">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </FormControl><FormMessage /></FormItem>
            )} />
          </div>

          <FormField control={form.control} name="amount" render={({ field }) => (
            <FormItem><FormLabel>Valor *</FormLabel><FormControl><Input type="text" inputMode="decimal" placeholder="0,00" {...field} /></FormControl><FormMessage /></FormItem>
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
            <FormItem><FormLabel>Entidade</FormLabel><FormControl>
              <Select onValueChange={field.onChange} value={field.value || ""}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {personalEntities.length > 0 && (
                    <>
                      <SelectItem value="__p" disabled className="text-xs font-semibold text-muted-foreground">— Pessoais —</SelectItem>
                      {personalEntities.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                    </>
                  )}
                  {businessEntities.length > 0 && (
                    <>
                      <SelectItem value="__b" disabled className="text-xs font-semibold text-muted-foreground">— Empresariais —</SelectItem>
                      {businessEntities.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                    </>
                  )}
                </SelectContent>
              </Select>
            </FormControl><FormMessage /></FormItem>
          )} />

          <FormField control={form.control} name="account_id" render={({ field }) => (
            <FormItem><FormLabel>Conta</FormLabel><FormControl>
              <Select onValueChange={field.onChange} value={field.value || ""}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {accounts.filter(a => a.is_active).map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormControl><FormMessage /></FormItem>
          )} />

          <div className="grid grid-cols-2 gap-3">
            <DateField name="start_date" label="Data Início" />
            <DateField name="end_date" label="Data Fim" />
          </div>

          <FormField control={form.control} name="is_active" render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border p-3">
              <FormLabel>Ativo</FormLabel>
              <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
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
