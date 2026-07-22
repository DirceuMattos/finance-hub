import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { FormDrawer } from "@/components/shared/FormDrawer";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import type { Recurrence } from "@/hooks/useRecurrences";
import type { FinancialEntity, Account, Category } from "@/types/database";
import { useCards } from "@/hooks/useCards";

const schema = z.object({
  description: z.string().min(1, "Descrição é obrigatória").max(200),
  amount: z.string().min(1, "Valor é obrigatório"),
  frequency: z.string().min(1, "Frequência é obrigatória"),
  transaction_type: z.string().min(1, "Tipo é obrigatório"),
  category_id: z.string().optional().nullable(),
  financial_entity_id: z.string().optional().nullable(),
  account_id: z.string().optional().nullable(),
  center_cost: z.string().optional().nullable(),
  starts_on: z.date().optional().nullable(),
  ends_on: z.date().optional().nullable(),
  installments_count: z.number().optional().nullable(),
  due_day: z.number().optional().nullable(),
  day_of_week: z.number().optional().nullable(),
  is_active: z.boolean(),
  is_continuous: z.boolean(),
  generate_as_planned: z.boolean(),
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
  const { data: cardsList = [] } = useCards();

  const [endDateMode, setEndDateMode] = useState<"date" | "count">("date");

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      description: "", amount: "", frequency: "monthly",
      transaction_type: "expense", category_id: "", financial_entity_id: "",
      account_id: "", center_cost: "", starts_on: null, ends_on: null,
      installments_count: null,
      due_day: null, day_of_week: null, is_active: true,
      is_continuous: false, generate_as_planned: true, payee: "", notes: "",
    },
  });

  const watchFrequency = form.watch("frequency");

  useEffect(() => {
    if (recurrence) {
      form.reset({
        description: recurrence.description,
        amount: String(recurrence.amount),
        frequency: recurrence.frequency,
        transaction_type: recurrence.transaction_type,
        category_id: recurrence.category_id || "",
        financial_entity_id: recurrence.financial_entity_id || "",
        account_id: recurrence.account_id || "",
        center_cost: recurrence.center_cost || "",
        starts_on: recurrence.starts_on ? new Date(recurrence.starts_on) : null,
        ends_on: recurrence.ends_on ? new Date(recurrence.ends_on) : null,
        due_day: recurrence.due_day ?? null,
        day_of_week: recurrence.day_of_week ?? null,
        is_active: recurrence.is_active,
        is_continuous: recurrence.is_continuous ?? false,
        generate_as_planned: recurrence.generate_as_planned ?? true,
        payee: recurrence.payee || "",
        notes: recurrence.notes || "",
        installments_count: null,
      });
    } else {
      form.reset({
        description: "", amount: "", frequency: "monthly",
        transaction_type: "expense", category_id: "", financial_entity_id: "",
        account_id: "", center_cost: "", starts_on: null, ends_on: null,
        installments_count: null,
        due_day: null, day_of_week: null, is_active: true,
        is_continuous: false, generate_as_planned: true, payee: "", notes: "",
      });
    }
    setEndDateMode("date");
  }, [recurrence, open]);

  const handleSubmit = (data: FormData) => {
    const parsedAmount = parseFloat(String(data.amount).replace(/\./g, "").replace(",", "."));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      form.setError("amount", { message: "Valor inválido" });
      return;
    }
    let endsOn = data.ends_on;
    if (endDateMode === "count" && data.installments_count && data.starts_on) {
      const count = data.installments_count;
      const starts = data.starts_on;
      if (data.frequency === "monthly") {
        endsOn = new Date(starts.getFullYear(), starts.getMonth() + count - 1, starts.getDate());
      } else if (data.frequency === "weekly") {
        endsOn = new Date(starts.getTime() + (count - 1) * 7 * 24 * 60 * 60 * 1000);
      } else if (data.frequency === "yearly") {
        endsOn = new Date(starts.getFullYear() + count - 1, starts.getMonth(), starts.getDate());
      }
    }
    // Auto-extract due_day from starts_on when not explicitly set
    let dueDay = data.due_day ?? null;
    if (!dueDay && data.starts_on && data.frequency === "monthly") {
      dueDay = data.starts_on.getDate();
    }

    const payload: any = {
      description: data.description,
      amount: parsedAmount,
      frequency: data.frequency,
      transaction_type: data.transaction_type,
      category_id: data.category_id || null,
      financial_entity_id: data.financial_entity_id || null,
      account_id: data.account_id || null,
      center_cost: data.center_cost || null,
      starts_on: data.starts_on ? format(data.starts_on, "yyyy-MM-dd") : null,
      ends_on: endsOn ? format(endsOn, "yyyy-MM-dd") : null,
      due_day: dueDay,
      day_of_week: data.day_of_week ?? null,
      is_active: data.is_active,
      is_continuous: data.is_continuous,
      generate_as_planned: data.generate_as_planned,
      payee: data.payee || null,
      notes: data.notes || null,
    };
    onSubmit(recurrence ? { id: recurrence.id, ...payload } : payload);
  };

  const DateField = ({ name, label }: { name: "starts_on" | "ends_on"; label: string }) => (
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

          <FormField control={form.control} name="payee" render={({ field }) => (
            <FormItem><FormLabel>Favorecido/Cliente</FormLabel><FormControl><Input placeholder="Nome do favorecido ou cliente" {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
          )} />

          <div className="grid grid-cols-2 gap-3">
            <FormField control={form.control} name="transaction_type" render={({ field }) => (
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
                    <SelectItem value="weekly">Semanal</SelectItem>
                    <SelectItem value="monthly">Mensal</SelectItem>
                    <SelectItem value="yearly">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </FormControl><FormMessage /></FormItem>
            )} />
          </div>

          {watchFrequency === "weekly" && (
            <FormField control={form.control} name="day_of_week" render={({ field }) => (
              <FormItem>
                <FormLabel>Dia da Semana *</FormLabel>
                <Select
                  value={field.value !== null && field.value !== undefined ? String(field.value) : ""}
                  onValueChange={(v) => field.onChange(Number(v))}
                >
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Selecione o dia..." /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="0">Domingo</SelectItem>
                    <SelectItem value="1">Segunda-feira</SelectItem>
                    <SelectItem value="2">Terça-feira</SelectItem>
                    <SelectItem value="3">Quarta-feira</SelectItem>
                    <SelectItem value="4">Quinta-feira</SelectItem>
                    <SelectItem value="5">Sexta-feira</SelectItem>
                    <SelectItem value="6">Sábado</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
          )}

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

          <FormField control={form.control} name="center_cost" render={({ field }) => (
            <FormItem>
              <FormLabel>Cartão de Crédito (opcional)</FormLabel>
              <Select
                value={field.value || "none"}
                onValueChange={(v) => field.onChange(v === "none" ? "" : v)}
              >
                <FormControl>
                  <SelectTrigger><SelectValue placeholder="Nenhum cartão" /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="none">Nenhum cartão</SelectItem>
                  {cardsList.map((card: any) => (
                    <SelectItem key={card.id} value={card.name}>{card.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />

          <div className="grid grid-cols-2 gap-3">
            <DateField name="starts_on" label="Data Início" />
            <FormItem>
              <FormLabel>Data Final</FormLabel>
              <div className="flex gap-2 mb-2">
                <Button
                  type="button"
                  size="sm"
                  variant={endDateMode === "date" ? "default" : "outline"}
                  onClick={() => setEndDateMode("date")}
                >
                  Data
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={endDateMode === "count" ? "default" : "outline"}
                  onClick={() => setEndDateMode("count")}
                >
                  Quantidade
                </Button>
              </div>
              {endDateMode === "date" ? (
                <FormField control={form.control} name="ends_on" render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input type="date" value={field.value ? format(field.value, "yyyy-MM-dd") : ""} onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : null)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              ) : (
                <FormField control={form.control} name="installments_count" render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={600}
                        placeholder="Ex: 12"
                        value={field.value || ""}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || null)}
                        onFocus={(e) => e.target.select()}
                      />
                    </FormControl>
                    <FormDescription>
                      {field.value && form.watch("starts_on") && form.watch("frequency") ? (() => {
                        const starts = form.watch("starts_on");
                        const freq = form.watch("frequency");
                        const count = field.value;
                        if (!starts || !count) return null;
                        let endDate: Date;
                        if (freq === "monthly") {
                          endDate = new Date(starts.getFullYear(), starts.getMonth() + count - 1, starts.getDate());
                        } else if (freq === "weekly") {
                          endDate = new Date(starts.getTime() + (count - 1) * 7 * 24 * 60 * 60 * 1000);
                        } else if (freq === "yearly") {
                          endDate = new Date(starts.getFullYear() + count - 1, starts.getMonth(), starts.getDate());
                        } else {
                          return null;
                        }
                        return `Data final: ${format(endDate, "dd/MM/yyyy")}`;
                      })() : null}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
              )}
            </FormItem>
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
